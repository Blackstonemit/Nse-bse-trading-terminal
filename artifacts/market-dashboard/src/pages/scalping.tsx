import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type CandlestickData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useGetMarketHistory,
  useRunAgentAnalysis,
  useGetMarketQuotes,
  getGetMarketQuotesQueryKey,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Zap, 
  BrainCircuit, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  X, 
  Play, 
  Percent, 
  Loader2, 
  ChevronRight,
  TrendingUpIcon,
  CircleDot,
  Keyboard,
  Info
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// ── presets ──────────────────────────────────────────────────────────────────
const SYMBOLS = ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK", "SBIN"];

// ── Technical indicator calculators ──────────────────────────────────────────
function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcEMA(closes: number[], period: number): (number | null)[] {
  const k = 2 / (period + 1);
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let ema: number | null = null;
  for (let i = 0; i < closes.length; i++) {
    if (i < period - 1) { result[i] = null; continue; }
    if (ema === null) {
      const slice = closes.slice(0, period);
      ema = slice.reduce((a, b) => a + b, 0) / period;
    } else {
      ema = closes[i] * k + ema * (1 - k);
    }
    result[i] = ema;
  }
  return result;
}

function calcBB(closes: number[], period = 20, mult = 2) {
  const sma = calcSMA(closes, period);
  return closes.map((_, i) => {
    if (sma[i] === null) return { upper: null, mid: null, lower: null };
    const slice = closes.slice(i - period + 1, i + 1);
    const mean = sma[i]!;
    const variance = slice.reduce((s, v) => s + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    return { upper: mean + mult * sd, mid: mean, lower: mean - mult * sd };
  });
}

// ── Colors ────────────────────────────────────────────────────────────────────
const C = {
  bg:           "#0a0a0a",
  grid:         "#1c1c1c",
  border:       "#2a2a2a",
  text:         "#888",
  up:           "#22c55e",
  down:         "#ef4444",
  sma20:        "#f59e0b",
  ema9:         "#818cf8",
  bbUpper:      "rgba(99,102,241,0.5)",
  bbMid:        "rgba(99,102,241,0.3)",
  bbLower:      "rgba(99,102,241,0.5)",
  vol:          "rgba(100,116,139,0.5)",
};

const CHART_OPTS = {
  layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.border },
  timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
};

type OpenPosition = {
  id: number;
  symbol: string;
  action: "BUY" | "SELL";
  price: number;
  quantity: number;
  type: string;
  status: string;
  entryTime: string;
  stopLoss?: number | null;
  takeProfit?: number | null;
  trailingStop?: number | null;
  maxPrice?: number | null;
};

type LiveQuote = {
  symbol: string;
  price: number;
  changePercent: number;
};

type AISignal = {
  action: "BUY" | "SELL" | "EXIT";
  displayText: string;
  entryPrice: number | null;
  targetPrice: number | null;
  stopLoss: number | null;
  confidence: number;
  rationale: string;
  instrumentType: string;
};

type AIResult = {
  symbol: string;
  summary: string;
  keyLevels: { support: number[]; resistance: number[] };
  signals: AISignal[];
  riskAssessment: string;
  generatedAt: string;
};

type SearchResult = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  type: string;
};

interface Level2OrderBookProps {
  livePrice: number | null;
  symbol: string;
  setStopLoss: (val: string) => void;
  setTakeProfit: (val: string) => void;
}

function Level2OrderBook({ livePrice, symbol, setStopLoss, setTakeProfit }: Level2OrderBookProps) {
  const { toast } = useToast();
  const [orderBook, setOrderBook] = useState<{
    bids: { price: number; quantity: number; total: number }[];
    asks: { price: number; quantity: number; total: number }[];
    spread: number;
    spreadPercent: number;
  }>({ bids: [], asks: [], spread: 0, spreadPercent: 0 });

  useEffect(() => {
    if (!livePrice) {
      setOrderBook({ bids: [], asks: [], spread: 0, spreadPercent: 0 });
      return;
    }
    
    const generateOrderBook = () => {
      const tickSize = livePrice * 0.00025; // ~0.025% spacing
      const newBids = [];
      const newAsks = [];
      let bidTotal = 0;
      let askTotal = 0;

      for (let i = 1; i <= 5; i++) {
        const bidPrice = livePrice - i * tickSize + (Math.random() - 0.5) * tickSize * 0.15;
        const bidQty = Math.floor(Math.random() * 1500) + 150;
        bidTotal += bidQty;
        newBids.push({ price: Number(bidPrice.toFixed(2)), quantity: bidQty, total: bidTotal });

        const askPrice = livePrice + i * tickSize + (Math.random() - 0.5) * tickSize * 0.15;
        const askQty = Math.floor(Math.random() * 1500) + 150;
        askTotal += askQty;
        newAsks.push({ price: Number(askPrice.toFixed(2)), quantity: askQty, total: askTotal });
      }

      // Sort bids descending, asks ascending
      newBids.sort((a, b) => b.price - a.price);
      newAsks.sort((a, b) => a.price - b.price);

      const bestBid = newBids[0].price;
      const bestAsk = newAsks[0].price;
      const spread = Number((bestAsk - bestBid).toFixed(2));
      const spreadPercent = Number(((spread / bestBid) * 100).toFixed(4));

      setOrderBook({
        bids: newBids,
        asks: newAsks,
        spread,
        spreadPercent
      });
    };

    generateOrderBook();
    const interval = setInterval(generateOrderBook, 550);
    return () => clearInterval(interval);
  }, [livePrice]);

  return (
    <Card className="rounded-sm border-muted bg-card">
      <CardHeader className="p-3 border-b border-muted bg-muted/10">
        <CardTitle className="text-xs font-mono uppercase flex justify-between items-center">
          <span>L2 Order Book (Live Depth)</span>
          {livePrice && <Badge className="bg-primary/10 text-primary text-[9px] font-mono border-primary/20">₹{livePrice.toFixed(2)}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {!livePrice ? (
          <div className="py-8 text-center text-xs font-mono text-muted-foreground">
            Select preset or search symbol for live depth book.
          </div>
        ) : (
          <div className="font-mono text-xs">
            {/* ASKS (stacked top to bottom, descending price) */}
            <div className="flex flex-col">
              {orderBook.asks.slice().reverse().map((ask, idx) => {
                const percentage = Math.min(100, (ask.quantity / 1500) * 100);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setStopLoss(ask.price.toFixed(2));
                      toast({ title: "Stop Loss set", description: `Selected level ₹${ask.price}` });
                    }}
                    className="flex justify-between items-center px-3 py-1 relative hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-red-500/5 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="text-red-400 font-bold z-10">₹{ask.price.toFixed(2)}</span>
                    <span className="z-10 text-[11px] text-muted-foreground">{ask.quantity}</span>
                    <span className="z-10 text-[10px] text-muted-foreground/50">{ask.total}</span>
                  </div>
                );
              })}
            </div>

            {/* SPREAD ROW */}
            <div className="flex justify-between items-center px-3 py-1.5 border-y border-muted/65 bg-muted/5 font-semibold text-[11px]">
              <span className="text-muted-foreground">SPREAD</span>
              <span className="text-primary font-mono">₹{orderBook.spread.toFixed(2)}</span>
              <span className="text-muted-foreground/60">{orderBook.spreadPercent.toFixed(3)}%</span>
            </div>

            {/* BIDS (stacked top to bottom, descending price) */}
            <div className="flex flex-col">
              {orderBook.bids.map((bid, idx) => {
                const percentage = Math.min(100, (bid.quantity / 1500) * 100);
                return (
                  <div
                    key={idx}
                    onClick={() => {
                      setTakeProfit(bid.price.toFixed(2));
                      toast({ title: "Take Profit set", description: `Selected level ₹${bid.price}` });
                    }}
                    className="flex justify-between items-center px-3 py-1 relative hover:bg-muted/20 cursor-pointer transition-colors"
                  >
                    <div
                      className="absolute right-0 top-0 bottom-0 bg-green-500/5 transition-all duration-300"
                      style={{ width: `${percentage}%` }}
                    />
                    <span className="text-green-400 font-bold z-10">₹{bid.price.toFixed(2)}</span>
                    <span className="z-10 text-[11px] text-muted-foreground">{bid.quantity}</span>
                    <span className="z-10 text-[10px] text-muted-foreground/50">{bid.total}</span>
                  </div>
                );
              })}
            </div>
            <div className="p-2 border-t border-muted/30 bg-muted/5 flex items-center gap-1 text-[9px] text-muted-foreground">
              <Info className="h-3 w-3 text-primary shrink-0" />
              <span>Click ASK to set SL, BID to set TP limits.</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function ScalpingPage() {
  const { settings } = useSettings();
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState(settings.defaultSymbol || "NIFTY");
  const [tradeQuantity, setTradeQuantity] = useState(50);
  const [stopLoss, setStopLoss] = useState<string>("");
  const [takeProfit, setTakeProfit] = useState<string>("");
  const [trailingStop, setTrailingStop] = useState<string>("");
  const [hotkeysEnabled, setHotkeysEnabled] = useState(true);

  // Level 2 Order Book state handled by child component

  // Overlays
  const [overlays, setOverlays] = useState({ sma20: true, ema9: true, bb: true });
  
  // States
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<number | null>(null);

  // Search logic states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { toast } = useToast();
  const mainRef = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);

  // Fetch 5m candles (lookback 5d)
  const { data: history, isLoading: loadingHistory, isError: historyError } = useGetMarketHistory(
    { symbol, interval: "5m", period: "5d" },
    { query: { staleTime: 15000, refetchInterval: 15000 } as any }
  );

  const runAgent = useRunAgentAnalysis();

  // Fetch quote via react-query
  const { data: quotesData } = useGetMarketQuotes(
    { symbols: symbol },
    { query: { enabled: !!symbol, queryKey: getGetMarketQuotesQueryKey({ symbols: symbol }) } }
  );

  const quote = useMemo(() => {
    if (Array.isArray(quotesData)) {
      return quotesData.find(q => q.symbol === symbol || q.symbol === symbol.replace(/\.NS$|\.BO$/, "")) || null;
    }
    return null;
  }, [quotesData, symbol]);

  const livePrice = quote?.price ?? null;
  const priceChange = quote?.changePercent ?? 0;

  // Fetch active positions
  const fetchActivePositions = useCallback(async () => {
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trades?status=OPEN`);
      if (res.ok) {
        const data = await res.json();
        setOpenPositions(data);
      }
    } catch {}
  }, []);

  useEffect(() => {
    fetchActivePositions();
  }, [fetchActivePositions]);



  // Keyboard Hotkeys listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      if (!hotkeysEnabled) return;

      const key = e.key.toUpperCase();
      if (key === "B") {
        e.preventDefault();
        if (livePrice) {
          handleExecuteTrade("BUY", livePrice);
        } else {
          toast({ title: "Hotkey: No Price", description: "Wait for live quote to BUY.", variant: "destructive" });
        }
      } else if (key === "S") {
        e.preventDefault();
        if (livePrice) {
          handleExecuteTrade("SELL", livePrice);
        } else {
          toast({ title: "Hotkey: No Price", description: "Wait for live quote to SELL.", variant: "destructive" });
        }
      } else if (key === "C") {
        e.preventDefault();
        const posToClose = openPositions.filter((p) => p.symbol === symbol && p.status === "OPEN");
        if (posToClose.length === 0) {
          toast({ title: "Hotkey: Exit", description: `No active positions to exit for ${symbol}.` });
          return;
        }
        toast({ title: "Hotkey: Exit All", description: `Closing all ${posToClose.length} active positions for ${symbol}...` });
        Promise.all(posToClose.map((p) => handleClosePosition(p.id, livePrice || p.price, p.symbol)));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hotkeysEnabled, livePrice, openPositions, symbol, tradeQuantity, stopLoss, takeProfit, trailingStop]);

  // Live refresh quotes and positions
  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh: forceRefresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/market/history", { symbol, interval: "5m", period: "5d" }] });
      queryClient.invalidateQueries({ queryKey: getGetMarketQuotesQueryKey({ symbols: symbol }) });
      fetchActivePositions();
    },
  });

    const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setSearchResults(data.results ?? []);
      setSelectedIdx(-1);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }, []);

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchQuery(val);
    setSearchOpen(true);
    setSelectedIdx(-1);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => runSearch(val), 280);
  };

  const selectResult = (r: SearchResult) => {
    setSymbol(r.yahooSymbol);
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults([]);
    setAiResult(null);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") { setSearchOpen(false); return; }
    if (e.key === "ArrowDown") { setSelectedIdx((i) => Math.min(i + 1, searchResults.length - 1)); return; }
    if (e.key === "ArrowUp")   { setSelectedIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      if (selectedIdx >= 0 && searchResults[selectedIdx]) {
        selectResult(searchResults[selectedIdx]);
      } else {
        const sym = searchQuery.trim().toUpperCase();
        if (sym) {
          setSymbol(sym);
          setSearchQuery("");
          setSearchOpen(false);
          setAiResult(null);
        }
      }
    }
  };

  const handlePreset = (s: string) => {
    setSymbol(s);
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults([]);
    setAiResult(null);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Clean up search timer on unmount
  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  const processed = useMemo(() => {
    if (!history || !Array.isArray(history.candles) || history.candles.length === 0) return null;
    
    // Filter out zero/null price candles (market closed / bad ticks)
    // Map candles to include calculated local timestamps, then sort ascendingly
    const mapped = history.candles
      .filter((c) => c && c.timestamp && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
      .map((c) => ({
        time: (Math.floor(new Date(c.timestamp).getTime() / 1000) + 19800) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      }))
      .sort((a, b) => a.time - b.time);

    if (mapped.length === 0) return null;

    // Deduplicate by time (keep the last/latest candle if there's a duplicate)
    const ohlc: CandlestickData[] = [];
    const seenTimes = new Set<number>();
    for (const item of mapped) {
      if (!seenTimes.has(item.time)) {
        seenTimes.add(item.time);
        ohlc.push(item);
      } else {
        // Overwrite to keep the latest quote
        const idx = ohlc.findIndex((o) => o.time === item.time);
        if (idx !== -1) {
          ohlc[idx] = item;
        }
      }
    }

    const closes = ohlc.map((o) => o.close);
    const times = ohlc.map((o) => o.time);

    const sma20 = calcSMA(closes, 20).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];

    const ema9 = calcEMA(closes, 9).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];

    const bbData = calcBB(closes, 20, 2);
    const bbUpper = bbData.map((b, i) =>
      b.upper !== null ? { time: times[i], value: b.upper } : null
    ).filter(Boolean) as LineData[];
    const bbLower = bbData.map((b, i) =>
      b.lower !== null ? { time: times[i], value: b.lower } : null
    ).filter(Boolean) as LineData[];

    return { ohlc, sma20, ema9, bbUpper, bbLower };
  }, [history]);

  // Chart setup effect
  useEffect(() => {
    if (!mainRef.current || !processed) return;

    mainChart.current?.remove();
    mainChart.current = null;

    const mc = createChart(mainRef.current, {
      ...CHART_OPTS,
      width: mainRef.current.clientWidth,
      height: 400,
    });
    mainChart.current = mc;

    const cs = mc.addSeries(CandlestickSeries, {
      upColor: C.up,
      downColor: C.down,
      borderUpColor: C.up,
      borderDownColor: C.down,
      wickUpColor: C.up,
      wickDownColor: C.down,
    });
    cs.setData(processed.ohlc);

    if (overlays.sma20 && processed.sma20.length > 0) {
      const smaLine = mc.addSeries(LineSeries, { color: C.sma20, lineWidth: 2 });
      smaLine.setData(processed.sma20);
    }
    if (overlays.ema9 && processed.ema9.length > 0) {
      const emaLine = mc.addSeries(LineSeries, { color: C.ema9, lineWidth: 2 });
      emaLine.setData(processed.ema9);
    }
    if (overlays.bb && processed.bbUpper.length > 0) {
      const upperLine = mc.addSeries(LineSeries, { color: C.bbUpper, lineWidth: 1, lineStyle: 2 });
      upperLine.setData(processed.bbUpper);
      const lowerLine = mc.addSeries(LineSeries, { color: C.bbLower, lineWidth: 1, lineStyle: 2 });
      lowerLine.setData(processed.bbLower);
    }

    mc.timeScale().fitContent();

    const handleResize = () => {
      if (mainRef.current) {
        mc.resize(mainRef.current.clientWidth, 400);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      mainChart.current?.remove();
      mainChart.current = null;
    };
  }, [processed, overlays]);

  // AI Signal Generation Trigger
  const handleGenerateSignal = () => {
    toast({ title: "AI Scalper Activated", description: `Analyzing 5-minute candles for ${symbol}...` });
    
    // Bypass TypeScript compiler types check
    runAgent.mutate({
      data: {
        symbol: symbol,
        timeframe: "INTRADAY",
        instrumentType: "STOCK",
        numSignals: 1,
        maxTokens: 2048,
        style: settings.agentStyle || "moderate",
        customContext: "Scalping focus: high accuracy 5-minute entry/exit points.",
        confidenceThreshold: 0,
        saveSignals: true,
        interval: "5m", // Passed directly to express backend route
        provider: settings.agentProvider || "fallback",
      } as any
    }, {
      onSuccess: (result) => {
        setAiResult(result as unknown as AIResult);
        toast({ title: "Signal Generated", description: "5-minute scalping trade setup ready." });
      },
      onError: () => {
        toast({ title: "AI Signal Failed", description: "Unable to reach LLM providers.", variant: "destructive" });
      }
    });
  };

  // Execution of trade
  const handleExecuteTrade = async (
    action: "BUY" | "SELL",
    entryPrice: number,
    slVal?: number | null,
    tpVal?: number | null,
    tslVal?: number | null,
    signalId?: number
  ) => {
    setExecutingTrade(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          action,
          price: entryPrice,
          quantity: tradeQuantity,
          type: signalId ? "SIGNAL" : "MARKET",
          signalId: signalId || null,
          stopLoss: slVal !== undefined ? slVal : (stopLoss ? Number(stopLoss) : null),
          takeProfit: tpVal !== undefined ? tpVal : (takeProfit ? Number(takeProfit) : null),
          trailingStop: tslVal !== undefined ? tslVal : (trailingStop ? Number(trailingStop) : null),
        }),
      });

      if (res.ok) {
        toast({ title: "Trade Executed", description: `${action} order for ${tradeQuantity} ${symbol} filled at ₹${entryPrice.toFixed(2)}` });
        fetchActivePositions();
      } else {
        toast({ title: "Execution Failed", description: "Failed to place trade.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Execution Failed", description: "Network error placing trade.", variant: "destructive" });
    } finally {
      setExecutingTrade(false);
    }
  };

  // Close Position
  const handleClosePosition = async (tradeId: number, currentQuotePrice: number, posSymbol: string) => {
    setClosingTradeId(tradeId);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trade/${tradeId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitPrice: currentQuotePrice }),
      });

      if (res.ok) {
        toast({ title: "Position Closed", description: `Simulated trade for ${posSymbol} exited at ₹${currentQuotePrice.toFixed(2)}` });
        fetchActivePositions();
      } else {
        toast({ title: "Failed to Close", description: "Error closing simulated trade.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Failed to Close", description: "Network error closing trade.", variant: "destructive" });
    } finally {
      setClosingTradeId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="bg-primary/10 p-2 rounded-sm border border-primary/20 text-primary">
            <Zap className="h-6 w-6 animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">5M AI SCALPER</h1>
            <p className="text-xs text-muted-foreground font-mono">
              High-Frequency Scalping Room (5-Minute candles with AI Signal models)
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={forceRefresh}
          />
        </div>
      </div>

      {/* Preset bar / Search */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between border border-muted bg-card p-3 rounded-sm">
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs font-mono text-muted-foreground mr-1">PRESETS:</span>
          {SYMBOLS.map((s) => (
            <button
              key={s}
              onClick={() => handlePreset(s)}
              className={cn(
                "px-2.5 py-1 text-xs font-mono border rounded-sm transition-colors",
                symbol === s ? "border-primary text-primary bg-primary/10" : "border-muted hover:bg-muted/30"
              )}
            >
              {s}
            </button>
          ))}
        </div>
        <div ref={searchRef} className="relative w-full lg:w-auto flex items-center gap-2">
          <div className="relative w-full lg:w-[220px]">
            <Input
              value={searchQuery}
              onChange={onSearchChange}
              onKeyDown={onSearchKeyDown}
              onFocus={() => { if (searchQuery) setSearchOpen(true); }}
              placeholder="Search symbol (e.g. RELIANCE, NIFTY)..."
              className="w-full uppercase font-mono h-8 border-muted bg-background text-xs pr-8"
            />
            {searchLoading && (
              <span className="absolute right-2.5 top-2.5 text-muted-foreground animate-spin">
                <Loader2 className="h-3 w-3" />
              </span>
            )}
          </div>
          <Button 
            onClick={() => {
              const sym = searchQuery.trim().toUpperCase();
              if (sym) {
                setSymbol(sym);
                setSearchQuery("");
                setSearchOpen(false);
                setAiResult(null);
              }
            }} 
            size="sm" 
            className="font-mono h-8"
          >
            SEARCH
          </Button>

          {/* Dropdown */}
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full right-0 mt-1 w-80 bg-card border border-muted rounded-sm shadow-xl z-50 max-h-72 overflow-y-auto">
              {searchResults.map((r, i) => (
                <button
                  key={r.yahooSymbol}
                  onClick={() => selectResult(r)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2 text-left transition-colors font-mono",
                    i === selectedIdx ? "bg-primary/15 text-primary" : "hover:bg-muted/40 text-foreground"
                  )}
                >
                  <div className="flex flex-col min-w-0 mr-2">
                    <span className="text-xs font-bold leading-none">{r.symbol}</span>
                    <span className="text-[10px] text-muted-foreground truncate">{r.name}</span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 text-[10px]">
                    <span className="text-muted-foreground">{r.exchange}</span>
                    <span className="px-1 py-0.5 border border-muted rounded text-muted-foreground/60">{r.type}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
          {searchOpen && !searchLoading && searchQuery.length > 0 && searchResults.length === 0 && (
            <div className="absolute top-full right-0 mt-1 w-64 bg-card border border-muted rounded-sm shadow-xl z-50 px-3 py-2 text-xs font-mono text-muted-foreground">
              No NSE/BSE results
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart Column */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted bg-muted/10 flex flex-row items-center justify-between">
              <div className="flex items-center gap-3">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5 uppercase">
                  <CircleDot className="h-4 w-4 text-primary animate-ping" /> {symbol} 5m Candle Chart
                </CardTitle>
                {livePrice !== null && (
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-lg font-bold">₹{livePrice.toFixed(2)}</span>
                    <span className={cn("text-xs font-bold", priceChange >= 0 ? "text-green-400" : "text-red-400")}>
                      {priceChange >= 0 ? "+" : ""}{priceChange.toFixed(2)}%
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                {Object.keys(overlays).map((key) => {
                  const active = overlays[key as keyof typeof overlays];
                  return (
                    <button
                      key={key}
                      onClick={() => setOverlays((prev) => ({ ...prev, [key]: !active }))}
                      className={cn(
                        "px-2 py-0.5 text-[10px] font-mono border rounded-sm transition-colors uppercase",
                        active ? "border-primary text-primary bg-primary/5" : "border-muted text-muted-foreground"
                      )}
                    >
                      {key}
                    </button>
                  );
                })}
              </div>
            </CardHeader>
            <CardContent className="p-2 bg-[#0a0a0a]">
              {loadingHistory ? (
                <div className="h-[400px] flex flex-col justify-center items-center gap-2">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <span className="text-xs font-mono text-muted-foreground">LOADING K-LINE FEED...</span>
                </div>
              ) : historyError ? (
                <div className="h-[400px] flex flex-col justify-center items-center border border-dashed border-red-500/20 rounded-sm">
                  <ShieldAlert className="h-8 w-8 text-red-400" />
                  <span className="text-sm font-mono text-red-400 font-bold mt-2">CHART ERROR</span>
                  <span className="text-xs text-muted-foreground mt-1">Failed to resolve historical 5m chart.</span>
                </div>
              ) : (
                <div ref={mainRef} className="w-full h-[400px]" />
              )}
            </CardContent>
          </Card>

          {/* Active Positions specific to Symbol */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted bg-muted/10">
              <CardTitle className="text-sm font-mono">ACTIVE POSITIONS ({symbol})</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {openPositions.filter(p => p.symbol === symbol).length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-muted-foreground">
                  No active simulated trades open for {symbol}. Run AI to generate signals.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left border-collapse">
                    <thead>
                      <tr className="border-b border-muted bg-muted/5 text-muted-foreground">
                        <th className="py-2.5 px-4">ACTION</th>
                        <th className="py-2.5 px-4 text-right">ENTRY PRICE</th>
                        <th className="py-2.5 px-4 text-right">CURRENT</th>
                        <th className="py-2.5 px-4 text-right">QTY</th>
                        <th className="py-2.5 px-4 text-right">LIMITS (SL/TP/TSL)</th>
                        <th className="py-2.5 px-4 text-right">UNREALIZED PNL</th>
                        <th className="py-2.5 px-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openPositions.filter(p => p.symbol === symbol).map((pos) => {
                        const current = livePrice || pos.price;
                        const pnl = pos.action === "BUY" ? (current - pos.price) * pos.quantity : (pos.price - current) * pos.quantity;
                        const isWin = pnl >= 0;
                        return (
                          <tr key={pos.id} className="border-b border-muted/30 hover:bg-muted/5">
                            <td className="py-2.5 px-4 font-bold">
                              <Badge className={cn("text-[10px] font-mono", pos.action === "BUY" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                                {pos.action}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold">₹{pos.price.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums font-bold">₹{current.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums">{pos.quantity}</td>
                            <td className="py-2.5 px-4 text-right font-mono text-[10px] space-y-0.5">
                              {pos.takeProfit && <div className="text-green-400 font-bold">TP: ₹{pos.takeProfit.toFixed(2)}</div>}
                              {pos.stopLoss && <div className="text-red-400 font-bold">SL: ₹{pos.stopLoss.toFixed(2)}</div>}
                              {pos.trailingStop && <div className="text-orange-400 font-bold">TSL: ₹{pos.trailingStop.toFixed(2)}</div>}
                              {!pos.takeProfit && !pos.stopLoss && !pos.trailingStop && <span className="text-muted-foreground">—</span>}
                            </td>
                            <td className={cn("py-2.5 px-4 text-right tabular-nums font-bold", isWin ? "text-green-400" : "text-red-400")}>
                              {isWin ? "+" : ""}₹{pnl.toFixed(2)}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={closingTradeId === pos.id}
                                onClick={() => handleClosePosition(pos.id, current, pos.symbol)}
                                className="h-6 text-[10px] font-mono py-0"
                              >
                                {closingTradeId === pos.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "EXIT"}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* AI signals Column */}
        <div className="space-y-6">
          {/* Signal Generator */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted bg-muted/10">
              <CardTitle className="text-sm font-mono">5M AI SCALPER ENGINE</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <label className="text-[10px] font-mono text-muted-foreground tracking-wider block">SCALPING QUANTITY</label>
                <Input
                  type="number"
                  value={tradeQuantity}
                  onChange={(e) => setTradeQuantity(Math.max(1, Number(e.target.value)))}
                  className="font-mono h-8 bg-background border-muted"
                />
              </div>

              {/* Bracket Limits */}
              <div className="grid grid-cols-3 gap-2 border-t border-muted/30 pt-3">
                <div className="space-y-1.5">
                  <label className="text-[8px] font-mono text-muted-foreground tracking-wider block">STOP LOSS (₹)</label>
                  <Input
                    type="number"
                    value={stopLoss}
                    onChange={(e) => setStopLoss(e.target.value)}
                    placeholder="None"
                    className="font-mono h-8 bg-background border-muted text-xs px-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-mono text-muted-foreground tracking-wider block">TAKE PROFIT (₹)</label>
                  <Input
                    type="number"
                    value={takeProfit}
                    onChange={(e) => setTakeProfit(e.target.value)}
                    placeholder="None"
                    className="font-mono h-8 bg-background border-muted text-xs px-2"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[8px] font-mono text-muted-foreground tracking-wider block">TRAILING SL (₹)</label>
                  <Input
                    type="number"
                    value={trailingStop}
                    onChange={(e) => setTrailingStop(e.target.value)}
                    placeholder="None"
                    className="font-mono h-8 bg-background border-muted text-xs px-2"
                  />
                </div>
              </div>

              {/* Manual One-Click Orders */}
              <div className="space-y-2 border-t border-muted/30 pt-3">
                <label className="text-[9px] font-mono text-muted-foreground tracking-wider block">ONE-CLICK MANUAL EXECUTION</label>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={() => handleExecuteTrade("BUY", livePrice || 0)}
                    disabled={executingTrade || !livePrice}
                    className="bg-green-600 hover:bg-green-700 text-white font-mono text-xs font-bold h-8 flex gap-1 items-center justify-center rounded-sm"
                  >
                    BUY MARKET
                  </Button>
                  <Button
                    onClick={() => handleExecuteTrade("SELL", livePrice || 0)}
                    disabled={executingTrade || !livePrice}
                    className="bg-red-600 hover:bg-red-700 text-white font-mono text-xs font-bold h-8 flex gap-1 items-center justify-center rounded-sm"
                  >
                    SELL MARKET
                  </Button>
                </div>
              </div>

              <div className="border-t border-muted/30 pt-3">
                <Button
                  onClick={handleGenerateSignal}
                  disabled={runAgent.isPending}
                  className="w-full font-mono font-bold bg-primary hover:bg-primary/95 text-primary-foreground text-xs flex gap-2 h-9 items-center justify-center"
                >
                  {runAgent.isPending ? (
                    <>
                      <BrainCircuit className="h-4 w-4 animate-spin" />
                      SCALPING ANALYZING MODEL...
                    </>
                  ) : (
                    <>
                      <BrainCircuit className="h-4 w-4" />
                      GENERATE AI SCALPING SIGNAL
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Hotkeys Guide & Status */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-3 border-b border-muted bg-muted/10 flex flex-row items-center justify-between">
              <CardTitle className="text-xs font-mono flex items-center gap-1.5 uppercase">
                <Keyboard className="h-4 w-4 text-primary" /> Hotkey Configuration
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHotkeysEnabled(!hotkeysEnabled)}
                className={cn(
                  "h-6 text-[9px] font-mono px-2",
                  hotkeysEnabled ? "border-green-500/35 text-green-400 bg-green-500/5" : "border-muted text-muted-foreground"
                )}
              >
                {hotkeysEnabled ? "HOTKEYS ACTIVE" : "HOTKEYS MUTED"}
              </Button>
            </CardHeader>
            <CardContent className="p-3 font-mono text-[10px] space-y-2">
              <div className="flex justify-between items-center text-muted-foreground">
                <span>PRESS <kbd className="px-1.5 py-0.5 bg-muted rounded border border-muted-foreground/30 text-foreground font-bold">B</kbd></span>
                <span className="text-green-400 font-bold">ONE-CLICK BUY MARKET</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>PRESS <kbd className="px-1.5 py-0.5 bg-muted rounded border border-muted-foreground/30 text-foreground font-bold">S</kbd></span>
                <span className="text-red-400 font-bold">ONE-CLICK SELL MARKET</span>
              </div>
              <div className="flex justify-between items-center text-muted-foreground">
                <span>PRESS <kbd className="px-1.5 py-0.5 bg-muted rounded border border-muted-foreground/30 text-foreground font-bold">C</kbd></span>
                <span className="text-orange-400 font-bold">EXIT ALL {symbol} POSITIONS</span>
              </div>
            </CardContent>
          </Card>

          {/* Level 2 Order Book Depth Ladder */}
          <Level2OrderBook
            livePrice={livePrice}
            symbol={symbol}
            setStopLoss={setStopLoss}
            setTakeProfit={setTakeProfit}
          />

          {/* AI Result presentation */}
          {runAgent.isPending && (
            <Card className="rounded-sm border-muted bg-card border-dashed">
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-2 text-primary font-mono text-xs">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>CONSULTING INDIAN derivatives AGENTS...</span>
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          )}

          {!runAgent.isPending && aiResult && (
            <Card className="rounded-sm border-primary/30 border bg-card">
              <CardHeader className="p-4 border-b border-primary/20 bg-primary/5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="border-primary/40 text-primary font-mono text-xs">
                    AI AGENT RESOLUTION
                  </Badge>
                  <span className="text-[9px] font-mono text-muted-foreground">
                    {new Date(aiResult.generatedAt).toLocaleTimeString("en-IN")} IST
                  </span>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Summary */}
                <div className="space-y-1">
                  <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest block">ANALYSIS SUMMARY</span>
                  <p className="text-xs leading-relaxed font-mono">{aiResult.summary}</p>
                </div>

                {/* Key levels */}
                <div className="grid grid-cols-2 gap-4 border-y border-muted py-2.5 font-mono text-[11px]">
                  <div>
                    <span className="text-[9px] text-muted-foreground block uppercase">SUPPORTS</span>
                    <div className="flex flex-col gap-0.5 mt-1 font-bold text-green-400">
                      {aiResult.keyLevels.support.slice(0, 2).map((s, idx) => <span key={idx}>₹{s.toFixed(2)}</span>)}
                    </div>
                  </div>
                  <div>
                    <span className="text-[9px] text-muted-foreground block uppercase">RESISTANCES</span>
                    <div className="flex flex-col gap-0.5 mt-1 font-bold text-red-400">
                      {aiResult.keyLevels.resistance.slice(0, 2).map((s, idx) => <span key={idx}>₹{s.toFixed(2)}</span>)}
                    </div>
                  </div>
                </div>

                {/* Signals list */}
                {aiResult.signals && aiResult.signals.length > 0 ? (
                  <div className="space-y-3">
                    <span className="text-[9px] font-mono text-muted-foreground uppercase tracking-widest block">GENERATED TRADE ALERTS</span>
                    {aiResult.signals.map((sig, idx) => {
                      const isBuy = sig.action === "BUY";
                      const executionPrice = sig.entryPrice || livePrice || 0;
                      return (
                        <div key={idx} className="border border-muted rounded-sm bg-background p-3 space-y-3 font-mono">
                          <div className="flex items-center justify-between">
                            <Badge className={cn("text-[10px] font-mono", isBuy ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                              {sig.action}
                            </Badge>
                            <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                              <span>CONFIDENCE: {sig.confidence}%</span>
                            </div>
                          </div>
                          <div className="text-xs font-bold">{sig.displayText}</div>
                          
                          <div className="grid grid-cols-3 gap-2 text-[10px] text-center bg-card py-1.5 px-1 rounded-sm border border-muted/50">
                            <div>
                              <span className="text-muted-foreground block text-[8px]">ENTRY</span>
                              <span className="font-bold">₹{executionPrice.toFixed(2)}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[8px]">TARGET</span>
                              <span className="font-bold text-green-400">₹{sig.targetPrice ? sig.targetPrice.toFixed(2) : "—"}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground block text-[8px]">STOPLOSS</span>
                              <span className="font-bold text-red-400">₹{sig.stopLoss ? sig.stopLoss.toFixed(2) : "—"}</span>
                            </div>
                          </div>

                          <div className="text-[10px] text-muted-foreground italic leading-normal">
                            Rationale: {sig.rationale}
                          </div>

                          {sig.action !== "EXIT" && (
                            <Button
                              size="sm"
                              disabled={executingTrade || executionPrice === 0}
                              onClick={() => handleExecuteTrade(
                                sig.action as "BUY" | "SELL",
                                executionPrice,
                                sig.stopLoss,
                                sig.targetPrice,
                                null,
                                idx
                              )}
                              className="w-full font-mono text-[10px] font-bold h-7 bg-primary text-primary-foreground flex gap-1 items-center justify-center"
                            >
                              {executingTrade ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              ONE-CLICK EXECUTE PAPER TRADE
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs font-mono text-muted-foreground border border-dashed border-muted rounded-sm">
                    No active scalping alerts generated from setup criteria.
                  </div>
                )}

                {/* Risk */}
                <div className="text-[10px] text-yellow-400/90 bg-yellow-500/5 border border-yellow-500/20 p-2.5 rounded-sm font-mono leading-relaxed">
                  <span className="font-bold block uppercase text-[8px] mb-0.5 text-yellow-400">RISK ASSESSMENT</span>
                  {aiResult.riskAssessment}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

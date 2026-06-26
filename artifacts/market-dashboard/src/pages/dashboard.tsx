import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  useGetMarketIndices, getGetMarketIndicesQueryKey,
  useGetMarketMovers,  getGetMarketMoversQueryKey,
  useGetAnalysisSummary, getGetAnalysisSummaryQueryKey,
  useGetSignals, getGetSignalsQueryKey,
  useGetMarketQuotes, getGetMarketQuotesQueryKey,
  useGetWatchlist, getGetWatchlistQueryKey,
  useAddToWatchlist, useRemoveFromWatchlist
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ArrowDownIcon, ArrowUpIcon, Activity, Plus, X, Search, Loader2, Globe } from "lucide-react";
import { cn } from "@/lib/utils";

type GlobalIndex = {
  id: string;
  symbol: string;
  name: string;
  region: string;
  country: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  price: number;
  change: number;
  changePercent: number;
  status: "OPEN" | "CLOSED" | "PRE_MARKET";
  timestamp: string;
};


// ── Quote type from /api/market/quotes ───────────────────────────────────────

type LiveQuote = {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  open: number;
  high: number;
  low: number;
  volume: number;
};

type SearchResult = { symbol: string; yahooSymbol: string; name: string; exchange: string; type: string };

// ── Symbol search popover ─────────────────────────────────────────────────────

const AddSymbolPopover = React.memo(function AddSymbolPopover({
  pinned,
  onAdd,
  onClose,
}: {
  pinned: string[];
  onAdd: (sym: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selIdx, setSelIdx] = useState(-1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const runSearch = useCallback(async (query: string) => {
    if (!query.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setResults(data.results ?? []);
      setSelIdx(-1);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, []);

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQ(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => runSearch(val), 280);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") { onClose(); return; }
    if (e.key === "ArrowDown") { setSelIdx(i => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === "ArrowUp")   { setSelIdx(i => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter") {
      const r = selIdx >= 0 ? results[selIdx] : results[0];
      if (r) { onAdd(r.yahooSymbol); onClose(); }
      else if (q.trim()) { onAdd(q.trim().toUpperCase()); onClose(); }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/60" onClick={onClose}>
      <div className="bg-card border border-border rounded-sm shadow-2xl w-full max-w-md mx-4" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={onChange}
            onKeyDown={onKeyDown}
            placeholder="Search NSE/BSE symbol… (e.g. WIPRO, HDFC)"
            className="flex-1 bg-transparent text-sm font-mono focus:outline-none placeholder:text-muted-foreground/40"
          />
          {loading && <Loader2 className="h-4 w-4 text-muted-foreground animate-spin shrink-0" />}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Results */}
        {results.length > 0 ? (
          <div className="max-h-72 overflow-y-auto">
            {results.map((r, i) => {
              const alreadyPinned = pinned.includes(r.symbol) || pinned.includes(r.yahooSymbol) || pinned.includes(r.yahooSymbol.split(".")[0]);
              return (
                <button
                  key={r.yahooSymbol}
                  onClick={() => { if (!alreadyPinned) { onAdd(r.yahooSymbol); onClose(); } }}
                  disabled={alreadyPinned}
                  className={cn(
                    "w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors",
                    i === selIdx ? "bg-primary/15" : "hover:bg-muted/40",
                    alreadyPinned && "opacity-40 cursor-not-allowed"
                  )}
                >
                  <div>
                    <div className="text-sm font-mono font-bold">{r.symbol}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-[250px]">{r.name}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 text-xs font-mono">
                    <span className="text-muted-foreground">{r.exchange}</span>
                    <span className="border border-border rounded px-1 py-0.5 text-muted-foreground/60">{r.type}</span>
                    {alreadyPinned && <span className="text-primary">PINNED</span>}
                  </div>
                </button>
              );
            })}
          </div>
        ) : q.length > 0 && !loading ? (
          <div className="px-4 py-3 text-sm font-mono text-muted-foreground">No NSE/BSE results for "{q}"</div>
        ) : (
          <div className="px-4 py-3 text-xs font-mono text-muted-foreground/50">
            Type a company name or ticker · Results filtered to NSE / BSE
          </div>
        )}
      </div>
    </div>
  );
});

// ── Pinned tile ───────────────────────────────────────────────────────────────

const PinnedTile = React.memo(function PinnedTile({ 
  quote, 
  symbol, 
  onRemove, 
  onShowSentiment 
}: { 
  quote: LiveQuote | null; 
  symbol: string; 
  onRemove: (sym: string) => void; 
  onShowSentiment: (data: any) => void;
}) {
  const up = (quote?.changePercent ?? 0) >= 0;
  const [sentimentData, setSentimentData] = useState<any | null>(null);
  const [loadingSentiment, setLoadingSentiment] = useState(false);

  useEffect(() => {
    if (!symbol) return;
    setLoadingSentiment(true);
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/market/news/sentiment?symbol=${encodeURIComponent(symbol)}`)
      .then((res) => res.json())
      .then((data) => setSentimentData(data))
      .catch(() => {})
      .finally(() => setLoadingSentiment(false));
  }, [symbol]);

  return (
    <Card className="rounded-sm border-border bg-card relative group">
      <button
        onClick={() => onRemove(symbol)}
        className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive z-10"
        title="Remove"
      >
        <X className="h-3.5 w-3.5" />
      </button>
      <CardContent className="p-4 flex flex-col justify-between h-full">
        {quote ? (
          <>
            <div className="flex justify-between items-start gap-1">
              <div className="text-sm font-medium text-muted-foreground truncate pr-5">{quote.name || quote.symbol}</div>
              {sentimentData && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onShowSentiment(sentimentData);
                  }}
                  className={cn(
                    "px-1 py-0.5 text-[8px] font-mono font-bold rounded border shrink-0 transition-all hover:brightness-125 hover:scale-105 active:scale-95",
                    sentimentData.sentiment === "BULLISH" ? "border-green-500/30 bg-green-500/10 text-success" :
                    sentimentData.sentiment === "BEARISH" ? "border-red-500/30 bg-red-500/10 text-destructive" :
                    "border-muted bg-muted/20 text-muted-foreground"
                  )}
                  title="Click to view AI Sentiment analysis"
                >
                  {sentimentData.sentiment}
                </button>
              )}
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <div className="text-xl font-bold font-mono">{quote.price.toFixed(2)}</div>
              <div className={cn("flex items-center text-sm font-mono", up ? "text-success" : "text-destructive")}>
                {up ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                {Math.abs(quote.changePercent).toFixed(2)}%
              </div>
            </div>
            <div className="text-[10px] font-mono text-muted-foreground/60 mt-1">
              O:{quote.open.toFixed(0)} H:{quote.high.toFixed(0)} L:{quote.low.toFixed(0)}
            </div>
          </>
        ) : (
          <>
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-6 w-28" />
          </>
        )}
      </CardContent>
    </Card>
  );
});

// ── Sentiment Modal ────────────────────────────────────────────────────────────

const SentimentModal = React.memo(function SentimentModal({ data, onClose }: { data: any; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div 
        className="bg-card border border-border rounded-sm shadow-2xl w-full max-w-lg mx-auto overflow-hidden font-mono text-xs" 
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm text-foreground">{data.symbol} AI CATALYST SCANNER</span>
            <Badge variant="outline" className={cn(
              "font-mono text-[9px] border-0 rounded-sm px-2 py-0.5",
              data.sentiment === "BULLISH" ? "bg-success/20 text-success" :
              data.sentiment === "BEARISH" ? "bg-destructive/20 text-destructive" :
              "bg-muted text-muted-foreground"
            )}>
              {data.sentiment} ({data.score})
            </Badge>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Sentiment Meter */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-[10px] text-muted-foreground uppercase font-bold">
              <span>Sentiment Strength</span>
              <span>{data.score}/100</span>
            </div>
            <div className="h-1.5 w-full bg-muted/40 rounded-full overflow-hidden flex">
              <div
                style={{ 
                  width: `${data.score}%`, 
                  backgroundColor: data.sentiment === "BULLISH" ? "#22c55e" : data.sentiment === "BEARISH" ? "#ef4444" : "#888888" 
                }} 
                className="h-full rounded-full" 
              />
            </div>
          </div>

          {/* AI Summary */}
          <div className="bg-muted/10 border border-muted/50 p-3 rounded-sm space-y-1">
            <div className="text-[10px] text-muted-foreground uppercase font-bold">AI Catalyst Analysis</div>
            <p className="text-foreground leading-relaxed">{data.summary}</p>
          </div>

          {/* Catalysts & Risks */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-[10px] text-success font-bold uppercase flex items-center gap-1">
                <span>▲ POSITIVE CATALYSTS</span>
              </div>
              <ul className="space-y-1.5 pl-3 list-disc text-muted-foreground">
                {data.catalysts.map((c: string, i: number) => <li key={i}>{c}</li>)}
                {data.catalysts.length === 0 && <span className="text-muted-foreground/40 italic">None identified</span>}
              </ul>
            </div>
            <div className="space-y-2">
              <div className="text-[10px] text-destructive font-bold uppercase flex items-center gap-1">
                <span>▼ DOWNSIDE RISKS</span>
              </div>
              <ul className="space-y-1.5 pl-3 list-disc text-muted-foreground">
                {data.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
                {data.risks.length === 0 && <span className="text-muted-foreground/40 italic">None identified</span>}
              </ul>
            </div>
          </div>

          {/* Headlines */}
          {data.headlines && data.headlines.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-muted">
              <div className="text-[10px] text-muted-foreground uppercase font-bold">RECENT HEADLINES SCANNER</div>
              <div className="space-y-2.5">
                {data.headlines.map((h: any, i: number) => (
                  <div key={i} className="flex flex-col gap-1 border-l-2 border-muted pl-2 py-0.5 hover:border-primary/50 transition-colors">
                    <a href={h.link} target="_blank" rel="noopener noreferrer" className="font-bold text-foreground hover:text-primary transition-colors text-xs">
                      {h.title}
                    </a>
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground/60">
                      <span>Publisher: {h.publisher}</span>
                      <span>{new Date(h.time * 1000).toLocaleString("en-IN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "short" })}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

// ── Dashboard ─────────────────────────────────────────────────────────────────

export default function Dashboard() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [executingId, setExecutingId] = useState<number | null>(null);

  const handleExecutePaperTrade = async (signal: any) => {
    if (!signal.entryPrice) {
      toast({ title: "Execution Failed", description: "Entry price is not available for this signal.", variant: "destructive" });
      return;
    }
    setExecutingId(signal.id);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: signal.symbol.toUpperCase(),
          action: signal.action.toUpperCase(),
          price: Number(signal.entryPrice),
          quantity: 50,
          type: "SIGNAL",
          signalId: signal.id
        })
      });

      if (res.ok) {
        toast({
          title: "Simulated Trade Placed",
          description: `Simulated ${signal.action} order for 50 ${signal.symbol} filled at ₹${signal.entryPrice.toFixed(2)}`
        });
      } else {
        const err = await res.json();
        toast({ title: "Execution Failed", description: err.error || "Failed to place simulated trade.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Execution Failed", description: "Network error submitting simulated trade.", variant: "destructive" });
    } finally {
      setExecutingId(null);
    }
  };

  const { data: indices, isLoading: loadingIndices } = useGetMarketIndices();
  const { data: movers,  isLoading: loadingMovers  } = useGetMarketMovers();
  const { data: summary, isLoading: loadingSummary } = useGetAnalysisSummary();
  const { data: signals, isLoading: loadingSignals } = useGetSignals({ status: "ACTIVE" });

  const { data: globalIndices, isLoading: loadingGlobal } = useQuery<GlobalIndex[]>({
    queryKey: ["/api/market/global"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/global`);
      if (!res.ok) throw new Error("Failed to fetch global indices");
      return res.json();
    },
    refetchInterval: 60000,
  });

  // ── Pinned symbols state (Unified with Watchlist) ────────────────────────────
  const { data: watchlistData, isLoading: watchlistLoading } = useGetWatchlist();
  const addWatchlistMutation = useAddToWatchlist();
  const removeWatchlistMutation = useRemoveFromWatchlist();

  const [showSearch, setShowSearch] = useState(false);
  const [selectedSentiment, setSelectedSentiment] = useState<any | null>(null);

  const pins = useMemo(() => {
    if (!Array.isArray(watchlistData)) return [];
    return watchlistData.map((item) => item.symbol);
  }, [watchlistData]);

  const pinsSymbols = useMemo(() => {
    if (!Array.isArray(watchlistData)) return "";
    return watchlistData.map((item) => `${item.symbol}:${item.exchange}`).join(",");
  }, [watchlistData]);

  const addPin = (symOrResult: string | any) => {
    let symbolStr = "";
    let nameStr = "";
    let exchangeStr = "NSE";

    if (typeof symOrResult === "string") {
      const parts = symOrResult.split(".");
      symbolStr = parts[0].toUpperCase();
      nameStr = `${symbolStr} Stock`;
      exchangeStr = parts[1] === "BO" ? "BSE" : "NSE";
    } else {
      symbolStr = symOrResult.symbol.toUpperCase();
      nameStr = symOrResult.name || `${symOrResult.symbol} Stock`;
      exchangeStr = symOrResult.exchange || "NSE";
    }

    addWatchlistMutation.mutate(
      {
        data: {
          symbol: symbolStr,
          name: nameStr,
          exchange: exchangeStr as any,
          instrumentType: "STOCK",
        }
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
          toast({ title: "Pinned to Watchlist", description: `${symbolStr} added.` });
        }
      }
    );
  };

  const removePin = useCallback((sym: string) => {
    const item = watchlistData?.find((w) => w.symbol.toUpperCase() === sym.toUpperCase());
    if (item) {
      removeWatchlistMutation.mutate(
        { id: item.id },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetWatchlistQueryKey() });
            toast({ title: "Removed from Watchlist", description: `${sym} removed.` });
          }
        }
      );
    }
  }, [watchlistData, removeWatchlistMutation, queryClient, toast]);

  const { data: pinnedQuotesData, isLoading: quotesLoading } = useGetMarketQuotes(
    { symbols: pinsSymbols },
    { query: { enabled: !!pinsSymbols, queryKey: getGetMarketQuotesQueryKey({ symbols: pinsSymbols }) } }
  );

  const pinnedQuotes = useMemo(() => {
    const map: Record<string, LiveQuote> = {};
    if (Array.isArray(pinnedQuotesData)) {
      for (const q of pinnedQuotesData) {
        if (q && q.symbol) {
          map[q.symbol] = q as LiveQuote;
        }
      }
    }
    return map;
  }, [pinnedQuotesData]);

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetMarketIndicesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetMarketMoversQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetAnalysisSummaryQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetSignalsQueryKey({ status: "ACTIVE" }) });
      if (pinsSymbols) {
        queryClient.invalidateQueries({ queryKey: getGetMarketQuotesQueryKey({ symbols: pinsSymbols }) });
      }
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono">LIVE DASHBOARD</h1>
          <LiveRefreshBar
          isMarketOpen={isMarketOpen}
          isPreOpen={isPreOpen}
          lastUpdatedIST={lastUpdatedIST}
          countdown={countdown}
          onRefresh={refresh}
        />
      </div>

      {/* Indices + Pinned row */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider">INDICES</div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {loadingIndices
            ? Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="rounded-sm border-muted">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                  </CardContent>
                </Card>
              ))
            : Array.isArray(indices)
            ? indices.map((idx) => (
                <Card key={idx.symbol} className="rounded-sm border-muted bg-card">
                  <CardContent className="p-4 flex flex-col justify-between h-full">
                    <div className="text-sm font-medium text-muted-foreground">{idx.name}</div>
                    <div className="flex items-baseline justify-between mt-2">
                      <div className="text-2xl font-bold font-mono">{idx.value.toFixed(2)}</div>
                      <div className={cn("flex items-center text-sm font-mono", idx.change >= 0 ? "text-success" : "text-destructive")}>
                        {idx.change >= 0 ? <ArrowUpIcon className="h-3 w-3 mr-1" /> : <ArrowDownIcon className="h-3 w-3 mr-1" />}
                        {Math.abs(idx.changePercent).toFixed(2)}%
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            : null
          }
        </div>

        {/* Pinned custom symbols */}
        {pins.length >= 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                WATCHLIST
                {quotesLoading && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <button
                onClick={() => setShowSearch(true)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground border border-border rounded-sm px-2 py-1 hover:text-primary hover:border-primary transition-colors"
              >
                <Plus className="h-3 w-3" /> ADD SYMBOL
              </button>
            </div>

            {pins.length === 0 ? (
              <button
                onClick={() => setShowSearch(true)}
                className="w-full flex items-center justify-center gap-2 border border-dashed border-border rounded-sm py-4 text-xs font-mono text-muted-foreground hover:border-primary hover:text-primary transition-colors"
              >
                <Plus className="h-4 w-4" />
                Search and pin any NSE / BSE symbol
              </button>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
                {Array.isArray(watchlistData) && watchlistData.map(item => (
                  <PinnedTile
                    key={item.id}
                    symbol={item.symbol}
                    quote={pinnedQuotes[item.symbol] ?? null}
                    onRemove={removePin}
                    onShowSentiment={setSelectedSentiment}
                  />
                ))}
                {/* Add more button */}
                <button
                  onClick={() => setShowSearch(true)}
                  className="flex flex-col items-center justify-center gap-1.5 border border-dashed border-border rounded-sm py-4 text-xs font-mono text-muted-foreground hover:border-primary hover:text-primary transition-colors min-h-[80px]"
                >
                  <Plus className="h-5 w-5" />
                  ADD
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Global Markets Horizontal Ticker */}
      <Card className="rounded-sm border-muted bg-card">
        <CardContent className="p-0">
          {loadingGlobal ? (
            <div className="flex px-4 py-3 items-center gap-4 animate-pulse">
              <Globe className="h-4 w-4 text-muted-foreground" />
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-4 w-24 bg-muted rounded"></div>
              <div className="h-4 w-24 bg-muted rounded"></div>
            </div>
          ) : globalIndices && globalIndices.length > 0 ? (
            <div className="flex items-center overflow-x-auto whitespace-nowrap hide-scrollbar py-3 px-4 border-l-2 border-l-primary/50">
              <div className="flex items-center gap-2 mr-6 text-xs font-bold font-mono text-muted-foreground shrink-0">
                <Globe className="h-3.5 w-3.5" /> GLOBAL
              </div>
              <div className="flex items-center gap-6">
                {globalIndices.map(idx => {
                  const isUp = idx.change >= 0;
                  return (
                    <div key={idx.id} className="flex items-center gap-2 text-xs font-mono shrink-0">
                      <span className="font-bold">{idx.name}</span>
                      <span>{idx.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                      <span className={cn("flex items-center", isUp ? "text-green-500" : "text-red-500")}>
                        {isUp ? <ArrowUpIcon className="h-3 w-3" /> : <ArrowDownIcon className="h-3 w-3" />}
                        {idx.changePercent.toFixed(2)}%
                      </span>
                      <Badge variant="outline" className={cn(
                        "ml-1 text-[8px] h-4 px-1 rounded-sm border-0 font-bold",
                        idx.status === "OPEN" ? "bg-green-500/20 text-green-400" :
                        idx.status === "PRE_MARKET" ? "bg-yellow-500/20 text-yellow-500" :
                        "bg-muted text-muted-foreground opacity-50"
                      )}>
                        {idx.status}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* Market Breadth + Top Movers */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="rounded-sm border-muted col-span-1">
          <CardHeader className="p-4 border-b border-muted">
            <CardTitle className="text-sm font-mono">MARKET BREADTH</CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            {loadingSummary ? (
              <Skeleton className="h-32 w-full" />
            ) : summary ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">Total Analyzed</span>
                  <span className="font-mono">{summary.totalSymbols}</span>
                </div>
                <div className="flex h-2 w-full rounded-full overflow-hidden">
                  <div style={{ width: `${(summary.bullish / summary.totalSymbols) * 100}%` }} className="bg-success" />
                  <div style={{ width: `${(summary.neutral / summary.totalSymbols) * 100}%` }} className="bg-muted" />
                  <div style={{ width: `${(summary.bearish / summary.totalSymbols) * 100}%` }} className="bg-destructive" />
                </div>
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-success">{summary.bullish} BULLISH</span>
                  <span className="text-muted-foreground">{summary.neutral} NEUTRAL</span>
                  <span className="text-destructive">{summary.bearish} BEARISH</span>
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-sm border-muted col-span-1 md:col-span-2">
          <CardHeader className="p-4 border-b border-muted">
            <CardTitle className="text-sm font-mono">TOP GAINERS / LOSERS</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loadingMovers ? (
              <div className="p-4 space-y-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : movers ? (
              <div className="grid grid-cols-2 divide-x divide-muted">
                <div className="p-2 space-y-1">
                  {movers.gainers.slice(0, 5).map(g => (
                    <div key={g.symbol} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-sm">
                      <span className="font-bold text-sm">{g.symbol}</span>
                      <span className="text-success font-mono text-sm">+{g.changePercent.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
                <div className="p-2 space-y-1">
                  {movers.losers.slice(0, 5).map(l => (
                    <div key={l.symbol} className="flex justify-between items-center p-2 hover:bg-muted/50 rounded-sm">
                      <span className="font-bold text-sm">{l.symbol}</span>
                      <span className="text-destructive font-mono text-sm">{l.changePercent.toFixed(2)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="p-4 text-sm text-muted-foreground">No data available</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Signals */}
      <Card className="rounded-sm border-muted">
        <CardHeader className="p-4 border-b border-muted">
          <CardTitle className="text-sm font-mono">ACTIVE SIGNALS</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingSignals ? (
            <div className="p-4 space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : signals && signals.length > 0 ? (
            <div className="divide-y divide-muted">
              {signals.slice(0, 10).map(signal => (
                <div key={signal.id} className="p-4 flex items-center justify-between hover:bg-muted/20">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className={cn(
                      "font-mono rounded-sm border-0 px-2 py-1",
                      signal.action === "BUY"  ? "bg-success/20 text-success" :
                      signal.action === "SELL" ? "bg-destructive/20 text-destructive" :
                      "bg-warning/20 text-warning"
                    )}>
                      {signal.action}
                    </Badge>
                    <div>
                      <div className="font-bold">{signal.displayText}</div>
                      <div className="text-xs text-muted-foreground mt-1">{signal.rationale}</div>
                    </div>
                  </div>
                  <div className="text-right flex items-center gap-6">
                    <div className="text-xs font-mono text-muted-foreground">ENTRY: {signal.entryPrice ?? "—"}</div>
                    <div className="text-xs font-mono text-muted-foreground">TARGET: <span className="text-success">{signal.targetPrice ?? "—"}</span></div>
                    <div className="text-xs font-mono text-muted-foreground">SL: <span className="text-destructive">{signal.stopLoss ?? "—"}</span></div>
                    {signal.action !== "EXIT" && signal.entryPrice && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={executingId === signal.id}
                        onClick={() => handleExecutePaperTrade(signal)}
                        className="h-7 font-mono text-[10px] font-bold px-3 border-muted bg-card hover:bg-primary/10 hover:text-primary transition-colors"
                      >
                        {executingId === signal.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "EXECUTE"}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center text-muted-foreground font-mono text-sm">NO ACTIVE SIGNALS</div>
          )}
        </CardContent>
      </Card>

      {/* Search modal */}
      {showSearch && (
        <AddSymbolPopover
          pinned={pins}
          onAdd={addPin}
          onClose={() => setShowSearch(false)}
        />
      )}

      {/* Sentiment modal */}
      {selectedSentiment && (
        <SentimentModal
          data={selectedSentiment}
          onClose={() => setSelectedSentiment(null)}
        />
      )}
    </div>
  );
}

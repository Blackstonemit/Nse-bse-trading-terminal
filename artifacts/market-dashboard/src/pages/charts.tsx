import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  createChart,
  ColorType,
  CrosshairMode,
  CandlestickSeries,
  LineSeries,
  HistogramSeries,
  AreaSeries,
  type IChartApi,
  type CandlestickData,
  type HistogramData,
  type LineData,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  useGetMarketHistory,
  GetMarketHistoryInterval,
  GetMarketHistoryPeriod,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";

import { cn } from "@/lib/utils";
import {
  CandlestickChart,
  TrendingUp,
  TrendingDown,
  Minus,
  Search,
  Loader2,
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";


// ── Symbol presets ────────────────────────────────────────────────────────────

type Preset = { label: string; apiSymbol: string; tag: string };

const PRESETS: Preset[] = [
  { label: "NIFTY 50",   apiSymbol: "NIFTY",     tag: "IDX" },
  { label: "BANKNIFTY",  apiSymbol: "BANKNIFTY",  tag: "IDX" },
  { label: "FINNIFTY",   apiSymbol: "FINNIFTY",   tag: "IDX" },
  { label: "SENSEX",     apiSymbol: "SENSEX",     tag: "IDX" },
  { label: "RELIANCE",   apiSymbol: "RELIANCE",   tag: "STK" },
  { label: "TCS",        apiSymbol: "TCS",        tag: "STK" },
  { label: "HDFCBANK",   apiSymbol: "HDFCBANK",   tag: "STK" },
  { label: "INFY",       apiSymbol: "INFY",       tag: "STK" },
  { label: "ICICIBANK",  apiSymbol: "ICICIBANK",  tag: "STK" },
  { label: "SBIN",       apiSymbol: "SBIN",       tag: "STK" },
];

// ── Interval config ───────────────────────────────────────────────────────────

type IntervalCfg = {
  label: string;
  apiInterval: GetMarketHistoryInterval;
  apiPeriod: GetMarketHistoryPeriod;
};

const INTERVALS: IntervalCfg[] = [
  { label: "1m",  apiInterval: "1m",  apiPeriod: "1d"  },
  { label: "5m",  apiInterval: "5m",  apiPeriod: "5d"  },
  { label: "15m", apiInterval: "15m", apiPeriod: "5d"  },
  { label: "1H",  apiInterval: "1h",  apiPeriod: "1mo" },
  { label: "1D",  apiInterval: "1d",  apiPeriod: "1y"  },
];

// ── Chart styles ──────────────────────────────────────────────────────────────

type ChartStyle = "candles" | "line" | "area";

// ── Technical indicator helpers ───────────────────────────────────────────────

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

function calcRSI(closes: number[], period = 14): (number | null)[] {
  const result: (number | null)[] = new Array(closes.length).fill(null);
  let avgGain = 0, avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) avgGain += diff; else avgLoss -= diff;
  }
  avgGain /= period; avgLoss /= period;
  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

// ── Colors ────────────────────────────────────────────────────────────────────

const C = {
  bg:           "#0a0a0a",
  grid:         "#1c1c1c",
  border:       "#2a2a2a",
  text:         "#888",
  up:           "#22c55e",
  down:         "#ef4444",
  upBg:         "rgba(34,197,94,0.10)",
  downBg:       "rgba(239,68,68,0.10)",
  sma20:        "#f59e0b",
  ema9:         "#818cf8",
  bbUpper:      "rgba(99,102,241,0.5)",
  bbMid:        "rgba(99,102,241,0.3)",
  bbLower:      "rgba(99,102,241,0.5)",
  vol:          "rgba(100,116,139,0.5)",
  rsi:          "#22d3ee",
  rsiOB:        "rgba(239,68,68,0.15)",
  rsiOS:        "rgba(34,197,94,0.15)",
};

const CHART_OPTS = {
  layout: { background: { type: ColorType.Solid, color: C.bg }, textColor: C.text },
  grid: { vertLines: { color: C.grid }, horzLines: { color: C.grid } },
  crosshair: { mode: CrosshairMode.Normal },
  rightPriceScale: { borderColor: C.border },
  timeScale: { borderColor: C.border, timeVisible: true, secondsVisible: false },
};

// ── Overlay toggles ───────────────────────────────────────────────────────────

type OverlayKey = "sma20" | "ema9" | "bb" | "vol" | "rsi";

const OVERLAY_LABELS: Record<OverlayKey, string> = {
  sma20: "SMA 20",
  ema9:  "EMA 9",
  bb:    "Bollinger",
  vol:   "Volume",
  rsi:   "RSI 14",
};

// ── Search result type ────────────────────────────────────────────────────────
type SearchResult = {
  symbol: string;
  yahooSymbol: string;
  name: string;
  exchange: string;
  type: string;
};

// ── Main component ────────────────────────────────────────────────────────────

export function ChartCellComponent({
  id,
  initialSymbol,
  initialInterval,
  initialPeriod,
  onUpdate,
}: {
  id: string;
  initialSymbol: string;
  initialInterval: GetMarketHistoryInterval;
  initialPeriod: GetMarketHistoryPeriod;
  onUpdate?: (symbol: string, interval: GetMarketHistoryInterval, period: GetMarketHistoryPeriod) => void;
}) {
  const [symbol, setSymbol] = useState(initialSymbol);
  const [intervalCfg, setIntervalCfg] = useState<IntervalCfg>(() => 
    INTERVALS.find(i => i.apiInterval === initialInterval) || INTERVALS[1]
  );
  const [chartStyle, setChartStyle] = useState<ChartStyle>("candles");
  const [overlays, setOverlays] = useState<Record<OverlayKey, boolean>>({
    sma20: true, ema9: true, bb: false, vol: true, rsi: true,
  });

  const [searchQuery, setSearchQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const { data: history, isLoading, isError, refetch } = useGetMarketHistory(
    { symbol, interval: intervalCfg.apiInterval, period: intervalCfg.apiPeriod },
    { query: { staleTime: 60_000 } as any }
  );

  const { countdown, refresh } = useLiveRefresh({
    onRefresh: () => { refetch(); },
  });

  const mainRef = useRef<HTMLDivElement>(null);
  const rsiRef = useRef<HTMLDivElement>(null);
  const mainChart = useRef<IChartApi | null>(null);
  const rsiChart = useRef<IChartApi | null>(null);

  const processed = useMemo(() => {
    if (!history || !Array.isArray(history.candles) || history.candles.length === 0) return null;
    const mapped = history.candles
      .filter((c) => c && c.timestamp && c.open > 0 && c.high > 0 && c.low > 0 && c.close > 0)
      .map((c) => ({
        timestamp: c.timestamp,
        time: (Math.floor(new Date(c.timestamp).getTime() / 1000) + 19800) as UTCTimestamp,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        volume: c.volume,
      }))
      .sort((a, b) => a.time - b.time);

    if (mapped.length === 0) return null;

    const deduplicated: typeof mapped = [];
    const seenTimes = new Set<number>();
    for (const item of mapped) {
      if (!seenTimes.has(item.time)) {
        seenTimes.add(item.time);
        deduplicated.push(item);
      } else {
        const idx = deduplicated.findIndex((o) => o.time === item.time);
        if (idx !== -1) {
          deduplicated[idx] = item;
        }
      }
    }

    const times = deduplicated.map((d) => d.time);
    const closes = deduplicated.map((d) => d.close);

    const ohlc: CandlestickData[] = deduplicated.map((d) => ({
      time: d.time,
      open: d.open,
      high: d.high,
      low: d.low,
      close: d.close,
    }));

    const volume: HistogramData[] = deduplicated.map((d) => ({
      time: d.time,
      value: d.volume,
      color: d.close >= d.open ? C.upBg : C.downBg,
    }));

    const sma20Data: LineData[] = calcSMA(closes, 20).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];

    const ema9Data: LineData[] = calcEMA(closes, 9).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];

    const bbData = calcBB(closes);
    const bbUpper: LineData[] = bbData.map((b, i) =>
      b.upper !== null ? { time: times[i], value: b.upper } : null
    ).filter(Boolean) as LineData[];
    const bbMid: LineData[] = bbData.map((b, i) =>
      b.mid !== null ? { time: times[i], value: b.mid } : null
    ).filter(Boolean) as LineData[];
    const bbLower: LineData[] = bbData.map((b, i) =>
      b.lower !== null ? { time: times[i], value: b.lower } : null
    ).filter(Boolean) as LineData[];

    const rsiData: LineData[] = calcRSI(closes).map((v, i) =>
      v !== null ? { time: times[i], value: v } : null
    ).filter(Boolean) as LineData[];

    const last = deduplicated[deduplicated.length - 1];
    const prev = deduplicated[deduplicated.length - 2];
    const chg = last && prev ? last.close - prev.close : 0;
    const chgPct = prev ? (chg / prev.close) * 100 : 0;

    return { ohlc, volume, sma20Data, ema9Data, bbUpper, bbMid, bbLower, rsiData, last, chg, chgPct };
  }, [history]);

  useEffect(() => {
    if (!mainRef.current || !processed) return;

    mainChart.current?.remove();
    rsiChart.current?.remove();
    mainChart.current = null;
    rsiChart.current = null;

    const mc = createChart(mainRef.current, {
      ...CHART_OPTS,
      width: mainRef.current.clientWidth,
      height: mainRef.current.clientHeight,
    });
    mainChart.current = mc;

    if (chartStyle === "candles") {
      const cs = mc.addSeries(CandlestickSeries, {
        upColor: C.up, downColor: C.down,
        borderUpColor: C.up, borderDownColor: C.down,
        wickUpColor: C.up, wickDownColor: C.down,
      });
      cs.setData(processed.ohlc);
    } else if (chartStyle === "line") {
      const ls = mc.addSeries(LineSeries, { color: C.up, lineWidth: 2 });
      ls.setData(processed.ohlc.map((d) => ({ time: d.time, value: d.close })));
    } else {
      const as = mc.addSeries(AreaSeries, {
        lineColor: C.up, topColor: "rgba(34,197,94,0.25)",
        bottomColor: "rgba(34,197,94,0.02)", lineWidth: 2,
      });
      as.setData(processed.ohlc.map((d) => ({ time: d.time, value: d.close })));
    }

    if (overlays.sma20) {
      const s = mc.addSeries(LineSeries, { color: C.sma20, lineWidth: 1, title: "SMA 20" });
      s.setData(processed.sma20Data);
    }
    if (overlays.ema9) {
      const s = mc.addSeries(LineSeries, { color: C.ema9, lineWidth: 1, title: "EMA 9" });
      s.setData(processed.ema9Data);
    }
    if (overlays.bb) {
      const u = mc.addSeries(LineSeries, { color: C.bbUpper, lineWidth: 1, lineStyle: 2, title: "BB Upper" });
      const m = mc.addSeries(LineSeries, { color: C.bbMid,   lineWidth: 1, lineStyle: 3, title: "BB Mid"   });
      const l = mc.addSeries(LineSeries, { color: C.bbLower, lineWidth: 1, lineStyle: 2, title: "BB Lower" });
      u.setData(processed.bbUpper);
      m.setData(processed.bbMid);
      l.setData(processed.bbLower);
    }

    if (overlays.vol) {
      const vs = mc.addSeries(HistogramSeries, {
        priceFormat: { type: "volume" },
        priceScaleId: "vol",
      });
      mc.priceScale("vol").applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } });
      vs.setData(processed.volume);
    }

    mc.timeScale().fitContent();

    if (overlays.rsi && rsiRef.current) {
      const rc = createChart(rsiRef.current, {
        ...CHART_OPTS,
        width: rsiRef.current.clientWidth,
        height: rsiRef.current.clientHeight,
        rightPriceScale: { ...CHART_OPTS.rightPriceScale, scaleMargins: { top: 0.1, bottom: 0.1 } },
        timeScale: { ...CHART_OPTS.timeScale, visible: false },
      });
      rsiChart.current = rc;

      const rs = rc.addSeries(LineSeries, { color: C.rsi, lineWidth: 2, title: "RSI 14" });
      rs.setData(processed.rsiData);

      const ob70 = rc.addSeries(LineSeries, { color: "rgba(239,68,68,0.5)", lineWidth: 1, lineStyle: 2 });
      ob70.setData(processed.rsiData.map((d) => ({ time: d.time, value: 70 })));
      const os30 = rc.addSeries(LineSeries, { color: "rgba(34,197,94,0.5)", lineWidth: 1, lineStyle: 2 });
      os30.setData(processed.rsiData.map((d) => ({ time: d.time, value: 30 })));

      rc.timeScale().fitContent();

      mc.subscribeCrosshairMove((p) => {
        if (!p.time) return;
        rc.setCrosshairPosition(0, p.time as UTCTimestamp, rs);
      });
    }

    const ro = new ResizeObserver(() => {
      if (mainRef.current) mc.applyOptions({ width: mainRef.current.clientWidth, height: mainRef.current.clientHeight });
      if (rsiRef.current && rsiChart.current) rsiChart.current.applyOptions({ width: rsiRef.current.clientWidth, height: rsiRef.current.clientHeight });
    });
    if (mainRef.current) ro.observe(mainRef.current);
    if (rsiRef.current) ro.observe(rsiRef.current);

    return () => {
      ro.disconnect();
      mainChart.current?.remove();
      rsiChart.current?.remove();
      mainChart.current = null;
      rsiChart.current = null;
    };
  }, [processed, chartStyle, overlays]);

  const toggleOverlay = (k: OverlayKey) =>
    setOverlays((prev) => ({ ...prev, [k]: !prev[k] }));

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
    setSymbol(r.symbol);
    setSearchQuery("");
    setSearchOpen(false);
    setSearchResults([]);
    onUpdate?.(r.yahooSymbol, intervalCfg.apiInterval, intervalCfg.apiPeriod);
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
          onUpdate?.(sym, intervalCfg.apiInterval, intervalCfg.apiPeriod);
        }
      }
    }
  };

  const handleIntervalChange = (cfg: IntervalCfg) => {
    setIntervalCfg(cfg);
    onUpdate?.(symbol, cfg.apiInterval, cfg.apiPeriod);
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  return (
    <div className="flex flex-col bg-[#0a0a0a] border border-[#1c1c1c] h-full rounded-sm overflow-hidden relative">
      {/* Cell Header Toolbar */}
      <div className="flex items-center justify-between px-2 py-1 bg-[#0d0d0d] border-b border-[#1c1c1c] text-[10px] font-mono shrink-0 flex-wrap gap-1">
        <div ref={searchRef} className="relative flex items-center gap-1.5 z-30">
          <span className="font-bold text-foreground text-xs uppercase">{symbol}</span>
          <div className="flex items-center border border-[#2a2a2a] rounded bg-[#111] px-1 py-0.5">
            <Search className="h-3 w-3 text-[#444] shrink-0" />
            <input
              value={searchQuery}
              onChange={onSearchChange}
              onKeyDown={onSearchKeyDown}
              onFocus={() => { if (searchQuery) setSearchOpen(true); }}
              placeholder="Symbol..."
              className="w-14 h-3 text-[9px] font-mono bg-transparent text-[#aaa] placeholder:text-[#444] focus:outline-none"
            />
            {searchLoading && <Loader2 className="h-2.5 w-2.5 text-[#444] animate-spin ml-0.5" />}
          </div>
          {searchOpen && searchResults.length > 0 && (
            <div className="absolute top-full left-0 mt-0.5 w-56 bg-[#111] border border-[#2a2a2a] rounded shadow-xl z-50 overflow-hidden">
              {searchResults.map((r, i) => (
                <button
                  key={r.yahooSymbol}
                  onClick={() => selectResult(r)}
                  className={cn(
                    "w-full flex items-center justify-between px-2.5 py-1.5 text-left transition-colors text-[9px]",
                    i === selectedIdx ? "bg-primary/20 text-primary" : "hover:bg-[#1a1a1a] text-[#aaa]"
                  )}
                >
                  <div className="flex flex-col">
                    <span className="font-bold leading-none">{r.symbol}</span>
                    <span className="text-[#555] truncate max-w-[130px]">{r.name}</span>
                  </div>
                  <span className="text-[8px] text-[#444]">{r.exchange}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Intervals */}
        <div className="flex items-center border border-[#2a2a2a] rounded overflow-hidden">
          {INTERVALS.map((iv) => (
            <button
              key={iv.label}
              onClick={() => handleIntervalChange(iv)}
              className={cn(
                "px-1.5 py-0.5 text-[9px] transition-colors",
                intervalCfg.label === iv.label ? "bg-primary text-black font-bold" : "text-[#555] hover:bg-[#1c1c1c]"
              )}
            >
              {iv.label}
            </button>
          ))}
        </div>

        {/* Chart Style */}
        <div className="flex items-center border border-[#2a2a2a] rounded overflow-hidden">
          {(["candles", "line", "area"] as ChartStyle[]).map((s) => (
            <button
              key={s}
              onClick={() => setChartStyle(s)}
              className={cn(
                "px-1.5 py-0.5 text-[9px] capitalize transition-colors",
                chartStyle === s ? "bg-[#2a2a2a] text-[#eee]" : "text-[#555] hover:bg-[#1a1a1a]"
              )}
            >
              {s.substring(0, 3)}
            </button>
          ))}
        </div>

        {/* Overlays dropdown */}
        <div className="flex items-center gap-1">
          <Select value="" onValueChange={(val: OverlayKey) => toggleOverlay(val)}>
            <SelectTrigger className="h-5 text-[9px] border-muted bg-[#111] py-0 px-1 font-mono w-24">
              <SelectValue placeholder="OVERLAYS" />
            </SelectTrigger>
            <SelectContent className="font-mono text-[10px]">
              {(Object.keys(OVERLAY_LABELS) as OverlayKey[]).map((k) => (
                <SelectItem key={k} value={k}>
                  {overlays[k] ? "✓ " : "  "}{OVERLAY_LABELS[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Quote & Timer */}
        {processed?.last && (
          <div className="flex items-center gap-1 text-[9px] font-mono text-[#555] ml-auto">
            <span className="font-bold text-[#eee]">{processed.last.close.toFixed(2)}</span>
            <span className={cn(processed.chg >= 0 ? "text-green-400" : "text-red-400")}>
              {processed.chg >= 0 ? "+" : ""}{processed.chg.toFixed(1)}%
            </span>
            <span>({countdown}s)</span>
          </div>
        )}
      </div>

      {/* Chart Canvas */}
      <div className="flex-1 flex flex-col min-h-0 bg-[#0a0a0a]">
        {isLoading && (
          <div className="flex-1 flex items-center justify-center text-[#444] text-[10px] font-mono animate-pulse">
            LOADING DATA...
          </div>
        )}
        {isError && (
          <div className="flex-1 flex items-center justify-center text-red-400 text-[10px] font-mono">
            ERROR LOADING HISTORICAL DATA
          </div>
        )}
        {!isLoading && !isError && !processed && (
          <div className="flex-1 flex items-center justify-center text-yellow-500 text-[10px] font-mono">
            NO CANDLE DATA FOUND
          </div>
        )}
        {!isLoading && !isError && processed && (
          <div className="flex-1 flex flex-col min-h-0">
            <div ref={mainRef} className={cn("w-full", overlays.rsi ? "h-[70%]" : "h-full")} />
            {overlays.rsi && (
              <>
                <div className="border-t border-[#1c1c1c] px-2 py-0.5 shrink-0 text-[8px] text-cyan-500/70 font-mono">
                  RSI (14)
                </div>
                <div ref={rsiRef} className="w-full h-[28%]" />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChartsPage() {
  const [layout, setLayout] = useState<"1x1" | "1x2" | "2x2">(() => {
    try {
      return (localStorage.getItem("charts_layout") as any) || "1x1";
    } catch {
      return "1x1";
    }
  });

  const [cellConfigs, setCellConfigs] = useState<CellConfig[]>(() => {
    try {
      const saved = localStorage.getItem("charts_cell_configs");
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: "cell_1", symbol: "NIFTY", interval: "5m", period: "5d" },
      { id: "cell_2", symbol: "BANKNIFTY", interval: "5m", period: "5d" },
      { id: "cell_3", symbol: "RELIANCE", interval: "15m", period: "5d" },
      { id: "cell_4", symbol: "TCS", interval: "1d", period: "1y" },
    ];
  });

  const [fullscreen, setFullscreen] = useState(false);

  const updateCell = (id: string, symbol: string, interval: GetMarketHistoryInterval, period: GetMarketHistoryPeriod) => {
    setCellConfigs((prev) => {
      const next = prev.map((c) => (c.id === id ? { ...c, symbol, interval, period } : c));
      try { localStorage.setItem("charts_cell_configs", JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const handleLayoutChange = (l: "1x1" | "1x2" | "2x2") => {
    setLayout(l);
    try { localStorage.setItem("charts_layout", l); } catch {}
  };

  interface CellConfig {
    id: string;
    symbol: string;
    interval: GetMarketHistoryInterval;
    period: GetMarketHistoryPeriod;
  }

  const activeConfigs = useMemo(() => {
    if (layout === "1x1") return cellConfigs.slice(0, 1);
    if (layout === "1x2") return cellConfigs.slice(0, 2);
    return cellConfigs;
  }, [layout, cellConfigs]);

  return (
    <div className={cn(
      "flex flex-col bg-[#0a0a0a]",
      fullscreen ? "fixed inset-0 z-50 h-screen w-screen" : "-m-6 h-[calc(100vh-0px)]"
    )} style={{ height: fullscreen ? "100vh" : "calc(100vh - 0px)" }}>

      {/* Main Grid Header */}
      <div className="shrink-0 border-b border-[#1c1c1c] bg-[#0d0d0d] flex items-center justify-between px-3 py-1.5">
        <div className="flex items-center gap-1.5 font-mono text-xs font-bold text-primary">
          <CandlestickChart className="h-3.5 w-3.5" />
          MULTI-CHART WORKSPACE
        </div>

        <div className="flex items-center gap-4">
          {/* Grid layout selector */}
          <div className="flex items-center border border-[#2a2a2a] rounded overflow-hidden">
            {(["1x1", "1x2", "2x2"] as const).map((l) => (
              <button
                key={l}
                onClick={() => handleLayoutChange(l)}
                className={cn(
                  "px-3 py-1 text-xs font-mono transition-colors font-bold",
                  layout === l ? "bg-primary text-black" : "text-[#555] hover:bg-[#1c1c1c] hover:text-[#aaa]"
                )}
              >
                {l}
              </button>
            ))}
          </div>

          <button 
            onClick={() => setFullscreen((f) => !f)} 
            className="h-6 px-2 text-[10px] font-mono border border-[#2a2a2a] rounded text-[#666] hover:text-primary hover:border-primary transition-colors"
          >
            {fullscreen ? "EXIT FS" : "⛶ FULLSCREEN"}
          </button>
        </div>
      </div>

      {/* Grid workspace */}
      <div className="flex-1 min-h-0 p-2 bg-[#080808]">
        <div className={cn(
          "grid h-full w-full gap-2",
          layout === "1x1" ? "grid-cols-1" :
          layout === "1x2" ? "grid-cols-1 md:grid-cols-2" :
          "grid-cols-2 grid-rows-2"
        )}>
          {activeConfigs.map((cfg) => (
            <ChartCellComponent
              key={cfg.id}
              id={cfg.id}
              initialSymbol={cfg.symbol}
              initialInterval={cfg.interval}
              initialPeriod={cfg.period}
              onUpdate={(sym, iv, pe) => updateCell(cfg.id, sym, iv, pe)}
            />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-[#151515] px-3 py-1 flex items-center justify-between text-[9px] font-mono text-[#333]">
        <span>lightweight-charts · Grid View: {layout}</span>
        <span>All times IST (UTC+5:30)</span>
      </div>
    </div>
  );
}

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Flame,
  TrendingUp,
  TrendingDown,
  Search,
  Zap,
  BarChart2,
  RefreshCw,
  Activity,
  ArrowUpRight,
  LineChart
} from "lucide-react";
import { cn } from "@/lib/utils";

interface VolumeShocker {
  symbol: string;
  name: string;
  ltp: number;
  changePercent: number;
  currentVolume: number;
  avgVolume20D: number;
  surgeMultiple: number;
  deliveryPercent: number;
  signal: "BULLISH_BREAKOUT" | "ACCUMULATION" | "BEARISH_DUMP" | "HIGH_VOL_PULLBACK";
  rsi14: number;
  sector: string;
  vwap: number;
}

export default function VolumeShockersPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [minMultiple, setMinMultiple] = useState<number>(2.0);
  const [selectedSignal, setSelectedSignal] = useState<string>("ALL");

  const { data, isLoading, refetch, isFetching } = useQuery<{ shockers: VolumeShocker[] }>({
    queryKey: ["volume-shockers"],
    queryFn: async () => {
      const res = await fetch("/api/volume-shockers");
      if (!res.ok) throw new Error("Failed to load volume shockers");
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const shockers = data?.shockers || [];

  const filtered = useMemo(() => {
    return shockers.filter((item) => {
      const matchesSearch =
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesMult = item.surgeMultiple >= minMultiple;
      const matchesSig = selectedSignal === "ALL" || item.signal === selectedSignal;
      return matchesSearch && matchesMult && matchesSig;
    });
  }, [shockers, searchQuery, minMultiple, selectedSignal]);

  const maxSurge = useMemo(() => {
    if (!shockers.length) return null;
    return [...shockers].sort((a, b) => b.surgeMultiple - a.surgeMultiple)[0];
  }, [shockers]);

  const bullishCount = useMemo(() => {
    return shockers.filter((s) => s.signal === "BULLISH_BREAKOUT" || s.signal === "ACCUMULATION").length;
  }, [shockers]);

  const avgDelivery = useMemo(() => {
    if (!shockers.length) return 0;
    const total = shockers.reduce((acc, s) => acc + s.deliveryPercent, 0);
    return (total / shockers.length).toFixed(1);
  }, [shockers]);

  const getSignalBadge = (sig: string) => {
    switch (sig) {
      case "BULLISH_BREAKOUT":
        return "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40";
      case "ACCUMULATION":
        return "bg-blue-500/20 text-blue-400 border border-blue-500/40";
      case "BEARISH_DUMP":
        return "bg-rose-500/20 text-rose-400 border border-rose-500/40";
      case "HIGH_VOL_PULLBACK":
        return "bg-amber-500/20 text-amber-400 border border-amber-500/40";
      default:
        return "bg-slate-800 text-slate-300";
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-600/20 text-amber-400 border border-amber-500/30">
              <Flame className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Volume Shockers & Breakouts
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
              INSTITUTIONAL RADAR
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time scanner flagging anomalous trading volume spikes (&gt;2x to 5x 20DMA) coupled with delivery participation and directional breakout setups.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-amber-400")} />
          <span>{isFetching ? "Scanning..." : "Rescan Market"}</span>
        </button>
      </div>

      {/* Top Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Highest Surge Multiple</span>
            <Flame className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {maxSurge ? `${maxSurge.surgeMultiple}x` : "--"}
          </div>
          <div className="text-xs text-amber-400 font-semibold mt-1">
            {maxSurge?.symbol} ({maxSurge?.sector})
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Bullish Accumulation</span>
            <ArrowUpRight className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {bullishCount} Stocks
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Breakouts with positive price action
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Avg Delivery Rate</span>
            <BarChart2 className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {avgDelivery}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            High delivery confirms institutional buying
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Total Shockers Triggered</span>
            <Activity className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-400 font-mono">
            {shockers.length} Triggers
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Volume &gt;200% above 20-day moving avg
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search symbol, company, or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-amber-500"
            />
          </div>

          <select
            value={selectedSignal}
            onChange={(e) => setSelectedSignal(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-300 text-xs focus:outline-none focus:border-amber-500 cursor-pointer"
          >
            <option value="ALL">All Breakout Signals</option>
            <option value="BULLISH_BREAKOUT">Bullish Breakout</option>
            <option value="ACCUMULATION">Institutional Accumulation</option>
            <option value="HIGH_VOL_PULLBACK">High-Vol Pullback</option>
            <option value="BEARISH_DUMP">Bearish Dump</option>
          </select>
        </div>

        {/* Multiplier Slider / Filter */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Min Volume Multiple:</span>
          {[2.0, 3.0, 4.0, 5.0].map((val) => (
            <button
              key={val}
              onClick={() => setMinMultiple(val)}
              className={cn(
                "px-2.5 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer",
                minMultiple === val
                  ? "bg-amber-600 text-white font-bold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              &gt;{val}x
            </button>
          ))}
        </div>
      </div>

      {/* Shockers Table */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto no-scrollbar">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <th className="py-2.5 px-3">Stock & Sector</th>
              <th className="py-2.5 px-3 text-right">LTP (₹)</th>
              <th className="py-2.5 px-3 text-right">Change %</th>
              <th className="py-2.5 px-3 text-center">Surge Multiple</th>
              <th className="py-2.5 px-3">Volume vs 20D Avg</th>
              <th className="py-2.5 px-3 text-center">Delivery %</th>
              <th className="py-2.5 px-3 text-center">RSI (14)</th>
              <th className="py-2.5 px-3 text-center">Signal Setup</th>
              <th className="py-2.5 px-3 text-right">Quick Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-mono">
            {isLoading ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500">
                  Scanning for abnormal trading volumes...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={9} className="text-center py-8 text-slate-500">
                  No stocks match the volume threshold.
                </td>
              </tr>
            ) : (
              filtered.map((item) => {
                const isPositive = item.changePercent >= 0;
                return (
                  <tr key={item.symbol} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-bold text-white text-[12.5px]">{item.symbol}</div>
                      <div className="text-[10px] text-slate-400 font-sans">{item.name} · {item.sector}</div>
                    </td>

                    <td className="py-2.5 px-3 text-right font-bold text-white">
                      ₹{item.ltp.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </td>

                    <td
                      className={cn(
                        "py-2.5 px-3 text-right font-semibold",
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      {isPositive ? "+" : ""}
                      {item.changePercent.toFixed(2)}%
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                        <Flame className="w-3 h-3 text-amber-400" />
                        <span>{item.surgeMultiple}x</span>
                      </span>
                    </td>

                    <td className="py-2.5 px-3 min-w-[150px]">
                      <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
                        <span>{(item.currentVolume / 100000).toFixed(1)}L</span>
                        <span className="text-slate-500">Avg: {(item.avgVolume20D / 100000).toFixed(1)}L</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-amber-500 transition-all duration-300"
                          style={{ width: `${Math.min(100, item.surgeMultiple * 20)}%` }}
                        />
                      </div>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={cn(
                          "px-2 py-0.5 rounded text-[11px]",
                          item.deliveryPercent >= 45
                            ? "bg-emerald-950/60 text-emerald-300 border border-emerald-800/60 font-bold"
                            : "text-slate-300"
                        )}
                      >
                        {item.deliveryPercent}%
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center">
                      <span
                        className={cn(
                          "font-semibold",
                          item.rsi14 >= 70 ? "text-amber-400" : item.rsi14 <= 35 ? "text-blue-400" : "text-slate-300"
                        )}
                      >
                        {item.rsi14}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-center font-sans">
                      <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", getSignalBadge(item.signal))}>
                        {item.signal.replace(/_/g, " ")}
                      </span>
                    </td>

                    <td className="py-2.5 px-3 text-right font-sans">
                      <div className="flex items-center justify-end gap-1.5">
                        <Link
                          href={`/scalping?symbol=${item.symbol}`}
                          className="px-2 py-1 rounded bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 text-[11px] font-medium transition-colors"
                        >
                          Scalp
                        </Link>
                        <Link
                          href={`/charts?symbol=${item.symbol}`}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
                          title="View Chart"
                        >
                          <LineChart className="w-3.5 h-3.5 text-blue-400" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

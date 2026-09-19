import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Layers,
  Activity,
  Zap,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Flame,
  CheckCircle2,
  ArrowRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OiStrikeRow {
  strikePrice: number;
  callOI: number;
  putOI: number;
  callChangeOI: number;
  putChangeOI: number;
  callLtp: number;
  putLtp: number;
  strikePcr: number;
  isAtm: boolean;
  isMaxPain: boolean;
  isHighestCallOI: boolean;
  isHighestPutOI: boolean;
}

interface OiTrackerResponse {
  symbol: string;
  underlyingPrice: number;
  atmStrike: number;
  maxPainStrike: number;
  highestCallStrike: number;
  highestPutStrike: number;
  totalCallOI: number;
  totalPutOI: number;
  overallPcr: number;
  sentiment: "OVERSOLD_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "OVERBOUGHT_BEARISH";
  gammaBlastAlert: boolean;
  gammaBlastStrikes: number[];
  strikes: OiStrikeRow[];
  timestamp: string;
}

export default function OiTrackerPage() {
  const [selectedSymbol, setSelectedSymbol] = useState<string>("NIFTY");

  const { data, isLoading, refetch, isFetching } = useQuery<OiTrackerResponse>({
    queryKey: ["oi-tracker", selectedSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/market/oi-tracker?symbol=${selectedSymbol}`);
      if (!res.ok) throw new Error("Failed to load OI tracker");
      return res.json();
    },
    refetchInterval: 5000,
    staleTime: 2000,
  });

  const strikes = data?.strikes || [];
  const maxOI = Math.max(
    ...strikes.map((s) => Math.max(s.callOI, s.putOI)),
    100000
  );

  const getPcrColor = (pcr: number) => {
    if (pcr > 1.2) return "text-emerald-400 bg-emerald-950/40 border-emerald-700/50";
    if (pcr < 0.8) return "text-rose-400 bg-rose-950/40 border-rose-700/50";
    return "text-blue-400 bg-blue-950/40 border-blue-700/50";
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-indigo-600/20 text-indigo-400 border border-indigo-500/30">
              <Layers className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Live Open Interest (OI) & Expiry Tracker
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
              EXPIRY DAY RADAR
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time strike-wise Call vs Put OI accumulation, Max Pain settlement pin, Put-Call Ratio (PCR), and Gamma Blast unwinding alerts.
          </p>
        </div>

        {/* Symbol Selector & Refresh Button */}
        <div className="flex items-center gap-2">
          {["NIFTY", "BANKNIFTY", "FINNIFTY"].map((sym) => (
            <button
              key={sym}
              onClick={() => setSelectedSymbol(sym)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-semibold tracking-wide transition-all cursor-pointer font-mono",
                selectedSymbol === sym
                  ? "bg-indigo-600 text-white shadow-[0_0_12px_rgba(79,70,229,0.4)]"
                  : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
              )}
            >
              {sym}
            </button>
          ))}

          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-indigo-400")} />
            <span>{isFetching ? "Syncing..." : "Refresh"}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Underlying Spot */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-1">
            <span>{selectedSymbol} Spot</span>
            <Activity className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            ₹{data?.underlyingPrice.toLocaleString("en-IN", { minimumFractionDigits: 1 }) || "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            <span>ATM Strike:</span>
            <span className="font-mono text-blue-400 font-semibold">{data?.atmStrike}</span>
          </div>
        </div>

        {/* Max Pain Strike */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-1">
            <span>Max Pain Strike</span>
            <Zap className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-indigo-400">
            {data?.maxPainStrike || "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {data && data.maxPainStrike > data.underlyingPrice ? (
              <span className="text-emerald-400 font-semibold">
                +{(data.maxPainStrike - data.underlyingPrice).toFixed(0)} pts above spot (Bullish Pull)
              </span>
            ) : data ? (
              <span className="text-rose-400 font-semibold">
                -{(data.underlyingPrice - data.maxPainStrike).toFixed(0)} pts below spot (Bearish Pull)
              </span>
            ) : null}
          </div>
        </div>

        {/* Put-Call Ratio (PCR) */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-1">
            <span>Put-Call Ratio (PCR)</span>
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-0.2 rounded border",
                getPcrColor(data?.overallPcr ?? 1)
              )}
            >
              {data?.sentiment.replace("_", " ") || "NEUTRAL"}
            </span>
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {data?.overallPcr.toFixed(2) || "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Puts: {( (data?.totalPutOI ?? 0) / 100000 ).toFixed(1)}L · Calls: {( (data?.totalCallOI ?? 0) / 100000 ).toFixed(1)}L
          </div>
        </div>

        {/* Gamma Blast Alert Status */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden">
          <div className="text-slate-400 text-xs flex items-center justify-between mb-1">
            <span>Gamma Blast Radar</span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="text-lg font-bold font-mono mt-1">
            {data?.gammaBlastAlert ? (
              <div className="flex items-center gap-1.5 text-amber-400 animate-pulse">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <span>ACTIVE BLAST SETUP</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Normal Delta State</span>
              </div>
            )}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            {data?.gammaBlastAlert
              ? `Unwinding near: ${data.gammaBlastStrikes.join(", ")}`
              : "No violent gamma squeeze detected"}
          </div>
        </div>
      </div>

      {/* Visual Dual Bar Chart (Call OI vs Put OI) */}
      <div className="p-5 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <span>Strike-by-Strike Open Interest Distribution</span>
            <span className="text-[10px] text-slate-400 font-normal">
              (Green: Put Support · Red: Call Resistance)
            </span>
          </h2>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-rose-500/80" />
              <span className="text-slate-300">Call OI (Resistance)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm bg-emerald-500/80" />
              <span className="text-slate-300">Put OI (Support)</span>
            </div>
          </div>
        </div>

        {/* Visual Chart Bars */}
        <div className="space-y-1.5 pt-2">
          {strikes.slice(2, 23).map((row) => {
            const callBarWidth = Math.max(2, (row.callOI / maxOI) * 100);
            const putBarWidth = Math.max(2, (row.putOI / maxOI) * 100);

            return (
              <div
                key={row.strikePrice}
                className={cn(
                  "flex items-center text-xs py-1 px-2 rounded transition-colors group",
                  row.isAtm
                    ? "bg-blue-600/15 border border-blue-500/40"
                    : "hover:bg-slate-800/40"
                )}
              >
                {/* Call OI side (align right) */}
                <div className="w-1/2 flex items-center justify-end gap-2 pr-3">
                  <span className="text-[10.5px] font-mono text-slate-400 group-hover:text-white">
                    {(row.callOI / 1000).toFixed(0)}k
                  </span>
                  <div className="w-48 bg-slate-800/60 h-3 rounded-sm overflow-hidden flex justify-end">
                    <div
                      className={cn(
                        "h-full rounded-sm transition-all duration-300",
                        row.isHighestCallOI ? "bg-rose-500 shadow-[0_0_8px_#ef4444]" : "bg-rose-500/70"
                      )}
                      style={{ width: `${callBarWidth}%` }}
                    />
                  </div>
                </div>

                {/* Strike Price Center Badge */}
                <div className="w-24 text-center shrink-0">
                  <span
                    className={cn(
                      "font-mono font-bold px-2 py-0.5 rounded text-[11px]",
                      row.isAtm
                        ? "bg-blue-600 text-white shadow-[0_0_8px_rgba(37,99,235,0.6)]"
                        : row.isMaxPain
                        ? "bg-indigo-600 text-white"
                        : "text-slate-300 bg-slate-800"
                    )}
                  >
                    {row.strikePrice}
                  </span>
                  {row.isMaxPain && (
                    <span className="block text-[8px] font-black text-indigo-400 tracking-tighter uppercase mt-0.5">
                      MAX PAIN
                    </span>
                  )}
                </div>

                {/* Put OI side (align left) */}
                <div className="w-1/2 flex items-center justify-start gap-2 pl-3">
                  <div className="w-48 bg-slate-800/60 h-3 rounded-sm overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-sm transition-all duration-300",
                        row.isHighestPutOI ? "bg-emerald-500 shadow-[0_0_8px_#10b981]" : "bg-emerald-500/70"
                      )}
                      style={{ width: `${putBarWidth}%` }}
                    />
                  </div>
                  <span className="text-[10.5px] font-mono text-slate-400 group-hover:text-white">
                    {(row.putOI / 1000).toFixed(0)}k
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Tabular Analysis Table */}
      <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 overflow-x-auto no-scrollbar">
        <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">
          Strike Table & PCR Metrics
        </h3>
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
              <th className="py-2 px-3 text-right text-rose-400">Call OI</th>
              <th className="py-2 px-3 text-right text-rose-400">Call Chg</th>
              <th className="py-2 px-3 text-right">Call LTP</th>
              <th className="py-2 px-3 text-center text-white">Strike</th>
              <th className="py-2 px-3 text-center">Strike PCR</th>
              <th className="py-2 px-3 text-left">Put LTP</th>
              <th className="py-2 px-3 text-left text-emerald-400">Put Chg</th>
              <th className="py-2 px-3 text-left text-emerald-400">Put OI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/50 font-mono">
            {strikes.map((s) => (
              <tr
                key={s.strikePrice}
                className={cn(
                  "hover:bg-slate-800/40 transition-colors",
                  s.isAtm && "bg-blue-600/10 font-bold"
                )}
              >
                <td className="py-1.5 px-3 text-right text-slate-300">
                  {s.callOI.toLocaleString("en-IN")}
                </td>
                <td
                  className={cn(
                    "py-1.5 px-3 text-right",
                    s.callChangeOI >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {s.callChangeOI >= 0 ? "+" : ""}
                  {s.callChangeOI.toLocaleString("en-IN")}
                </td>
                <td className="py-1.5 px-3 text-right text-slate-400">
                  ₹{s.callLtp.toFixed(1)}
                </td>
                <td className="py-1.5 px-3 text-center">
                  <span
                    className={cn(
                      "px-2 py-0.5 rounded",
                      s.isAtm ? "bg-blue-600 text-white font-bold" : "text-white"
                    )}
                  >
                    {s.strikePrice}
                  </span>
                </td>
                <td className="py-1.5 px-3 text-center text-slate-300">
                  {s.strikePcr}
                </td>
                <td className="py-1.5 px-3 text-left text-slate-400">
                  ₹{s.putLtp.toFixed(1)}
                </td>
                <td
                  className={cn(
                    "py-1.5 px-3 text-left",
                    s.putChangeOI >= 0 ? "text-emerald-400" : "text-rose-400"
                  )}
                >
                  {s.putChangeOI >= 0 ? "+" : ""}
                  {s.putChangeOI.toLocaleString("en-IN")}
                </td>
                <td className="py-1.5 px-3 text-left text-slate-300">
                  {s.putOI.toLocaleString("en-IN")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

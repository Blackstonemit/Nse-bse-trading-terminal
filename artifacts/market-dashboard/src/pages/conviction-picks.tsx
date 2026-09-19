import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Target,
  TrendingUp,
  Search,
  Filter,
  ArrowUpRight,
  ShieldCheck,
  Building2,
  LineChart,
  Percent,
  Sparkles,
  BarChart3,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ConvictionPick {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  targetPrice: number;
  upsidePercent: number;
  consensus: "STRONG_BUY" | "BUY" | "HOLD";
  numBrokers: number;
  buyPercent: number;
  peRatio: number;
  marketCapCr: number;
  week52High: number;
  week52Low: number;
  convictionScore: number;
  rationale: string;
}

export default function ConvictionPicksPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSector, setSelectedSector] = useState<string>("ALL");
  const [minUpside, setMinUpside] = useState<number>(0);
  const [consensusFilter, setConsensusFilter] = useState<string>("ALL");

  const { data, isLoading, refetch, isFetching } = useQuery<{ picks: ConvictionPick[] }>({
    queryKey: ["conviction-picks"],
    queryFn: async () => {
      const res = await fetch("/api/conviction-picks");
      if (!res.ok) throw new Error("Failed to load conviction picks");
      return res.json();
    },
    staleTime: 60000,
  });

  const picks = data?.picks || [];

  const sectors = useMemo(() => {
    const set = new Set(picks.map((p) => p.sector));
    return ["ALL", ...Array.from(set)];
  }, [picks]);

  const filteredPicks = useMemo(() => {
    return picks.filter((p) => {
      const matchesSearch =
        p.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesSector = selectedSector === "ALL" || p.sector === selectedSector;
      const matchesUpside = p.upsidePercent >= minUpside;
      const matchesConsensus =
        consensusFilter === "ALL" || p.consensus === consensusFilter;
      return matchesSearch && matchesSector && matchesUpside && matchesConsensus;
    });
  }, [picks, searchQuery, selectedSector, minUpside, consensusFilter]);

  // Stat calculations
  const highestUpside = useMemo(() => {
    if (!picks.length) return null;
    return [...picks].sort((a, b) => b.upsidePercent - a.upsidePercent)[0];
  }, [picks]);

  const avgUpside = useMemo(() => {
    if (!picks.length) return 0;
    const total = picks.reduce((acc, p) => acc + p.upsidePercent, 0);
    return (total / picks.length).toFixed(1);
  }, [picks]);

  const strongBuyCount = useMemo(() => {
    return picks.filter((p) => p.consensus === "STRONG_BUY").length;
  }, [picks]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <Target className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Price Targets & Conviction Picks
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
              ANALYST CONSENSUS
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Institutional broker targets, upside percentage projections, and fundamental investment thesis for NSE & BSE stocks.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-blue-400")} />
            <span>{isFetching ? "Refreshing..." : "Refresh Targets"}</span>
          </button>
        </div>
      </div>

      {/* Top Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Highest Upside Pick</span>
            <Sparkles className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            {highestUpside?.symbol || "--"}
          </div>
          <div className="text-xs text-emerald-400 font-semibold mt-1 flex items-center gap-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+{highestUpside?.upsidePercent.toFixed(1)}% Projected Upside</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Average Portfolio Upside</span>
            <Percent className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">
            +{avgUpside}%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Across {picks.length} institutional consensus picks
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-cyan-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Strong Buy Ratings</span>
            <ShieldCheck className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-xl font-bold text-cyan-300 font-mono">
            {strongBuyCount} Stocks
          </div>
          <div className="text-xs text-slate-400 mt-1">
            &gt;80% analyst buy recommendations
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800/80 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-2">
            <span>Sectors Monitored</span>
            <Building2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-xl font-bold text-indigo-300 font-mono">
            {sectors.length - 1} Sectors
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Defense, EMS, Retail, Tech & Banking
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
          <div className="relative flex-1 min-w-[180px] max-w-sm">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search stock symbol or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Sector Selector */}
          <select
            value={selectedSector}
            onChange={(e) => setSelectedSector(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-300 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            {sectors.map((sec) => (
              <option key={sec} value={sec}>
                {sec === "ALL" ? "All Sectors" : sec}
              </option>
            ))}
          </select>

          {/* Consensus Filter */}
          <select
            value={consensusFilter}
            onChange={(e) => setConsensusFilter(e.target.value)}
            className="px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-slate-300 text-xs focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="ALL">All Consensus</option>
            <option value="STRONG_BUY">Strong Buy</option>
            <option value="BUY">Buy</option>
            <option value="HOLD">Hold</option>
          </select>
        </div>

        {/* Min Upside Selector */}
        <div className="flex items-center gap-2">
          <span className="text-slate-400">Min Upside:</span>
          {[0, 20, 25, 30].map((val) => (
            <button
              key={val}
              onClick={() => setMinUpside(val)}
              className={cn(
                "px-2 py-1 rounded font-mono text-[11px] transition-colors cursor-pointer",
                minUpside === val
                  ? "bg-blue-600 text-white font-semibold"
                  : "bg-slate-800 text-slate-400 hover:text-white"
              )}
            >
              {val === 0 ? "All" : `>${val}%`}
            </button>
          ))}
        </div>
      </div>

      {/* Conviction Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-48 rounded-xl bg-slate-900/40 animate-pulse border border-slate-800/40" />
          ))}
        </div>
      ) : filteredPicks.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800/40">
          <Target className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No stocks match your filter criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredPicks.map((pick) => {
            const progressPercent = Math.min(
              100,
              Math.max(0, ((pick.currentPrice - pick.week52Low) / (pick.targetPrice - pick.week52Low)) * 100)
            );

            return (
              <div
                key={pick.symbol}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white tracking-tight">
                        {pick.symbol}
                      </span>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 font-medium">
                        {pick.sector}
                      </span>
                      <span
                        className={cn(
                          "text-[9.5px] font-bold px-2 py-0.5 rounded-md",
                          pick.consensus === "STRONG_BUY"
                            ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                            : "bg-blue-500/20 text-blue-300 border border-blue-500/40"
                        )}
                      >
                        {pick.consensus.replace("_", " ")}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{pick.name}</div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-white font-mono">
                      ₹{pick.currentPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </div>
                    <div className="text-xs font-semibold text-emerald-400 font-mono flex items-center justify-end gap-0.5">
                      <ArrowUpRight className="w-3 h-3" />
                      <span>+{pick.upsidePercent.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                {/* Target progress visual */}
                <div className="bg-slate-950/80 p-2.5 rounded-lg border border-slate-800/80 space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-400">Current Price</span>
                    <span className="text-blue-400 font-semibold font-mono">
                      Target: ₹{pick.targetPrice.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden relative">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-blue-500 to-emerald-400 transition-all duration-500"
                      style={{ width: `${Math.max(15, progressPercent)}%` }}
                    />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>52W L: ₹{pick.week52Low}</span>
                    <span>52W H: ₹{pick.week52High}</span>
                  </div>
                </div>

                {/* Key Metrics row */}
                <div className="grid grid-cols-3 gap-2 text-center text-xs py-1 border-y border-slate-800/60">
                  <div>
                    <div className="text-[10px] text-slate-500">P/E Ratio</div>
                    <div className="font-mono font-semibold text-slate-300">{pick.peRatio}x</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">Brokers / Buy %</div>
                    <div className="font-mono font-semibold text-slate-300">
                      {pick.numBrokers} ({pick.buyPercent}%)
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500">M-Cap (Cr)</div>
                    <div className="font-mono font-semibold text-slate-300">
                      ₹{(pick.marketCapCr / 1000).toFixed(1)}k
                    </div>
                  </div>
                </div>

                {/* Investment Rationale */}
                <div className="text-[11px] text-slate-300 leading-relaxed bg-slate-950/40 p-2 rounded border border-slate-800/40">
                  <span className="font-semibold text-blue-400 mr-1">Thesis:</span>
                  {pick.rationale}
                </div>

                {/* Action buttons */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  <Link
                    href={`/charts?symbol=${pick.symbol}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors"
                  >
                    <LineChart className="w-3 h-3 text-blue-400" />
                    <span>View Chart</span>
                  </Link>
                  <Link
                    href={`/fundamentals?symbol=${pick.symbol}`}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-blue-300 text-xs font-medium transition-colors"
                  >
                    <BarChart3 className="w-3 h-3 text-blue-400" />
                    <span>Financials</span>
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

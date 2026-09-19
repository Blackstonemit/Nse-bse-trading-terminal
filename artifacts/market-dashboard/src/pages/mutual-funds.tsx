import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  PieChart,
  TrendingUp,
  Search,
  Star,
  Shield,
  ArrowUpRight,
  RefreshCw,
  Award,
  Layers,
  Building
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MutualFundItem {
  id: string;
  name: string;
  amc: string;
  category: "Large Cap" | "Mid Cap" | "Small Cap" | "Flexi Cap" | "ELSS" | "Index";
  nav: number;
  changePercent: number;
  returns1Y: number;
  returns3Y: number;
  returns5Y: number;
  aumCr: number;
  rating: number;
  expenseRatio: number;
  riskLevel: "Moderate" | "High" | "Very High";
  topHoldings: string[];
}

export default function MutualFundsPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [minRating, setMinRating] = useState<number>(0);

  const { data, isLoading, refetch, isFetching } = useQuery<{ funds: MutualFundItem[] }>({
    queryKey: ["mutual-funds-data"],
    queryFn: async () => {
      const res = await fetch("/api/mutual-funds");
      if (!res.ok) throw new Error("Failed to load mutual funds");
      return res.json();
    },
    staleTime: 60000,
  });

  const funds = data?.funds || [];

  const categories = ["ALL", "Large Cap", "Mid Cap", "Small Cap", "Flexi Cap", "ELSS", "Index"];

  const filteredFunds = useMemo(() => {
    return funds.filter((fund) => {
      const matchesCat = selectedCategory === "ALL" || fund.category === selectedCategory;
      const matchesSearch =
        fund.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        fund.amc.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesRating = fund.rating >= minRating;
      return matchesCat && matchesSearch && matchesRating;
    });
  }, [funds, selectedCategory, searchQuery, minRating]);

  const top1Y = useMemo(() => {
    if (!funds.length) return null;
    return [...funds].sort((a, b) => b.returns1Y - a.returns1Y)[0];
  }, [funds]);

  const largestAum = useMemo(() => {
    if (!funds.length) return null;
    return [...funds].sort((a, b) => b.aumCr - a.aumCr)[0];
  }, [funds]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <PieChart className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Mutual Funds Explorer & Comparison
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              WEALTH COMPOUNDING
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Compare top-performing Indian mutual funds across Large Cap, Mid Cap, Small Cap, and Flexi Cap with live NAVs, CAGR returns, and portfolio holdings.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-emerald-400")} />
          <span>{isFetching ? "Refreshing..." : "Refresh Funds"}</span>
        </button>
      </div>

      {/* Top 4 Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Highest 1Y Return</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            +{top1Y?.returns1Y.toFixed(1)}%
          </div>
          <div className="text-xs text-slate-300 truncate mt-1 font-semibold">
            {top1Y?.name}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Largest Fund by AUM</span>
            <Building className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ₹{largestAum ? (largestAum.aumCr / 1000).toFixed(1) : "--"}k Cr
          </div>
          <div className="text-xs text-slate-300 truncate mt-1 font-semibold">
            {largestAum?.name}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>5-Star Rated Funds</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono">
            {funds.filter((f) => f.rating === 5).length} Funds
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Consistent alpha generation vs benchmark
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Average Expense Ratio</span>
            <Shield className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300 font-mono">
            0.62%
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Direct growth plans with minimal drag
          </div>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer",
                selectedCategory === cat
                  ? "bg-emerald-600 text-white font-semibold shadow-sm"
                  : "bg-slate-950 text-slate-400 hover:text-white border border-slate-800"
              )}
            >
              {cat === "ALL" ? "All Categories" : cat}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Min Rating Selector */}
          <div className="flex items-center gap-1">
            <span className="text-slate-400">Rating:</span>
            {[0, 4, 5].map((stars) => (
              <button
                key={stars}
                onClick={() => setMinRating(stars)}
                className={cn(
                  "px-2 py-0.5 rounded font-mono text-[11px] transition-colors cursor-pointer",
                  minRating === stars
                    ? "bg-amber-500 text-black font-bold"
                    : "bg-slate-800 text-slate-400 hover:text-white"
                )}
              >
                {stars === 0 ? "All" : `${stars}★+`}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[180px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
            <input
              type="text"
              placeholder="Search fund or AMC..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Mutual Funds Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-52 rounded-xl bg-slate-900/40 animate-pulse border border-slate-800/40" />
          ))}
        </div>
      ) : filteredFunds.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800/40">
          <PieChart className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">No mutual funds match your search criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredFunds.map((fund) => {
            const isPositive = fund.changePercent >= 0;
            return (
              <div
                key={fund.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-bold text-white tracking-tight">
                        {fund.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                      <span>{fund.amc}</span>
                      <span>·</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-300 text-[10.5px] font-medium">
                        {fund.category}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-base font-bold text-white font-mono">
                      ₹{fund.nav.toFixed(2)}
                    </div>
                    <div
                      className={cn(
                        "text-xs font-semibold font-mono flex items-center justify-end gap-0.5",
                        isPositive ? "text-emerald-400" : "text-rose-400"
                      )}
                    >
                      <span>{isPositive ? "+" : ""}{fund.changePercent.toFixed(2)}%</span>
                    </div>
                  </div>
                </div>

                {/* Returns Row */}
                <div className="grid grid-cols-3 gap-2 p-2 rounded-lg bg-slate-950/60 border border-slate-800/80 text-center font-mono">
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">1Y CAGR</div>
                    <div className="text-sm font-bold text-emerald-400">+{fund.returns1Y}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">3Y CAGR</div>
                    <div className="text-sm font-bold text-emerald-400">+{fund.returns3Y}%</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 font-sans">5Y CAGR</div>
                    <div className="text-sm font-bold text-emerald-400">+{fund.returns5Y}%</div>
                  </div>
                </div>

                {/* Metrics Row */}
                <div className="flex items-center justify-between text-xs text-slate-400 py-1 border-t border-slate-800/60 font-mono">
                  <div className="flex items-center gap-1">
                    <span className="font-sans text-[11px]">Rating:</span>
                    <div className="flex items-center text-amber-400">
                      {Array.from({ length: fund.rating }).map((_, idx) => (
                        <Star key={idx} className="w-3 h-3 fill-amber-400" />
                      ))}
                    </div>
                  </div>

                  <div>
                    <span className="font-sans text-[11px]">AUM: </span>
                    <span className="text-slate-200 font-semibold">₹{fund.aumCr.toLocaleString("en-IN")} Cr</span>
                  </div>

                  <div>
                    <span className="font-sans text-[11px]">Exp: </span>
                    <span className="text-slate-200 font-semibold">{fund.expenseRatio}%</span>
                  </div>
                </div>

                {/* Top Holdings */}
                <div className="space-y-1">
                  <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block">
                    Top Portfolio Holdings
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {fund.topHoldings.map((h) => (
                      <span
                        key={h}
                        className="px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 text-[10.5px] border border-slate-700/50"
                      >
                        {h}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

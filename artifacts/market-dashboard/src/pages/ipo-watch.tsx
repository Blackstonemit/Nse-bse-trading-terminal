import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Rocket,
  Calendar,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  RefreshCw,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Building,
  Radio,
  Layers,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface IpoItem {
  id: string;
  name: string;
  symbol: string;
  issuePriceMin: number;
  issuePriceMax: number;
  lotSize: number;
  minInvestment: number;
  openDate: string;
  closeDate: string;
  listingDate: string;
  gmp: number;
  gmpPercent: number;
  expectedListingPrice: number;
  subscriptionTotal: number;
  subscriptionQIB: number;
  subscriptionNII: number;
  subscriptionRetail: number;
  status: "OPEN" | "UPCOMING" | "LISTED";
  exchange: "NSE/BSE" | "NSE SME" | "BSE SME";
  listingGainPercent?: number;
  isSme?: boolean;
  trend?: string;
  lastUpdated?: string;
}

interface IpoResponse {
  ipos: IpoItem[];
  cached?: boolean;
  total?: number;
  lastUpdated?: string;
}

export default function IpoWatchPage() {
  const [activeTab, setActiveTab] = useState<
    "ALL" | "OPEN" | "UPCOMING" | "LISTED" | "SME"
  >("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);

  const { data, isLoading, refetch, isFetching } = useQuery<IpoResponse>({
    queryKey: ["ipo-data"],
    queryFn: async () => {
      const res = await fetch("/api/ipo");
      if (!res.ok) throw new Error("Failed to load IPO data");
      return res.json();
    },
    staleTime: 60000,
  });

  const handleManualRefresh = async () => {
    try {
      setIsRefreshingManual(true);
      await fetch("/api/ipo?refresh=true");
      await refetch();
    } catch (err) {
      console.error("Manual refresh failed", err);
    } finally {
      setIsRefreshingManual(false);
    }
  };

  const ipos = data?.ipos || [];

  const filteredIpos = useMemo(() => {
    return ipos.filter((item) => {
      let matchesTab = false;
      if (activeTab === "ALL") {
        matchesTab = true;
      } else if (activeTab === "SME") {
        matchesTab = item.isSme === true || item.exchange?.includes("SME");
      } else {
        matchesTab = item.status === activeTab;
      }

      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    });
  }, [ipos, activeTab, searchQuery]);

  const openCount = useMemo(
    () => ipos.filter((i) => i.status === "OPEN").length,
    [ipos]
  );
  const upcomingCount = useMemo(
    () => ipos.filter((i) => i.status === "UPCOMING").length,
    [ipos]
  );
  const smeCount = useMemo(
    () => ipos.filter((i) => i.isSme || i.exchange?.includes("SME")).length,
    [ipos]
  );
  const highestGmp = useMemo(() => {
    if (!ipos.length) return null;
    return [...ipos].sort((a, b) => b.gmpPercent - a.gmpPercent)[0];
  }, [ipos]);

  const busyRefreshing = isFetching || isRefreshingManual;

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <div className="p-1.5 rounded-lg bg-emerald-600/20 text-emerald-400 border border-emerald-500/30">
              <Rocket className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              IPO Watch & Grey Market Premium (GMP)
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              PRIMARY MARKET
            </span>
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              <Radio className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
              LIVE NSE &amp; GMP FEED
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time tracker for Mainline &amp; SME IPOs: live NSE official bidding
            data, current Grey Market Premium (GMP), expected listing gains, and
            subscription multiples.
          </p>
        </div>

        <button
          onClick={handleManualRefresh}
          disabled={busyRefreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw
            className={cn(
              "w-3.5 h-3.5",
              busyRefreshing && "animate-spin text-emerald-400"
            )}
          />
          <span>{busyRefreshing ? "Refreshing Live Data..." : "Refresh IPOs"}</span>
        </button>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-emerald-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Currently Open IPOs</span>
            <Clock className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 font-mono">
            {openCount} Issues
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Accepting retail &amp; HNI bids now
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Upcoming Pipeline</span>
            <Calendar className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            {upcomingCount} IPOs
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Slated for subscription this month
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Highest GMP Issue</span>
            <TrendingUp className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 font-mono truncate">
            {highestGmp?.name || "--"}
          </div>
          <div className="text-xs text-emerald-400 font-semibold mt-1">
            {highestGmp?.gmpPercent
              ? `+${highestGmp.gmpPercent.toFixed(1)}% Expected Listing Gain`
              : "Awaiting GMP quote"}
          </div>
        </div>

        <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-indigo-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>SME Pipeline</span>
            <Layers className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl font-bold text-indigo-300 font-mono">
            {smeCount} Issues
          </div>
          <div className="text-xs text-slate-400 mt-1">
            NSE Emerge &amp; BSE SME issues tracked
          </div>
        </div>
      </div>

      {/* Tabs & Search */}
      <div className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 overflow-x-auto">
          {(
            [
              { id: "ALL", label: "All Issues" },
              { id: "OPEN", label: `Open (${openCount})` },
              { id: "UPCOMING", label: `Upcoming (${upcomingCount})` },
              { id: "SME", label: `SME (${smeCount})` },
              { id: "LISTED", label: "Recently Listed" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap",
                activeTab === tab.id
                  ? "bg-emerald-600 text-white font-semibold shadow-sm"
                  : "text-slate-400 hover:text-white"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Search company or symbol..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 border border-slate-700/80 text-white placeholder:text-slate-500 text-xs focus:outline-none focus:border-emerald-500"
          />
        </div>
      </div>

      {/* IPO Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className="h-56 rounded-xl bg-slate-900/40 animate-pulse border border-slate-800/40"
            />
          ))}
        </div>
      ) : filteredIpos.length === 0 ? (
        <div className="text-center py-12 bg-slate-900/30 rounded-xl border border-slate-800/40">
          <Rocket className="w-8 h-8 text-slate-500 mx-auto mb-2" />
          <p className="text-sm text-slate-400">
            No IPOs found for the selected filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredIpos.map((ipo) => {
            const isListed = ipo.status === "LISTED";
            const isOpen = ipo.status === "OPEN";

            return (
              <div
                key={ipo.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 shadow-md transition-all flex flex-col justify-between space-y-3"
              >
                {/* Header Row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-base font-bold text-white tracking-tight truncate">
                        {ipo.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-blue-400">
                        {ipo.symbol}
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 rounded bg-slate-800">
                        {ipo.exchange}
                      </span>
                      {ipo.isSme && (
                        <span className="text-[10px] text-indigo-300 font-bold px-1.5 py-0.5 rounded bg-indigo-950/60 border border-indigo-800/40">
                          SME
                        </span>
                      )}
                    </div>
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0",
                      isOpen
                        ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 animate-pulse"
                        : isListed
                        ? "bg-slate-800 text-slate-300 border border-slate-700"
                        : "bg-blue-500/20 text-blue-400 border border-blue-500/40"
                    )}
                  >
                    {ipo.status}
                  </span>
                </div>

                {/* GMP Callout Banner */}
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-800/40 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-emerald-400 font-semibold block uppercase tracking-wider flex items-center gap-1">
                      {ipo.trend && <span>{ipo.trend}</span>}
                      Grey Market Premium (GMP)
                    </span>
                    <span className="text-base font-bold font-mono text-white">
                      {ipo.gmp > 0 ? `+₹${ipo.gmp}` : `₹${ipo.gmp}`}{" "}
                      <span className="text-xs text-emerald-300">
                        ({ipo.gmpPercent.toFixed(1)}%)
                      </span>
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">
                      {isListed ? "Listing Price" : "Est. Listing Price"}
                    </span>
                    <span className="text-sm font-bold font-mono text-emerald-400">
                      ₹{ipo.expectedListingPrice > 0 ? ipo.expectedListingPrice : "--"}
                    </span>
                  </div>
                </div>

                {/* Issue Details Grid */}
                <div className="grid grid-cols-2 gap-2 text-xs py-1 border-y border-slate-800/60 font-mono">
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">
                      Price Band
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {ipo.issuePriceMin > 0 && ipo.issuePriceMax > 0
                        ? ipo.issuePriceMin === ipo.issuePriceMax
                          ? `₹${ipo.issuePriceMax}`
                          : `₹${ipo.issuePriceMin} – ₹${ipo.issuePriceMax}`
                        : "To be announced"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-sans block">
                      Lot Size / Min Inv
                    </span>
                    <span className="text-slate-200 font-semibold">
                      {ipo.lotSize > 0
                        ? `${ipo.lotSize} sh (~₹${ipo.minInvestment.toLocaleString(
                            "en-IN"
                          )})`
                        : "--"}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 font-sans block">
                      Subscription
                    </span>
                    <span className="text-blue-400 font-bold">
                      {ipo.subscriptionTotal > 0
                        ? `${ipo.subscriptionTotal}x Total`
                        : isOpen
                        ? "Bidding in progress"
                        : isListed
                        ? (ipo.listingGainPercent
                            ? `+${ipo.listingGainPercent}% Listing Gain`
                            : "Listed")
                        : "Opening soon"}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-500 font-sans block">
                      {isListed ? "Listing Date" : "Bidding Dates"}
                    </span>
                    <span className="text-slate-300 truncate block">
                      {isListed
                        ? ipo.listingDate
                        : ipo.openDate && ipo.closeDate
                        ? ipo.openDate === ipo.closeDate
                          ? ipo.openDate
                          : `${ipo.openDate} to ${ipo.closeDate}`
                        : "TBA"}
                    </span>
                  </div>
                </div>

                {/* Subscription Sub-Meter if active */}
                {ipo.subscriptionTotal > 0 ? (
                  <div className="text-[10.5px] text-slate-400 flex items-center justify-between font-mono bg-slate-950/60 p-2 rounded">
                    <span>QIB: {ipo.subscriptionQIB}x</span>
                    <span>NII: {ipo.subscriptionNII}x</span>
                    <span>Retail: {ipo.subscriptionRetail}x</span>
                  </div>
                ) : (
                  ipo.lastUpdated && (
                    <div className="text-[10px] text-slate-500 flex items-center justify-between font-mono">
                      <span>Source: Live Primary Feed</span>
                      <span>{ipo.lastUpdated}</span>
                    </div>
                  )
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

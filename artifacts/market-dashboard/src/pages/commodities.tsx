import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  RefreshCw,
  Coins,
  Flame,
  Globe,
  MapPin,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CityGoldRate {
  city: string;
  gold24k: number;
  gold22k: number;
  silver1kg: number;
  change: number;
}

interface CommodityQuote {
  symbol: string;
  name: string;
  unit: string;
  priceINR: number;
  priceUSD?: number;
  change: number;
  changePercent: number;
  exchange: "MCX" | "COMEX" | "NYMEX";
}

interface CommoditiesResponse {
  nationalGold24k: number;
  nationalGold22k: number;
  nationalSilver1kg: number;
  goldSilverRatio: number;
  cities: CityGoldRate[];
  mcxQuotes: CommodityQuote[];
  lastUpdated: string;
}

export default function CommoditiesPage() {
  const { data, isLoading, refetch, isFetching } = useQuery<CommoditiesResponse>({
    queryKey: ["commodities-data"],
    queryFn: async () => {
      const res = await fetch("/api/commodities");
      if (!res.ok) throw new Error("Failed to load commodities");
      return res.json();
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-border/50">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Coins className="w-5 h-5" />
            </div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight text-white">
              Gold, Silver & MCX Commodities Desk
            </h1>
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black">
              LIVE MCX & SPOT
            </span>
          </div>
          <p className="text-xs text-slate-400">
            Real-time bullion rates for 24K and 22K Gold, 1 Kg Silver spot across major Indian cities, plus live MCX energy and base metal contracts.
          </p>
        </div>

        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-slate-900 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", isFetching && "animate-spin text-amber-400")} />
          <span>{isFetching ? "Syncing..." : "Refresh Bullion"}</span>
        </button>
      </div>

      {/* Top 4 Bullion Highlights */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 24K Gold */}
        <div className="p-4 rounded-xl bg-gradient-to-br from-amber-950/30 to-slate-900 border border-amber-500/40 shadow-sm relative overflow-hidden group hover:border-amber-400 transition-all">
          <div className="flex items-center justify-between text-amber-400 text-xs font-semibold mb-1">
            <span>24K Gold (99.9% Pure)</span>
            <Sparkles className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ₹{data?.nationalGold24k.toLocaleString("en-IN") || "--"}
          </div>
          <div className="text-xs text-amber-300/80 mt-1 flex items-center justify-between">
            <span>Per 10 Grams (Spot)</span>
            <span className="text-emerald-400 font-semibold font-mono">+₹250 today</span>
          </div>
        </div>

        {/* 22K Gold */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-amber-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>22K Gold (Jewellery Standard)</span>
            <Coins className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ₹{data?.nationalGold22k.toLocaleString("en-IN") || "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>Per 10 Grams</span>
            <span className="text-emerald-400 font-semibold font-mono">+₹230 today</span>
          </div>
        </div>

        {/* Silver */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-slate-400 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Silver 999 (Per 1 Kg)</span>
            <DollarSign className="w-4 h-4 text-slate-300" />
          </div>
          <div className="text-2xl font-bold text-white font-mono">
            ₹{data?.nationalSilver1kg.toLocaleString("en-IN") || "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1 flex items-center justify-between">
            <span>National Average</span>
            <span className="text-rose-400 font-semibold font-mono">-₹450 today</span>
          </div>
        </div>

        {/* Gold-Silver Ratio */}
        <div className="p-4 rounded-xl bg-slate-900/70 border border-slate-800 shadow-sm relative overflow-hidden group hover:border-blue-500/40 transition-all">
          <div className="flex items-center justify-between text-slate-400 text-xs mb-1">
            <span>Gold-Silver Ratio</span>
            <Globe className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold text-blue-400 font-mono">
            {data?.goldSilverRatio || "--"}
          </div>
          <div className="text-xs text-slate-400 mt-1">
            Historical Mean: 65 – 80
          </div>
        </div>
      </div>

      {/* Main Grid: City-wise Spot Rates & MCX Contracts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* City-wise Spot Gold Rates */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <MapPin className="w-4 h-4 text-amber-400" />
              <span>City-Wise Bullion Rates (India)</span>
            </h2>
            <span className="text-[10.5px] text-slate-400 font-mono">Per 10g Gold · 1kg Silver</span>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2 px-3">City</th>
                  <th className="py-2 px-3 text-right text-amber-400">24K Gold</th>
                  <th className="py-2 px-3 text-right">22K Gold</th>
                  <th className="py-2 px-3 text-right text-slate-300">Silver 1kg</th>
                  <th className="py-2 px-3 text-right">Day Chg</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {data?.cities.map((row) => (
                  <tr key={row.city} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-2 px-3 font-sans font-semibold text-white">
                      {row.city}
                    </td>
                    <td className="py-2 px-3 text-right font-bold text-amber-300">
                      ₹{row.gold24k.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      ₹{row.gold22k.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-right text-slate-300">
                      ₹{row.silver1kg.toLocaleString("en-IN")}
                    </td>
                    <td className="py-2 px-3 text-right text-emerald-400">
                      +₹{row.change}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* MCX Energy & Metals Contracts */}
        <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Flame className="w-4 h-4 text-rose-400" />
              <span>MCX Commodities & Energy Live</span>
            </h2>
            <span className="text-[10.5px] text-slate-400 font-mono">Multi Commodity Exchange</span>
          </div>

          <div className="overflow-x-auto no-scrollbar">
            <table className="w-full text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="py-2 px-3">Commodity</th>
                  <th className="py-2 px-3">Unit</th>
                  <th className="py-2 px-3 text-right">LTP (₹)</th>
                  <th className="py-2 px-3 text-right">USD ($)</th>
                  <th className="py-2 px-3 text-right">Change %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 font-mono">
                {data?.mcxQuotes.map((q) => {
                  const isPositive = q.changePercent >= 0;
                  return (
                    <tr key={q.symbol} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-2 px-3">
                        <span className="font-bold text-white block">{q.name}</span>
                        <span className="text-[10px] text-slate-500">{q.exchange}</span>
                      </td>
                      <td className="py-2 px-3 text-slate-400 font-sans text-[11px]">
                        {q.unit}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-white">
                        ₹{q.priceINR.toLocaleString("en-IN", { minimumFractionDigits: q.priceINR < 1000 ? 1 : 0 })}
                      </td>
                      <td className="py-2 px-3 text-right text-slate-400">
                        {q.priceUSD ? `$${q.priceUSD.toFixed(2)}` : "--"}
                      </td>
                      <td
                        className={cn(
                          "py-2 px-3 text-right font-semibold",
                          isPositive ? "text-emerald-400" : "text-rose-400"
                        )}
                      >
                        {isPositive ? "+" : ""}
                        {q.changePercent.toFixed(2)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

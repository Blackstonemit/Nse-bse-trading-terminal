import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, TrendingDown, Clock, Activity, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface TickerItem {
  symbol: string;
  label: string;
  price: number;
  change: number;
  changePercent: number;
}

const DEFAULT_TICKERS: TickerItem[] = [
  { symbol: "NIFTY", label: "NIFTY 50", price: 22450.30, change: 86.40, changePercent: 0.39 },
  { symbol: "BANKNIFTY", label: "BANK NIFTY", price: 47820.15, change: -124.80, changePercent: -0.26 },
  { symbol: "SENSEX", label: "SENSEX", price: 73890.50, change: 245.10, changePercent: 0.33 },
  { symbol: "GIFTNIFTY", label: "GIFT NIFTY", price: 22510.00, change: 65.00, changePercent: 0.29 },
  { symbol: "MIDCPNIFTY", label: "NIFTY MIDCAP", price: 10980.45, change: 112.30, changePercent: 1.03 },
  { symbol: "NIFTYIT", label: "NIFTY IT", price: 37450.80, change: -210.50, changePercent: -0.56 },
  { symbol: "INDIAVIX", label: "INDIA VIX", price: 13.42, change: -0.65, changePercent: -4.62 },
  { symbol: "BRENT", label: "BRENT CRUDE", price: 82.40, change: 0.55, changePercent: 0.67 },
  { symbol: "USDINR", label: "USD / INR", price: 83.12, change: -0.04, changePercent: -0.05 },
];

function getIstTime() {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + 3600000 * 5.5);
}

function checkIsMarketOpen(): { isOpen: boolean; message: string } {
  const ist = getIstTime();
  const day = ist.getDay(); // 0 = Sun, 6 = Sat
  const hours = ist.getHours();
  const mins = ist.getMinutes();
  const totalMins = hours * 60 + mins;

  // Mon-Fri: 9:15 to 15:30 IST
  const openMins = 9 * 60 + 15;
  const closeMins = 15 * 60 + 30;

  if (day === 0 || day === 6) {
    return { isOpen: false, message: "WEEKEND · MARKET CLOSED" };
  }
  if (totalMins < openMins) {
    return { isOpen: false, message: "PRE-MARKET · OPENS 09:15 AM IST" };
  }
  if (totalMins > closeMins) {
    return { isOpen: false, message: "MARKET CLOSED · OPENS 09:15 AM IST" };
  }
  return { isOpen: true, message: "LIVE NSE/BSE · MARKET OPEN" };
}

export function LiveTickerRibbon() {
  const [marketStatus, setMarketStatus] = useState(checkIsMarketOpen);

  useEffect(() => {
    const timer = setInterval(() => {
      setMarketStatus(checkIsMarketOpen());
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const pollingInterval = marketStatus.isOpen ? 2000 : 4000;

  const { data: liveQuotes, isFetching, refetch } = useQuery<Record<string, any>>({
    queryKey: ["ticker-ribbon-quotes"],
    queryFn: async () => {
      const symbols = "NIFTY,BANKNIFTY,SENSEX,GIFTNIFTY,MIDCPNIFTY,NIFTYIT,INDIAVIX";
      try {
        const res = await fetch(`/api/market/quotes?symbols=${encodeURIComponent(symbols)}&source=google`);
        if (!res.ok) return {};
        const json = await res.json();
        // Transform array to lookup map
        if (Array.isArray(json)) {
          const map: Record<string, any> = {};
          json.forEach((q: any) => {
            if (q.symbol) map[q.symbol.toUpperCase()] = q;
          });
          return map;
        }
        return json || {};
      } catch {
        return {};
      }
    },
    refetchInterval: pollingInterval,
    staleTime: 1000,
  });

  const tickerList = useMemo(() => {
    return DEFAULT_TICKERS.map((def) => {
      const live = liveQuotes?.[def.symbol] || liveQuotes?.[`^${def.symbol}`];
      if (!live) return def;
      return {
        symbol: def.symbol,
        label: def.label,
        price: live.price ?? live.regularMarketPrice ?? def.price,
        change: live.change ?? live.regularMarketChange ?? def.change,
        changePercent: live.changePercent ?? live.regularMarketChangePercent ?? def.changePercent,
      };
    });
  }, [liveQuotes]);

  return (
    <div className="w-full bg-[#080d1a] border-b border-border/40 text-xs select-none sticky top-0 z-40 backdrop-blur-md">
      <div className="flex items-center h-8 px-3 gap-2 overflow-hidden">
        {/* Market Status Pill */}
        <div className="flex items-center gap-1.5 shrink-0 px-2 py-0.5 rounded-full bg-slate-900/90 border border-slate-700/60 text-[10.5px] font-medium text-slate-300">
          <span
            className={cn(
              "w-2 h-2 rounded-full",
              marketStatus.isOpen
                ? "bg-emerald-500 animate-pulse shadow-[0_0_8px_#10b981]"
                : "bg-amber-500 shadow-[0_0_6px_#f59e0b]"
            )}
          />
          <span className="font-mono tracking-tight">{marketStatus.message}</span>
          <button
            onClick={() => refetch()}
            title="Force Instant Refresh"
            className="ml-1 text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={cn("w-2.5 h-2.5", isFetching && "animate-spin text-primary")} />
          </button>
        </div>

        {/* Scrolling Tickers */}
        <div className="flex-1 overflow-x-auto no-scrollbar flex items-center gap-4 text-nowrap pl-2">
          {tickerList.map((item) => {
            const isPositive = item.change >= 0;
            return (
              <div
                key={item.symbol}
                className="inline-flex items-center gap-1.5 hover:bg-slate-800/50 px-2 py-0.5 rounded transition-colors cursor-pointer group shrink-0"
              >
                <span className="font-semibold text-slate-300 group-hover:text-white text-[11px]">
                  {item.label}
                </span>
                <span className="font-mono font-medium text-slate-200 text-[11px]">
                  {item.price.toLocaleString("en-IN", {
                    minimumFractionDigits: item.price < 100 ? 2 : 1,
                    maximumFractionDigits: 2,
                  })}
                </span>
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-mono px-1 py-0.2 rounded font-medium",
                    isPositive
                      ? "text-emerald-400 bg-emerald-950/40 border border-emerald-800/40"
                      : "text-rose-400 bg-rose-950/40 border border-rose-800/40"
                  )}
                >
                  {isPositive ? (
                    <TrendingUp className="w-2.5 h-2.5 shrink-0" />
                  ) : (
                    <TrendingDown className="w-2.5 h-2.5 shrink-0" />
                  )}
                  {isPositive ? "+" : ""}
                  {item.changePercent.toFixed(2)}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

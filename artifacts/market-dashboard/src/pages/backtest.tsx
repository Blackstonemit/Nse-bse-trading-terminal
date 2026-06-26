import { useState, useMemo, useEffect } from "react";
import { useGetMarketHistory } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Play, Info, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// ── Black-Scholes implementation ──────────────────────────────────────────────

function erf(x: number): number {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741;
  const a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);
  const t = 1 / (1 + p * x);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return sign * y;
}

function ncdf(x: number) { return 0.5 * (1 + erf(x / Math.sqrt(2))); }

function bs(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return type === "CE" ? Math.max(S - K, 0) : Math.max(K - S, 0);
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return type === "CE"
    ? S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2)
    : K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1);
}

function bsDelta(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  return type === "CE" ? ncdf(d1) : ncdf(d1) - 1;
}

function bsTheta(S: number, K: number, T: number, r: number, sigma: number, type: "CE" | "PE"): number {
  if (T <= 0) return 0;
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const pdf1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  const term1 = -(S * sigma * pdf1) / (2 * Math.sqrt(T));
  const term2 = type === "CE"
    ? -r * K * Math.exp(-r * T) * ncdf(d2)
    : r * K * Math.exp(-r * T) * ncdf(-d2);
  return (term1 + term2) / 365;
}

// ── Technical Indicators and Backtesting for Optimizer ───────────────────────

function calcRSI(closes: number[], period: number = 14): number[] {
  const rsi = new Array(closes.length).fill(50);
  if (closes.length <= period) return rsi;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) {
      gains += diff;
    } else {
      losses -= diff;
    }
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  rsi[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    rsi[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return rsi;
}

function calcSMA(closes: number[], period: number): (number | null)[] {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

interface OptimizerBacktestResult {
  params: { [key: string]: number };
  netPnlPct: number;
  winRatePct: number;
  totalTrades: number;
  maxDrawdownPct: number;
  equityCurve: { date: string; equity: number; spot: number }[];
}

function runBacktestRSI(
  candles: any[],
  rsiValues: number[],
  buyThreshold: number,
  sellThreshold: number
): OptimizerBacktestResult {
  let inPosition = false;
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;

  let capital = 100000;
  let maxCapital = capital;
  let maxDrawdown = 0;

  const equityCurve: { date: string; equity: number; spot: number }[] = [];

  if (candles.length > 0) {
    equityCurve.push({
      date: new Date(candles[0].timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
      equity: capital,
      spot: candles[0].close
    });
  }

  for (let i = 1; i < candles.length; i++) {
    const prevRsi = rsiValues[i - 1];
    const currRsi = rsiValues[i];
    const close = candles[i].close;
    const dateStr = new Date(candles[i].timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

    if (inPosition) {
      if (currRsi >= sellThreshold) {
        const pnlPct = (close - entryPrice) / entryPrice;
        capital = capital * (1 + pnlPct);
        if (pnlPct > 0) wins++;
        trades++;
        inPosition = false;
      }
    } else {
      if (currRsi <= buyThreshold && prevRsi > buyThreshold) {
        entryPrice = close;
        inPosition = true;
      }
    }

    let currentEquity = capital;
    if (inPosition) {
      const unrealizedPnlPct = (close - entryPrice) / entryPrice;
      currentEquity = capital * (1 + unrealizedPnlPct);
    }

    if (currentEquity > maxCapital) {
      maxCapital = currentEquity;
    }
    const dd = ((maxCapital - currentEquity) / maxCapital) * 100;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }

    equityCurve.push({
      date: dateStr,
      equity: Math.round(currentEquity),
      spot: close
    });
  }

  if (inPosition && candles.length > 0) {
    const finalClose = candles[candles.length - 1].close;
    const pnlPct = (finalClose - entryPrice) / entryPrice;
    capital = capital * (1 + pnlPct);
    if (pnlPct > 0) wins++;
    trades++;
    equityCurve[equityCurve.length - 1].equity = Math.round(capital);
  }

  const netPnlPct = ((capital - 100000) / 100000) * 100;
  const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;

  return {
    params: { buyThreshold, sellThreshold },
    netPnlPct,
    winRatePct,
    totalTrades: trades,
    maxDrawdownPct: maxDrawdown,
    equityCurve
  };
}

function runBacktestSMA(
  candles: any[],
  shortSma: (number | null)[],
  longSma: (number | null)[],
  shortPeriod: number,
  longPeriod: number
): OptimizerBacktestResult {
  let inPosition = false;
  let entryPrice = 0;
  let trades = 0;
  let wins = 0;

  let capital = 100000;
  let maxCapital = capital;
  let maxDrawdown = 0;

  const equityCurve: { date: string; equity: number; spot: number }[] = [];

  if (candles.length > 0) {
    equityCurve.push({
      date: new Date(candles[0].timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
      equity: capital,
      spot: candles[0].close
    });
  }

  for (let i = 1; i < candles.length; i++) {
    const prevShort = shortSma[i - 1];
    const prevLong = longSma[i - 1];
    const currShort = shortSma[i];
    const currLong = longSma[i];
    const close = candles[i].close;
    const dateStr = new Date(candles[i].timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" });

    if (prevShort !== null && prevLong !== null && currShort !== null && currLong !== null) {
      if (inPosition) {
        if (currShort < currLong && prevShort >= prevLong) {
          const pnlPct = (close - entryPrice) / entryPrice;
          capital = capital * (1 + pnlPct);
          if (pnlPct > 0) wins++;
          trades++;
          inPosition = false;
        }
      } else {
        if (currShort > currLong && prevShort <= prevLong) {
          entryPrice = close;
          inPosition = true;
        }
      }
    }

    let currentEquity = capital;
    if (inPosition) {
      const unrealizedPnlPct = (close - entryPrice) / entryPrice;
      currentEquity = capital * (1 + unrealizedPnlPct);
    }

    if (currentEquity > maxCapital) {
      maxCapital = currentEquity;
    }
    const dd = ((maxCapital - currentEquity) / maxCapital) * 100;
    if (dd > maxDrawdown) {
      maxDrawdown = dd;
    }

    equityCurve.push({
      date: dateStr,
      equity: Math.round(currentEquity),
      spot: close
    });
  }

  if (inPosition && candles.length > 0) {
    const finalClose = candles[candles.length - 1].close;
    const pnlPct = (finalClose - entryPrice) / entryPrice;
    capital = capital * (1 + pnlPct);
    if (pnlPct > 0) wins++;
    trades++;
    equityCurve[equityCurve.length - 1].equity = Math.round(capital);
  }

  const netPnlPct = ((capital - 100000) / 100000) * 100;
  const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;

  return {
    params: { shortPeriod, longPeriod },
    netPnlPct,
    winRatePct,
    totalTrades: trades,
    maxDrawdownPct: maxDrawdown,
    equityCurve
  };
}

// ── Strategy types ────────────────────────────────────────────────────────────

type Leg = { strike: number; type: "CE" | "PE"; direction: 1 | -1 };
type Strategy = { name: string; legs: (strikes: number[]) => Leg[] };

const STRATEGIES: Record<string, Strategy> = {
  longCall:   { name: "Long Call",         legs: ([k]) => [{ strike: k, type: "CE", direction: 1 }] },
  shortCall:  { name: "Short Call",        legs: ([k]) => [{ strike: k, type: "CE", direction: -1 }] },
  longPut:    { name: "Long Put",          legs: ([k]) => [{ strike: k, type: "PE", direction: 1 }] },
  shortPut:   { name: "Short Put",         legs: ([k]) => [{ strike: k, type: "PE", direction: -1 }] },
  bullCallSpread: {
    name: "Bull Call Spread",
    legs: ([k1, k2]) => [{ strike: k1, type: "CE", direction: 1 }, { strike: k2, type: "CE", direction: -1 }],
  },
  bearPutSpread: {
    name: "Bear Put Spread",
    legs: ([k1, k2]) => [{ strike: k2, type: "PE", direction: 1 }, { strike: k1, type: "PE", direction: -1 }],
  },
};

function isSingleLeg(key: string) { return ["longCall", "shortCall", "longPut", "shortPut"].includes(key); }

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number) { return n.toFixed(2); }
function fmtPnl(n: number) { return `${n >= 0 ? "+" : ""}${n.toFixed(0)}`; }
function dateToStr(d: Date) { return d.toISOString().slice(0, 10); }

export default function BacktestPage() {
  const { settings } = useSettings();

  // ── Tab State ────────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"options" | "optimizer">("options");

  // ── Options Backtester States ────────────────────────────────────────────────
  const [symbol, setSymbol] = useState(settings.defaultSymbol);
  const [stratKey, setStratKey] = useState("longCall");
  const [strike1, setStrike1] = useState("");
  const [strike2, setStrike2] = useState("");
  const [entryDate, setEntryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30); return dateToStr(d);
  });
  const [expiryDate, setExpiryDate] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() + 7); return dateToStr(d);
  });
  const [iv, setIv] = useState(String(settings.defaultIV));
  const [lots, setLots] = useState("1");
  const [runKey, setRunKey] = useState(0);

  const enabled = runKey > 0;
  const periodDays = Math.ceil((new Date(expiryDate).getTime() - new Date(entryDate).getTime()) / 86400000) + 5;
  const period = periodDays <= 7 ? "5d" : periodDays <= 30 ? "1mo" : periodDays <= 90 ? "3mo" : periodDays <= 180 ? "6mo" : "1y";

  const yahooSymbol = symbol === "NIFTY" ? "NIFTY" : symbol === "BANKNIFTY" ? "BANKNIFTY" : symbol;

  const { data: history, isLoading, isError } = useGetMarketHistory(
    { symbol: yahooSymbol, period, interval: "1d" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: enabled && activeTab === "options", staleTime: 60000 } as any }
  );

  const results = useMemo(() => {
    if (!history || !enabled || activeTab !== "options") return null;

    const k1 = parseFloat(strike1);
    const k2 = parseFloat(strike2);
    if (!k1 || isNaN(k1)) return null;
    if (!isSingleLeg(stratKey) && (!k2 || isNaN(k2))) return null;

    const strat = STRATEGIES[stratKey];
    const strikes = isSingleLeg(stratKey) ? [k1] : [k1, k2];
    const legs = strat.legs(strikes);

    const sigma = parseFloat(iv) / 100;
    const r = settings.riskFreeRate / 100;
    const lotSize = settings.lotSize;
    const numLots = parseInt(lots) || 1;
    const multiplier = lotSize * numLots;

    const expiry = new Date(expiryDate);
    const entry = new Date(entryDate);

    const candles = history.candles.filter((c) => {
      const d = new Date(c.timestamp);
      return d >= entry && d <= expiry;
    });

    if (candles.length === 0) return null;

    const entryCandle = candles[0];
    const entrySpot = entryCandle.close;
    const entryT = (expiry.getTime() - new Date(entryCandle.timestamp).getTime()) / (365 * 86400000);

    const entryPremium = legs.reduce(
      (sum, leg) => sum + leg.direction * bs(entrySpot, leg.strike, entryT, r, sigma, leg.type),
      0
    );

    const entryDelta = legs.reduce(
      (sum, leg) => sum + leg.direction * bsDelta(entrySpot, leg.strike, entryT, r, sigma, leg.type),
      0
    );
    const entryTheta = legs.reduce(
      (sum, leg) => sum + leg.direction * bsTheta(entrySpot, leg.strike, entryT, r, sigma, leg.type),
      0
    );

    const chartData = candles.map((c) => {
      const spot = c.close;
      const T = Math.max(0, (expiry.getTime() - new Date(c.timestamp).getTime()) / (365 * 86400000));
      const currentVal = legs.reduce(
        (sum, leg) => sum + leg.direction * bs(spot, leg.strike, T, r, sigma, leg.type),
        0
      );
      const pnl = (currentVal - entryPremium) * multiplier;
      return {
        date: new Date(c.timestamp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", timeZone: "Asia/Kolkata" }),
        pnl: Math.round(pnl),
        spot: Math.round(spot),
        optionValue: Math.round(currentVal * 100) / 100,
      };
    });

    const pnls = chartData.map((d) => d.pnl);
    const maxPnl = Math.max(...pnls);
    const minPnl = Math.min(...pnls);
    const finalPnl = pnls[pnls.length - 1] ?? 0;

    const breakeven = legs.length === 1
      ? legs[0].type === "CE"
        ? legs[0].strike + entryPremium * legs[0].direction
        : legs[0].strike - entryPremium * legs[0].direction
      : null;

    // Calculate payoff curve at expiry (T = 0)
    const payoffCurve = Array.from({ length: 31 }).map((_, idx) => {
      const pct = -0.15 + (idx * 0.3) / 30; // -15% to +15%
      const spotAtExpiry = entrySpot * (1 + pct);
      
      const valueAtExpiry = legs.reduce(
        (sum, leg) => {
          const payoff = leg.type === "CE" 
            ? Math.max(spotAtExpiry - leg.strike, 0)
            : Math.max(leg.strike - spotAtExpiry, 0);
          return sum + leg.direction * payoff;
        },
        0
      );
      
      const pnlAtExpiry = (valueAtExpiry - entryPremium) * multiplier;
      
      return {
        spot: Math.round(spotAtExpiry),
        pnl: Math.round(pnlAtExpiry),
        label: `${pct >= 0 ? "+" : ""}${(pct * 100).toFixed(0)}%`
      };
    });

    return { chartData, maxPnl, minPnl, finalPnl, entryPremium, entryDelta, entryTheta, entrySpot, breakeven, legs, multiplier, payoffCurve };
  }, [history, enabled, strike1, strike2, stratKey, iv, lots, entryDate, expiryDate, settings, activeTab]);

  const needsStrike2 = !isSingleLeg(stratKey);

  // ── Strategy Sweep Optimizer States ──────────────────────────────────────────
  const [optSymbol, setOptSymbol] = useState(settings.defaultSymbol);
  const [optStrat, setOptStrat] = useState<"rsi" | "sma">("rsi");
  const [optStartDate, setOptStartDate] = useState(() => {
    const d = new Date(); d.setFullYear(d.getFullYear() - 1); return dateToStr(d);
  });
  const [optEndDate, setOptEndDate] = useState(() => {
    const d = new Date(); return dateToStr(d);
  });

  const [rsiBuyMin, setRsiBuyMin] = useState("20");
  const [rsiBuyMax, setRsiBuyMax] = useState("40");
  const [rsiBuyStep, setRsiBuyStep] = useState("5");
  const [rsiSellMin, setRsiSellMin] = useState("60");
  const [rsiSellMax, setRsiSellMax] = useState("80");
  const [rsiSellStep, setRsiSellStep] = useState("5");

  const [smaShortMin, setSmaShortMin] = useState("5");
  const [smaShortMax, setSmaShortMax] = useState("20");
  const [smaShortStep, setSmaShortStep] = useState("5");
  const [smaLongMin, setSmaLongMin] = useState("20");
  const [smaLongMax, setSmaLongMax] = useState("100");
  const [smaLongStep, setSmaLongStep] = useState("20");

  const [runOptKey, setRunOptKey] = useState(0);
  const [selectedResultIndex, setSelectedResultIndex] = useState<number>(0);

  const optEnabled = runOptKey > 0;
  const optYahooSymbol = optSymbol === "NIFTY" ? "NIFTY" : optSymbol === "BANKNIFTY" ? "BANKNIFTY" : optSymbol;
  const optDays = Math.ceil((new Date(optEndDate).getTime() - new Date(optStartDate).getTime()) / 86400000) + 5;
  const optPeriod = optDays <= 30 ? "1mo" : optDays <= 90 ? "3mo" : optDays <= 180 ? "6mo" : "1y";

  const { data: optHistory, isLoading: optLoading, isError: optError } = useGetMarketHistory(
    { symbol: optYahooSymbol, period: optPeriod, interval: "1d" },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { query: { enabled: optEnabled && activeTab === "optimizer", staleTime: 60000 } as any }
  );

  const optimizationResults = useMemo(() => {
    if (!optHistory || !optEnabled || activeTab !== "optimizer") return null;

    const start = new Date(optStartDate);
    const end = new Date(optEndDate);

    const candles = optHistory.candles.filter((c) => {
      const d = new Date(c.timestamp);
      return d >= start && d <= end;
    });

    if (candles.length === 0) return null;

    const closes = candles.map((c) => c.close);
    const resultsList: OptimizerBacktestResult[] = [];

    if (optStrat === "rsi") {
      const rsiValues = calcRSI(closes, 14);

      const buyMin = parseFloat(rsiBuyMin);
      const buyMax = parseFloat(rsiBuyMax);
      const buyStep = parseFloat(rsiBuyStep) || 1;
      const sellMin = parseFloat(rsiSellMin);
      const sellMax = parseFloat(rsiSellMax);
      const sellStep = parseFloat(rsiSellStep) || 1;

      if (buyStep <= 0 || sellStep <= 0 || buyMin > buyMax || sellMin > sellMax) {
        return [];
      }

      for (let buy = buyMin; buy <= buyMax; buy += buyStep) {
        for (let sell = sellMin; sell <= sellMax; sell += sellStep) {
          const res = runBacktestRSI(candles, rsiValues, buy, sell);
          resultsList.push(res);
        }
      }
    } else {
      const shortMin = parseInt(smaShortMin);
      const shortMax = parseInt(smaShortMax);
      const shortStep = parseInt(smaShortStep) || 1;
      const longMin = parseInt(smaLongMin);
      const longMax = parseInt(smaLongMax);
      const longStep = parseInt(smaLongStep) || 1;

      if (shortStep <= 0 || longStep <= 0 || shortMin > shortMax || longMin > longMax) {
        return [];
      }

      const smaCache: Record<number, (number | null)[]> = {};
      const getSma = (p: number) => {
        if (!smaCache[p]) {
          smaCache[p] = calcSMA(closes, p);
        }
        return smaCache[p];
      };

      for (let sh = shortMin; sh <= shortMax; sh += shortStep) {
        for (let lo = longMin; lo <= longMax; lo += longStep) {
          if (sh >= lo) continue;
          const shortSma = getSma(sh);
          const longSma = getSma(lo);
          const res = runBacktestSMA(candles, shortSma, longSma, sh, lo);
          resultsList.push(res);
        }
      }
    }

    resultsList.sort((a, b) => b.netPnlPct - a.netPnlPct);
    return resultsList;
  }, [
    optHistory,
    optEnabled,
    optStrat,
    optStartDate,
    optEndDate,
    rsiBuyMin, rsiBuyMax, rsiBuyStep,
    rsiSellMin, rsiSellMax, rsiSellStep,
    smaShortMin, smaShortMax, smaShortStep,
    smaLongMin, smaLongMax, smaLongStep,
    activeTab
  ]);

  // Reset selection index when optimization results list updates
  useEffect(() => {
    setSelectedResultIndex(0);
  }, [optimizationResults]);

  const selectedResult = useMemo(() => {
    if (!optimizationResults || optimizationResults.length === 0) return null;
    return optimizationResults[selectedResultIndex] ?? optimizationResults[0];
  }, [optimizationResults, selectedResultIndex]);

  return (
    <div className="space-y-6">
      {/* Title Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight font-mono uppercase">
          {activeTab === "options" ? "OPTIONS BACKTEST" : "STRATEGY PARAMETER OPTIMIZER"}
        </h1>
        <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground border border-muted rounded-sm px-2 py-1">
          <BarChart3 className="h-3 w-3 text-primary" />
          {activeTab === "options" ? "BLACK-SCHOLES ENGINE" : "PARAMETER SWEEP ENGINE"}
        </div>
      </div>

      {/* Persistent Tab Selection */}
      <div className="flex border-b border-muted">
        <button
          onClick={() => setActiveTab("options")}
          className={cn(
            "px-4 py-2 font-mono text-xs border-b-2 transition-colors focus:outline-none uppercase",
            activeTab === "options"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Options Backtester
        </button>
        <button
          onClick={() => setActiveTab("optimizer")}
          className={cn(
            "px-4 py-2 font-mono text-xs border-b-2 transition-colors focus:outline-none uppercase",
            activeTab === "optimizer"
              ? "border-primary text-primary font-bold"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          Strategy Sweep Optimizer
        </button>
      </div>

      {/* Conditionally Render Content */}
      {activeTab === "options" ? (
        <div className="space-y-6">
          {/* Config Card */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono">STRATEGY CONFIGURATION</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">SYMBOL</label>
                  <Input value={symbol} onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="font-mono uppercase bg-background border-muted" placeholder="NIFTY" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">STRATEGY</label>
                  <Select value={stratKey} onValueChange={setStratKey}>
                    <SelectTrigger className="font-mono border-muted bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STRATEGIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">{needsStrike2 ? "STRIKE 1 (BUY)" : "STRIKE"}</label>
                  <Input value={strike1} onChange={(e) => setStrike1(e.target.value)}
                    type="number" className="font-mono bg-background border-muted" placeholder="e.g. 23000" />
                </div>
                {needsStrike2 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-mono text-muted-foreground">STRIKE 2 (SELL)</label>
                    <Input value={strike2} onChange={(e) => setStrike2(e.target.value)}
                      type="number" className="font-mono bg-background border-muted" placeholder="e.g. 23200" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">ENTRY DATE</label>
                  <Input value={entryDate} onChange={(e) => setEntryDate(e.target.value)}
                    type="date" className="font-mono bg-background border-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">EXPIRY DATE</label>
                  <Input value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)}
                    type="date" className="font-mono bg-background border-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">IMPLIED VOL (%)</label>
                  <Input value={iv} onChange={(e) => setIv(e.target.value)}
                    type="number" step="0.5" className="font-mono bg-background border-muted" placeholder="15" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">LOTS</label>
                  <Input value={lots} onChange={(e) => setLots(e.target.value)}
                    type="number" min="1" className="font-mono bg-background border-muted" placeholder="1" />
                </div>
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={() => setRunKey((k) => k + 1)} disabled={isLoading}
                  className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
                  <Play className="h-4 w-4 mr-2" />
                  RUN BACKTEST
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Info className="h-3 w-3" />
                  Uses historical spot prices + Black-Scholes option pricing
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Options Loading State */}
          {isLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
              <Skeleton className="h-80 w-full md:col-span-4" />
            </div>
          )}

          {/* Options Error State */}
          {isError && (
            <div className="py-20 text-center border border-red-500/30 border-dashed rounded-sm bg-card">
              <h3 className="text-lg font-mono font-bold text-red-400">FAILED TO FETCH HISTORICAL DATA</h3>
              <p className="text-sm text-muted-foreground mt-2">Check the symbol and date range.</p>
            </div>
          )}

          {/* Options No-Data State */}
          {enabled && !isLoading && !isError && !results && (
            <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
              <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOR GIVEN PARAMETERS</h3>
              <p className="text-sm text-muted-foreground mt-2">
                Adjust the date range or symbol. Ensure Strike is a valid number.
              </p>
            </div>
          )}

          {/* Options Results Output */}
          {results && !isLoading && (
            <div className="space-y-4">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: "ENTRY PREMIUM", value: `₹${fmt(results.entryPremium)}`, sub: `${results.multiplier} units`, color: "text-foreground" },
                  {
                    label: "FINAL P&L",
                    value: `₹${fmtPnl(results.finalPnl)}`,
                    sub: results.finalPnl >= 0 ? "PROFIT" : "LOSS",
                    color: results.finalPnl >= 0 ? "text-success" : "text-destructive",
                  },
                  {
                    label: "MAX PROFIT",
                    value: `₹${fmtPnl(results.maxPnl)}`,
                    sub: "Peak gain",
                    color: "text-success",
                  },
                  {
                    label: "MAX LOSS",
                    value: `₹${fmtPnl(results.minPnl)}`,
                    sub: "Worst drawdown",
                    color: "text-destructive",
                  },
                ].map((s) => (
                  <Card key={s.label} className="rounded-sm border-muted bg-card">
                    <CardContent className="p-4">
                      <div className="text-xs font-mono text-muted-foreground mb-1">{s.label}</div>
                      <div className={cn("text-2xl font-bold font-mono", s.color)}>{s.value}</div>
                      <div className="text-xs font-mono text-muted-foreground mt-0.5">{s.sub}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Entry Greeks + Legs */}
              <Card className="rounded-sm border-muted bg-card">
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-xs font-mono">
                    <div><div className="text-muted-foreground mb-1">ENTRY SPOT</div><div className="font-bold text-lg">₹{fmt(results.entrySpot)}</div></div>
                    <div><div className="text-muted-foreground mb-1">DELTA</div><div className="font-bold text-lg">{fmt(results.entryDelta)}</div></div>
                    <div><div className="text-muted-foreground mb-1">THETA / DAY</div><div className="font-bold text-lg text-destructive">{fmt(results.entryTheta)}</div></div>
                    <div><div className="text-muted-foreground mb-1">BREAKEVEN</div><div className="font-bold text-lg">{results.breakeven ? `₹${fmt(results.breakeven)}` : "—"}</div></div>
                    <div>
                      <div className="text-muted-foreground mb-1">LEGS</div>
                      <div className="flex flex-wrap gap-1">
                        {results.legs.map((leg, i) => (
                          <Badge key={i} variant="outline" className={cn(
                            "text-[10px] font-mono border-0",
                            leg.direction === 1 ? "bg-success/20 text-success" : "bg-destructive/20 text-destructive"
                          )}>
                            {leg.direction === 1 ? "BUY" : "SELL"} {leg.strike} {leg.type}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* P&L Chart */}
                <Card className="rounded-sm border-muted bg-card">
                  <CardHeader className="p-4 border-b border-muted flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-mono">P&L OVER TIME (₹)</CardTitle>
                    <div className="flex items-center gap-3 text-xs font-mono">
                      {results.finalPnl >= 0
                        ? <span className="flex items-center gap-1 text-success"><TrendingUp className="h-3 w-3" /> PROFITABLE</span>
                        : <span className="flex items-center gap-1 text-destructive"><TrendingDown className="h-3 w-3" /> LOSS</span>}
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={results.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={results.finalPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={results.finalPnl >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="date" tick={{ fontSize: 10, fontFamily: "monospace", fill: "#888" }} />
                        <YAxis tick={{ fontSize: 10, fontFamily: "monospace", fill: "#888" }}
                          tickFormatter={(v) => v >= 0 ? `+${(v / 1000).toFixed(1)}K` : `${(v / 1000).toFixed(1)}K`} />
                        <Tooltip
                          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "2px", fontFamily: "monospace", fontSize: 11 }}
                          formatter={(val: number) => [`₹${fmtPnl(val)}`, "P&L"]}
                        />
                        <ReferenceLine y={0} stroke="#555" strokeDasharray="4 4" />
                        {results.maxPnl > 0 && (
                          <ReferenceLine y={results.maxPnl} stroke="#22c55e" strokeDasharray="3 3" label={{ value: "Max", fill: "#22c55e", fontSize: 9, fontFamily: "monospace" }} />
                        )}
                        {results.minPnl < 0 && (
                          <ReferenceLine y={results.minPnl} stroke="#ef4444" strokeDasharray="3 3" label={{ value: "Min", fill: "#ef4444", fontSize: 9, fontFamily: "monospace" }} />
                        )}
                        <Area type="monotone" dataKey="pnl" stroke={results.finalPnl >= 0 ? "#22c55e" : "#ef4444"}
                          strokeWidth={2} fill="url(#pnlGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                {/* Payoff Profile Chart at Expiry */}
                <Card className="rounded-sm border-muted bg-card">
                  <CardHeader className="p-4 border-b border-muted flex flex-row items-center justify-between">
                    <CardTitle className="text-sm font-mono">PAYOFF DIAGRAM AT EXPIRY (₹)</CardTitle>
                    <div className="flex items-center gap-1 text-xs font-mono text-muted-foreground">
                      <span>Max Loss/Risk capped at Strike boundaries</span>
                    </div>
                  </CardHeader>
                  <CardContent className="p-4">
                    <ResponsiveContainer width="100%" height={300}>
                      <AreaChart data={results.payoffCurve} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                        <defs>
                          <linearGradient id="payoffGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                        <XAxis dataKey="spot" tick={{ fontSize: 9, fontFamily: "monospace", fill: "#888" }} />
                        <YAxis tick={{ fontSize: 10, fontFamily: "monospace", fill: "#888" }}
                          tickFormatter={(v) => v >= 0 ? `+${(v / 1000).toFixed(1)}K` : `${(v / 1000).toFixed(1)}K`} />
                        <Tooltip
                          contentStyle={{ background: "#1a1a1a", border: "1px solid #333", borderRadius: "2px", fontFamily: "monospace", fontSize: 11 }}
                          formatter={(val: number) => [`₹${val.toLocaleString()}`, "P&L at Expiry"]}
                        />
                        <ReferenceLine y={0} stroke="#555" strokeDasharray="4 4" />
                        <ReferenceLine x={results.entrySpot} stroke="#3b82f6" strokeDasharray="3 3" label={{ value: "Entry Spot", fill: "#3b82f6", fontSize: 9, fontFamily: "monospace" }} />
                        <Area type="monotone" dataKey="pnl" stroke="#3b82f6"
                          strokeWidth={2} fill="url(#payoffGrad)" dot={false} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Daily table */}
              <Card className="rounded-sm border-muted bg-card">
                <CardHeader className="p-4 border-b border-muted">
                  <CardTitle className="text-sm font-mono">DAILY P&L BREAKDOWN</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono">
                      <thead>
                        <tr className="border-b border-muted bg-muted/20">
                          <th className="py-2 px-4 text-left text-muted-foreground font-normal">DATE</th>
                          <th className="py-2 px-4 text-right text-muted-foreground font-normal">SPOT</th>
                          <th className="py-2 px-4 text-right text-muted-foreground font-normal">OPTION VALUE</th>
                          <th className="py-2 px-4 text-right text-muted-foreground font-normal">P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {results.chartData.map((row, i) => (
                          <tr key={i} className="border-b border-muted/30 hover:bg-muted/10">
                            <td className="py-1.5 px-4">{row.date}</td>
                            <td className="py-1.5 px-4 text-right">₹{row.spot.toLocaleString("en-IN")}</td>
                            <td className="py-1.5 px-4 text-right">₹{fmt(row.optionValue)}</td>
                            <td className={cn("py-1.5 px-4 text-right font-bold", row.pnl >= 0 ? "text-success" : "text-destructive")}>
                              {fmtPnl(row.pnl)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Strategy Optimizer Form Config Card */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono">SWEEP HYPERPARAMETER CONFIGURATION</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">SYMBOL</label>
                  <Input value={optSymbol} onChange={(e) => setOptSymbol(e.target.value.toUpperCase())}
                    className="font-mono uppercase bg-background border-muted" placeholder="NIFTY" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">STRATEGY TYPE</label>
                  <Select value={optStrat} onValueChange={(v: "rsi" | "sma") => setOptStrat(v)}>
                    <SelectTrigger className="font-mono border-muted bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="rsi">RSI THRESHOLD</SelectItem>
                      <SelectItem value="sma">SMA CROSSOVER</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">START DATE</label>
                  <Input value={optStartDate} onChange={(e) => setOptStartDate(e.target.value)}
                    type="date" className="font-mono bg-background border-muted" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono text-muted-foreground">END DATE</label>
                  <Input value={optEndDate} onChange={(e) => setOptEndDate(e.target.value)}
                    type="date" className="font-mono bg-background border-muted" />
                </div>
              </div>

              <div className="border-t border-muted/50 my-4 pt-4">
                <h4 className="text-xs font-mono text-primary font-bold mb-3 uppercase">
                  {optStrat === "rsi" ? "RSI Sweep Bounds" : "SMA Period Bounds"}
                </h4>

                {optStrat === "rsi" ? (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">BUY RSI MIN</label>
                      <Input value={rsiBuyMin} onChange={(e) => setRsiBuyMin(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">BUY RSI MAX</label>
                      <Input value={rsiBuyMax} onChange={(e) => setRsiBuyMax(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">BUY RSI STEP</label>
                      <Input value={rsiBuyStep} onChange={(e) => setRsiBuyStep(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">SELL RSI MIN</label>
                      <Input value={rsiSellMin} onChange={(e) => setRsiSellMin(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">SELL RSI MAX</label>
                      <Input value={rsiSellMax} onChange={(e) => setRsiSellMax(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">SELL RSI STEP</label>
                      <Input value={rsiSellStep} onChange={(e) => setRsiSellStep(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">SHORT SMA MIN</label>
                      <Input value={smaShortMin} onChange={(e) => setSmaShortMin(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">SHORT SMA MAX</label>
                      <Input value={smaShortMax} onChange={(e) => setSmaShortMax(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">SHORT SMA STEP</label>
                      <Input value={smaShortStep} onChange={(e) => setSmaShortStep(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">LONG SMA MIN</label>
                      <Input value={smaLongMin} onChange={(e) => setSmaLongMin(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">LONG SMA MAX</label>
                      <Input value={smaLongMax} onChange={(e) => setSmaLongMax(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] font-mono text-muted-foreground">LONG SMA STEP</label>
                      <Input value={smaLongStep} onChange={(e) => setSmaLongStep(e.target.value)}
                        type="number" className="font-mono bg-background border-muted h-8" />
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center gap-3">
                <Button onClick={() => setRunOptKey((k) => k + 1)} disabled={optLoading}
                  className="font-mono bg-primary text-primary-foreground hover:bg-primary/90">
                  <Play className="h-4 w-4 mr-2" />
                  RUN SWEEP OPTIMIZER
                </Button>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                  <Info className="h-3 w-3" />
                  Sweeps parameters across all bounds using historical daily candles
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Optimizer Loading State */}
          {optLoading && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
              <Skeleton className="h-80 w-full md:col-span-4" />
            </div>
          )}

          {/* Optimizer Error State */}
          {optError && (
            <div className="py-20 text-center border border-red-500/30 border-dashed rounded-sm bg-card">
              <h3 className="text-lg font-mono font-bold text-red-400">FAILED TO FETCH HISTORICAL DATA</h3>
              <p className="text-sm text-muted-foreground mt-2">Verify that symbol and dates are correct.</p>
            </div>
          )}

          {/* Optimizer No-Data State */}
          {optEnabled && !optLoading && !optError && !optimizationResults && (
            <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
              <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA DETECTED FOR SPECIFIED DATES</h3>
              <p className="text-sm text-muted-foreground mt-2">Adjust dates or pick another asset.</p>
            </div>
          )}

          {/* Optimizer Sweep Results Output */}
          {optimizationResults && !optLoading && (
            <div className="space-y-6">
              {/* Best configuration alert banner */}
              {optimizationResults.length > 0 && (
                <div className="p-4 bg-primary/10 border border-primary/30 rounded-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/20 p-2 rounded-sm text-primary">
                      <BarChart3 className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">Optimal Parameter Configuration</div>
                      <div className="text-sm font-bold font-mono text-primary">
                        {optStrat === "rsi"
                          ? `RSI Buy Level: ${optimizationResults[0].params.buyThreshold} · RSI Sell Level: ${optimizationResults[0].params.sellThreshold}`
                          : `Short SMA Period: ${optimizationResults[0].params.shortPeriod} · Long SMA Period: ${optimizationResults[0].params.longPeriod}`}
                        {" — "}Net Return: {optimizationResults[0].netPnlPct.toFixed(2)}% (Win Rate: {optimizationResults[0].winRatePct.toFixed(1)}%)
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Split layout: Results grid list on left, Equity curve analysis on right */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Sweep List (Left - 7 cols) */}
                <Card className="lg:col-span-7 rounded-sm border-muted bg-card flex flex-col h-[500px]">
                  <CardHeader className="p-4 border-b border-muted shrink-0">
                    <CardTitle className="text-sm font-mono flex items-center justify-between">
                      <span>SWEEP RUN COMBINATIONS ({optimizationResults.length})</span>
                      <span className="text-[10px] text-muted-foreground font-normal">Sorted by Net P&L</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 overflow-y-auto flex-1 min-h-0">
                    <table className="w-full text-xs font-mono text-left">
                      <thead className="sticky top-0 bg-[#0c0c0c] border-b border-muted z-10">
                        <tr>
                          <th className="py-2 px-3 text-muted-foreground font-normal">
                            {optStrat === "rsi" ? "BUY / SELL" : "SHORT / LONG"}
                          </th>
                          <th className="py-2 px-3 text-right text-muted-foreground font-normal">TRADES</th>
                          <th className="py-2 px-3 text-right text-muted-foreground font-normal">WIN RATE</th>
                          <th className="py-2 px-3 text-right text-muted-foreground font-normal">MAX DD</th>
                          <th className="py-2 px-3 text-right text-muted-foreground font-normal">NET RETURN</th>
                        </tr>
                      </thead>
                      <tbody>
                        {optimizationResults.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="text-center py-8 text-muted-foreground">
                              No configurations tested. Double check sweep limits.
                            </td>
                          </tr>
                        ) : (
                          optimizationResults.map((row, idx) => {
                            const isOptimal = idx === 0;
                            const isSelected = idx === selectedResultIndex;
                            const paramText = optStrat === "rsi"
                              ? `${row.params.buyThreshold} / ${row.params.sellThreshold}`
                              : `${row.params.shortPeriod} / ${row.params.longPeriod}`;
                            return (
                              <tr
                                key={idx}
                                onClick={() => setSelectedResultIndex(idx)}
                                className={cn(
                                  "border-b border-muted/20 cursor-pointer hover:bg-muted/10 transition-colors",
                                  isSelected && "bg-primary/10 border-l-2 border-l-primary",
                                  !isSelected && isOptimal && "bg-success/5"
                                )}
                              >
                                <td className="py-2 px-3 flex items-center gap-1.5 font-bold">
                                  {paramText}
                                  {isOptimal && (
                                    <Badge variant="outline" className="text-[8px] bg-primary/20 text-primary border-primary/30 h-4 py-0 px-1 font-bold">
                                      BEST
                                    </Badge>
                                  )}
                                </td>
                                <td className="py-2 px-3 text-right">{row.totalTrades}</td>
                                <td className="py-2 px-3 text-right">{row.winRatePct.toFixed(1)}%</td>
                                <td className="py-2 px-3 text-right text-destructive">{row.maxDrawdownPct.toFixed(1)}%</td>
                                <td className={cn("py-2 px-3 text-right font-bold", row.netPnlPct >= 0 ? "text-success" : "text-destructive")}>
                                  {row.netPnlPct >= 0 ? "+" : ""}{row.netPnlPct.toFixed(2)}%
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </CardContent>
                </Card>

                {/* Equity Curve Analysis Details (Right - 5 cols) */}
                <div className="lg:col-span-5 space-y-4 flex flex-col justify-between">
                  {selectedResult ? (
                    <>
                      {/* Metric widgets */}
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          {
                            label: "SELECTED CONFIG",
                            value: optStrat === "rsi"
                              ? `RSI: ${selectedResult.params.buyThreshold} / ${selectedResult.params.sellThreshold}`
                              : `SMA: ${selectedResult.params.shortPeriod} / ${selectedResult.params.longPeriod}`,
                            sub: selectedResultIndex === 0 ? "Optimal Config" : `Rank #${selectedResultIndex + 1} of ${optimizationResults.length}`,
                            color: "text-foreground"
                          },
                          {
                            label: "NET RETURN P&L",
                            value: `${selectedResult.netPnlPct >= 0 ? "+" : ""}${selectedResult.netPnlPct.toFixed(2)}%`,
                            sub: `Capital: ₹${selectedResult.equityCurve[selectedResult.equityCurve.length - 1]?.equity.toLocaleString()}`,
                            color: selectedResult.netPnlPct >= 0 ? "text-success" : "text-destructive"
                          },
                          {
                            label: "STRATEGY WIN RATE",
                            value: `${selectedResult.winRatePct.toFixed(1)}%`,
                            sub: `${selectedResult.totalTrades} completed trades`,
                            color: "text-foreground"
                          },
                          {
                            label: "MAX DD RISK",
                            value: `${selectedResult.maxDrawdownPct.toFixed(1)}%`,
                            sub: "Max peak-to-valley loss",
                            color: "text-destructive"
                          }
                        ].map((s) => (
                          <Card key={s.label} className="rounded-sm border-muted bg-card">
                            <CardContent className="p-3">
                              <div className="text-[9px] font-mono text-muted-foreground mb-0.5">{s.label}</div>
                              <div className={cn("text-base font-bold font-mono truncate", s.color)}>{s.value}</div>
                              <div className="text-[9px] font-mono text-muted-foreground">{s.sub}</div>
                            </CardContent>
                          </Card>
                        ))}
                      </div>

                      {/* Performance Plot chart */}
                      <Card className="rounded-sm border-muted bg-card flex flex-col h-[380px] lg:h-[350px]">
                        <CardHeader className="p-3 border-b border-muted">
                          <CardTitle className="text-xs font-mono flex items-center justify-between">
                            <span>PORTFOLIO EQUITY GRAPH (₹)</span>
                            <span className="text-[9px] text-muted-foreground font-normal">Initial: ₹100,000</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="p-3 flex-1 min-h-0">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={selectedResult.equityCurve} margin={{ top: 10, right: 5, left: -22, bottom: 0 }}>
                              <defs>
                                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={selectedResult.netPnlPct >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                                  <stop offset="95%" stopColor={selectedResult.netPnlPct >= 0 ? "#22c55e" : "#ef4444"} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fontFamily: "monospace", fill: "#555" }} />
                              <YAxis
                                domain={["dataMin - 1000", "dataMax + 1000"]}
                                tick={{ fontSize: 9, fontFamily: "monospace", fill: "#555" }}
                                tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}K`}
                              />
                              <Tooltip
                                contentStyle={{ background: "#111", border: "1px solid #333", borderRadius: "2px", fontFamily: "monospace", fontSize: 10 }}
                                formatter={(val: number) => [`₹${val.toLocaleString()}`, "Equity"]}
                              />
                              <ReferenceLine y={100000} stroke="#444" strokeDasharray="3 3" />
                              <Area
                                type="monotone"
                                dataKey="equity"
                                stroke={selectedResult.netPnlPct >= 0 ? "#22c55e" : "#ef4444"}
                                strokeWidth={1.5}
                                fill="url(#equityGrad)"
                                dot={false}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        </CardContent>
                      </Card>
                    </>
                  ) : (
                    <div className="flex-1 flex items-center justify-center border border-dashed border-muted rounded-sm py-16 text-muted-foreground text-xs font-mono">
                      No configuration selected.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

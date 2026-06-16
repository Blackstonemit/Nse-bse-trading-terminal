import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetOptionsChain,
  getGetOptionsChainQueryKey,
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import type { OptionContract } from "@workspace/api-client-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Search, Download, RefreshCw, Radio, Upload, X, GitCompare, 
  ChevronDown, ChevronUp, AlertTriangle, Plus, Trash2, Zap, Workflow, Loader2, Info
} from "lucide-react";
import { AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

// ── Types ─────────────────────────────────────────────────────────────────────

interface StrategyLeg {
  id: string;
  action: "BUY" | "SELL";
  type: "CE" | "PE";
  strike: number;
  premium: number;
  qty: number;
}

type NseContract = OptionContract & {
  changeInOI?: number;
  bid?: number;
  ask?: number;
  bidQty?: number;
  askQty?: number;
};

type ChainData = {
  symbol: string;
  underlyingPrice: number;
  expiries: string[];
  selectedExpiry: string;
  calls: NseContract[];
  puts: NseContract[];
  dataSource?: string;
  timestamp?: string;
  bseWarning?: string | null;
};

type CsvLeg = {
  oi: number | null;
  chgOI: number | null;
  vol: number | null;
  iv: number | null;
  ltp: number | null;
  chg: number | null;
  bid: number | null;
  ask: number | null;
};

type CsvRow = {
  strike: number;
  call: CsvLeg;
  put: CsvLeg;
};

// ── CSV Parsing ───────────────────────────────────────────────────────────────

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') { inQuotes = !inQuotes; }
    else if (ch === "," && !inQuotes) { result.push(current); current = ""; }
    else { current += ch; }
  }
  result.push(current);
  return result;
}

function parseNum(s: string): number | null {
  if (!s || s.trim() === "-" || s.trim() === "") return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

function parseNseCsv(content: string): CsvRow[] {
  const lines = content.split("\n").filter((l) => l.trim());
  // Skip header rows (CALLS,,PUTS and column header row)
  const dataLines = lines.slice(2);
  const rows: CsvRow[] = [];
  for (const line of dataLines) {
    const cols = parseCSVLine(line);
    if (cols.length < 22) continue;
    const strike = parseNum(cols[11]);
    if (!strike) continue;
    rows.push({
      strike,
      call: { oi: parseNum(cols[1]), chgOI: parseNum(cols[2]), vol: parseNum(cols[3]), iv: parseNum(cols[4]), ltp: parseNum(cols[5]), chg: parseNum(cols[6]), bid: parseNum(cols[8]), ask: parseNum(cols[9]) },
      put: { oi: parseNum(cols[21]), chgOI: parseNum(cols[20]), vol: parseNum(cols[19]), iv: parseNum(cols[18]), ltp: parseNum(cols[17]), chg: parseNum(cols[16]), bid: parseNum(cols[13]), ask: parseNum(cols[14]) },
    });
  }
  return rows;
}

// ── Formatters ────────────────────────────────────────────────────────────────

function fmtIn(n: number) {
  if (n >= 10_000_000) return (n / 10_000_000).toFixed(2) + "Cr";
  if (n >= 100_000) return (n / 100_000).toFixed(2) + "L";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

function fmtOI(n: number) {
  if (Math.abs(n) >= 100_000) return (n / 100_000).toFixed(2) + "L";
  if (Math.abs(n) >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString("en-IN");
}

function diffPct(live: number | undefined | null, csv: number | null): number | null {
  if (live == null || csv == null || csv === 0) return null;
  return ((live - csv) / csv) * 100;
}

function DiffBadge({ live, csv }: { live: number | undefined | null; csv: number | null }) {
  const d = diffPct(live, csv);
  if (d === null) return <span className="text-muted-foreground">—</span>;
  const abs = Math.abs(d);
  const color = abs < 1 ? "text-green-400" : abs < 5 ? "text-yellow-400" : "text-red-400";
  return <span className={cn("font-mono text-[10px]", color)}>{d >= 0 ? "+" : ""}{d.toFixed(1)}%</span>;
}

function Chng({ v, decimals = 2 }: { v: number; decimals?: number }) {
  if (v === 0) return <span className="text-muted-foreground">–</span>;
  return (
    <span className={v > 0 ? "text-green-400" : "text-red-400"}>
      {v > 0 ? "+" : ""}{v.toFixed(decimals)}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function OptionsChain() {
  const [symbol, setSymbol] = useState("NIFTY");
  const [searchInput, setSearchInput] = useState("NIFTY");
  const [expiry, setExpiry] = useState<string>("");
  const [csvRows, setCsvRows] = useState<CsvRow[] | null>(null);
  const [csvFileName, setCsvFileName] = useState<string>("");
  const [viewMode, setViewMode] = useState<"live" | "compare">("live");
  const [compareExpanded, setCompareExpanded] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // ── Greeks & Strategy Builder States ──────────────────────────────────────
  const [showGreeks, setShowGreeks] = useState<boolean>(() => {
    try { return localStorage.getItem("options_show_greeks") === "true"; } catch { return false; }
  });
  const toggleGreeks = () => {
    setShowGreeks((prev) => {
      const next = !prev;
      try { localStorage.setItem("options_show_greeks", String(next)); } catch {}
      return next;
    });
  };

  const [strategyBuilderOpen, setStrategyBuilderOpen] = useState<boolean>(() => {
    try { return localStorage.getItem("options_builder_open") === "true"; } catch { return false; }
  });
  const toggleStrategyBuilder = () => {
    setStrategyBuilderOpen((prev) => {
      const next = !prev;
      try { localStorage.setItem("options_builder_open", String(next)); } catch {}
      return next;
    });
  };

  const [legs, setLegs] = useState<StrategyLeg[]>([]);
  const [executingStrategy, setExecutingStrategy] = useState(false);

  const queryParams = useMemo(() => ({ symbol, expiry: expiry || undefined }), [symbol, expiry]);
  const { data: rawData, isLoading, isError, dataUpdatedAt } = useGetOptionsChain(queryParams, {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    query: { staleTime: 5 * 60 * 1000, refetchOnWindowFocus: false } as any,
  });
  const chainData = rawData as ChainData | undefined;

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh: liveRefresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetOptionsChainQueryKey(queryParams) });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) { setSymbol(searchInput.trim().toUpperCase()); setExpiry(""); }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: getGetOptionsChainQueryKey({ symbol, expiry: expiry || undefined }) });
  };

  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const parsed = parseNseCsv(text);
      if (parsed.length > 0) { setCsvRows(parsed); setViewMode("compare"); }
      else alert("Could not parse CSV. Ensure it is an NSE option chain export.");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const clearCsv = () => { setCsvRows(null); setCsvFileName(""); setViewMode("live"); };

  const addLeg = useCallback((contract: NseContract, action: "BUY" | "SELL") => {
    setLegs((prev) => {
      const existingIdx = prev.findIndex(
        (l) => l.strike === contract.strikePrice && l.type === contract.type && l.action === action
      );
      if (existingIdx >= 0) {
        return prev.map((l, idx) => (idx === existingIdx ? { ...l, qty: l.qty + 50 } : l));
      }
      const newLeg: StrategyLeg = {
        id: String(Date.now() + Math.random()),
        action,
        type: contract.type === "CE" ? "CE" : "PE",
        strike: contract.strikePrice,
        premium: contract.ltp,
        qty: 50,
      };
      return [...prev, newLeg];
    });
    setStrategyBuilderOpen(true);
    try { localStorage.setItem("options_builder_open", "true"); } catch {}
  }, []);

  const deleteLeg = useCallback((id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }, []);

  const updateLeg = useCallback((id: string, key: keyof StrategyLeg, val: any) => {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, [key]: val } : l)));
  }, []);

  const clearLegs = useCallback(() => {
    setLegs([]);
  }, []);

  const strategyStats = useMemo(() => {
    if (legs.length === 0 || !chainData) return null;
    const underlyingPrice = chainData.underlyingPrice;

    let netDebitCredit = 0;
    legs.forEach((l) => {
      const cost = l.premium * l.qty;
      if (l.action === "BUY") {
        netDebitCredit -= cost;
      } else {
        netDebitCredit += cost;
      }
    });

    const strikes = legs.map((l) => l.strike);
    const minStrike = Math.min(...strikes, underlyingPrice);
    const maxStrike = Math.max(...strikes, underlyingPrice);
    const range = maxStrike - minStrike || 500;

    const startSpot = Math.max(0, minStrike - range * 0.7);
    const endSpot = maxStrike + range * 0.7;
    const step = (endSpot - startSpot) / 100;

    const chartData = [];
    let maxProfit = -Infinity;
    let minProfit = Infinity;

    for (let s = startSpot; s <= endSpot; s += step) {
      let totalPayoff = 0;
      legs.forEach((l) => {
        let payoff = 0;
        if (l.type === "CE") {
          payoff = Math.max(s - l.strike, 0);
        } else {
          payoff = Math.max(l.strike - s, 0);
        }

        if (l.action === "BUY") {
          totalPayoff += (payoff - l.premium) * l.qty;
        } else {
          totalPayoff += (l.premium - payoff) * l.qty;
        }
      });

      maxProfit = Math.max(maxProfit, totalPayoff);
      minProfit = Math.min(minProfit, totalPayoff);

      chartData.push({
        spot: Math.round(s),
        pnl: Math.round(totalPayoff),
        pnlPositive: totalPayoff >= 0 ? Math.round(totalPayoff) : 0,
        pnlNegative: totalPayoff < 0 ? Math.round(totalPayoff) : 0,
      });
    }

    const breakevens: number[] = [];
    for (let i = 0; i < chartData.length - 1; i++) {
      const p1 = chartData[i];
      const p2 = chartData[i + 1];
      if ((p1.pnl < 0 && p2.pnl >= 0) || (p1.pnl >= 0 && p2.pnl < 0)) {
        const t = -p1.pnl / (p2.pnl - p1.pnl);
        const beSpot = p1.spot + t * (p2.spot - p1.spot);
        breakevens.push(Math.round(beSpot));
      }
    }

    return {
      netDebitCredit,
      maxProfit: maxProfit === Infinity || maxProfit > 5000000 ? "UNLIMITED" : `₹${maxProfit.toLocaleString("en-IN")}`,
      maxLoss: minProfit === -Infinity || minProfit < -5000000 ? "UNLIMITED" : `₹${Math.abs(minProfit).toLocaleString("en-IN")}`,
      chartData,
      breakevens,
    };
  }, [legs, chainData]);

  const handleExecuteStrategy = async () => {
    if (legs.length === 0) return;
    setExecutingStrategy(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      let successCount = 0;
      await Promise.all(
        legs.map(async (l) => {
          const res = await fetch(`${base}/api/paper/trade`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              symbol: `${symbol} ${l.strike} ${l.type}`,
              action: l.action,
              price: l.premium,
              quantity: l.qty,
              type: "SIGNAL",
            }),
          });
          if (res.ok) successCount++;
        })
      );

      if (successCount === legs.length) {
        alert(`Successfully filled simulated basket containing ${legs.length} legs for ${symbol}.`);
      } else {
        alert(`Partial execution: Filled ${successCount}/${legs.length} legs.`);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/paper/trades"] });
    } catch {
      alert("Failed to place simulated option strategy.");
    } finally {
      setExecutingStrategy(false);
    }
  };

  const isNSE = chainData?.dataSource === "NSE";

  const stats = useMemo(() => {
    if (!chainData || !Array.isArray(chainData.calls) || !Array.isArray(chainData.puts)) return null;
    const totalCallOI  = chainData.calls.reduce((s, c) => s + c.openInterest, 0);
    const totalPutOI   = chainData.puts.reduce((s, p) => s + p.openInterest, 0);
    const totalCallVol = chainData.calls.reduce((s, c) => s + c.volume, 0);
    const totalPutVol  = chainData.puts.reduce((s, p) => s + p.volume, 0);
    const pcr = totalCallOI > 0 ? totalPutOI / totalCallOI : 0;
    const maxCallOI = Math.max(...chainData.calls.map((c) => c.openInterest));
    const maxPutOI  = Math.max(...chainData.puts.map((p) => p.openInterest));
    const maxCallOIStrike = chainData.calls.find((c) => c.openInterest === maxCallOI)?.strikePrice;
    const maxPutOIStrike  = chainData.puts.find((p) => p.openInterest === maxPutOI)?.strikePrice;
    return { totalCallOI, totalPutOI, totalCallVol, totalPutVol, pcr, maxCallOI, maxPutOI, maxCallOIStrike, maxPutOIStrike };
  }, [chainData]);

  const atmIndex = useMemo(() => {
    if (!chainData || !Array.isArray(chainData.calls)) return -1;
    let closest = 0, minDiff = Infinity;
    chainData.calls.forEach((c, i) => {
      const d = Math.abs(c.strikePrice - chainData.underlyingPrice);
      if (d < minDiff) { minDiff = d; closest = i; }
    });
    return closest;
  }, [chainData]);

  // CSV comparison stats
  const csvStats = useMemo(() => {
    if (!csvRows || !chainData || !Array.isArray(chainData.calls) || !Array.isArray(chainData.puts)) return null;
    const csvMap = new Map(csvRows.map((r) => [r.strike, r]));
    let matched = 0, totalCallLtpDiff = 0, totalPutLtpDiff = 0, csvCallOI = 0, csvPutOI = 0;
    for (const call of chainData.calls) {
      const csv = csvMap.get(call.strikePrice);
      if (!csv) continue;
      matched++;
      if (csv.call.ltp != null) totalCallLtpDiff += Math.abs(call.ltp - csv.call.ltp);
      if (csv.put.ltp != null) {
        const put = chainData.puts.find((p) => p.strikePrice === call.strikePrice);
        if (put) totalPutLtpDiff += Math.abs(put.ltp - csv.put.ltp);
      }
      if (csv.call.oi != null) csvCallOI += csv.call.oi;
      if (csv.put.oi != null) csvPutOI += csv.put.oi;
    }
    const liveCallOI = chainData.calls.reduce((s, c) => s + c.openInterest, 0);
    const livePutOI  = chainData.puts.reduce((s, p) => s + p.openInterest, 0);
    const csvPCR = csvCallOI > 0 ? csvPutOI / csvCallOI : 0;
    const livePCR = liveCallOI > 0 ? livePutOI / liveCallOI : 0;
    return { matched, totalRows: csvRows.length, avgCallLtpDiff: matched > 0 ? totalCallLtpDiff / matched : 0, avgPutLtpDiff: matched > 0 ? totalPutLtpDiff / matched : 0, csvCallOI, csvPutOI, liveCallOI, livePutOI, csvPCR, livePCR };
  }, [csvRows, chainData]);

  const downloadCSV = useCallback(() => {
    if (!chainData) return;
    const header = "Call OI,Call Chg OI,Call Vol,Call IV,Call LTP,Call Chg,Call Bid Qty,Call Bid,Call Ask,Call Ask Qty,Strike,Put Bid Qty,Put Bid,Put Ask,Put Ask Qty,Put Chg,Put LTP,Put IV,Put Vol,Put Chg OI,Put OI";
    const rows = [header];
    const putsByStrike = new Map(chainData.puts.map((p) => [p.strikePrice, p as NseContract]));
    chainData.calls.forEach((call) => {
      const put = putsByStrike.get(call.strikePrice);
      if (!put) return;
      rows.push([
        call.openInterest,
        call.changeInOI ?? 0,
        call.volume,
        call.impliedVolatility.toFixed(2),
        call.ltp.toFixed(2),
        call.change.toFixed(2),
        call.bidQty ?? 0,
        call.bid ?? 0,
        call.ask ?? 0,
        call.askQty ?? 0,
        call.strikePrice,
        put.bidQty ?? 0,
        put.bid ?? 0,
        put.ask ?? 0,
        put.askQty ?? 0,
        put.change.toFixed(2),
        put.ltp.toFixed(2),
        put.impliedVolatility.toFixed(2),
        put.volume,
        put.changeInOI ?? 0,
        put.openInterest,
      ].join(","));
    });
    const blob = new Blob([rows.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${symbol}_options_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  }, [chainData, symbol]);

  const callCols = showGreeks ? 14 : 10;
  const putCols  = showGreeks ? 14 : 10;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight font-mono">OPTIONS CHAIN</h1>
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={liveRefresh}
          />
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[160px] font-mono border-muted bg-card uppercase text-sm"
              placeholder="SYMBOL..." />
          </form>
          {chainData && chainData.expiries.length > 0 && (
            <Select value={expiry || chainData.selectedExpiry} onValueChange={setExpiry}>
              <SelectTrigger className="w-[150px] font-mono border-muted bg-card text-sm">
                <SelectValue placeholder="EXPIRY" />
              </SelectTrigger>
              <SelectContent>
                {chainData.expiries.map((exp) => (
                  <SelectItem key={exp} value={exp}>
                    {new Date(exp).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <button onClick={handleRefresh}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors">
            <RefreshCw className="h-3 w-3" />REFRESH
          </button>
          {chainData && (
            <button onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors">
              <Download className="h-3 w-3" />CSV
            </button>
          )}
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleCSVUpload} className="hidden" />
          {csvRows ? (
            <div className="flex items-center gap-1">
              <button onClick={() => setViewMode(viewMode === "compare" ? "live" : "compare")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-sm hover:bg-muted/30 transition-colors",
                  viewMode === "compare" ? "border-primary text-primary bg-primary/10" : "border-muted bg-card"
                )}>
                <GitCompare className="h-3 w-3" />COMPARE
              </button>
              <button onClick={clearCsv}
                className="flex items-center px-2 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors text-muted-foreground">
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border border-muted bg-card rounded-sm hover:bg-muted/30 transition-colors">
              <Upload className="h-3 w-3" />NSE CSV
            </button>
          )}
          <button
            onClick={toggleGreeks}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-sm hover:bg-muted/30 transition-colors",
              showGreeks ? "border-primary text-primary bg-primary/10 font-bold" : "border-muted bg-card"
            )}
          >
            <Workflow className="h-3 w-3" />GREEKS
          </button>
          <button
            onClick={toggleStrategyBuilder}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono border rounded-sm hover:bg-muted/30 transition-colors",
              strategyBuilderOpen ? "border-primary text-primary bg-primary/10 font-bold" : "border-muted bg-card"
            )}
          >
            <Zap className="h-3 w-3" />STRATEGY BUILDER
          </button>
        </div>
      </div>

      {isLoading ? (
        <div className="border border-muted rounded-sm bg-card p-6 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
          <div className="text-center text-xs text-muted-foreground font-mono pt-2">LOADING OPTIONS CHAIN...</div>
        </div>
      ) : isError ? (
        <div className="py-20 text-center border border-red-500/30 border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-red-400">FAILED TO LOAD OPTIONS DATA</h3>
          <p className="text-sm text-muted-foreground mt-2">Check network connection and try refreshing.</p>
        </div>
      ) : !chainData ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
        </div>
      ) : (
        <div className={cn("grid grid-cols-1 gap-6 items-start", strategyBuilderOpen ? "xl:grid-cols-12" : "xl:grid-cols-1")}>
          <div className={cn("space-y-4", strategyBuilderOpen ? "xl:col-span-8" : "xl:col-span-12")}>
          {chainData.bseWarning && (
            <div className="bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 p-3 rounded-sm text-xs font-mono flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 text-yellow-500" />
              <span>{chainData.bseWarning}</span>
            </div>
          )}
          {/* ── CSV Comparison Panel ────────────────────────────────────────── */}
          {csvRows && csvStats && viewMode === "compare" && (
            <div className="border border-primary/40 rounded-sm bg-card overflow-hidden">
              <button
                onClick={() => setCompareExpanded((e) => !e)}
                className="w-full flex items-center justify-between px-4 py-2.5 border-b border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
              >
                <div className="flex items-center gap-2 text-sm font-mono font-bold text-primary">
                  <GitCompare className="h-4 w-4" />
                  NSE CSV COMPARISON — {csvFileName}
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary bg-primary/10">
                    {csvStats.matched}/{csvStats.totalRows} STRIKES MATCHED
                  </Badge>
                  {compareExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </button>

              {compareExpanded && (
                <>
                  {/* Summary stats */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-0 divide-x divide-muted border-b border-muted text-center text-xs font-mono">
                    {[
                      { label: "LIVE PCR",     val: csvStats.livePCR.toFixed(2),  color: csvStats.livePCR > 1 ? "text-green-400" : "text-red-400" },
                      { label: "CSV PCR",      val: csvStats.csvPCR.toFixed(2),   color: csvStats.csvPCR  > 1 ? "text-green-400" : "text-red-400" },
                      { label: "LIVE CALL OI", val: fmtIn(csvStats.liveCallOI),   color: "text-blue-400" },
                      { label: "CSV CALL OI",  val: fmtIn(csvStats.csvCallOI),    color: "text-blue-300" },
                      { label: "AVG LTP DIFF", val: `CALL ₹${csvStats.avgCallLtpDiff.toFixed(2)} / PUT ₹${csvStats.avgPutLtpDiff.toFixed(2)}`, color: "text-yellow-400" },
                    ].map((s) => (
                      <div key={s.label} className="py-2 px-2">
                        <div className="text-muted-foreground text-[10px] tracking-wider">{s.label}</div>
                        <div className={cn("font-bold text-sm mt-0.5", s.color)}>{s.val}</div>
                      </div>
                    ))}
                  </div>

                  {/* Comparison table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs font-mono border-collapse" style={{ minWidth: "860px" }}>
                      <thead>
                        <tr className="border-b border-muted bg-muted/20 text-muted-foreground">
                          <th className="py-1.5 px-3 text-center bg-blue-900/20 text-blue-300 font-normal" colSpan={3}>CALL LTP</th>
                          <th className="py-1.5 px-3 text-center bg-blue-900/20 text-blue-300 font-normal" colSpan={2}>CALL OI</th>
                          <th className="py-1.5 px-3 text-center bg-muted/30 text-foreground font-bold">STRIKE</th>
                          <th className="py-1.5 px-3 text-center bg-red-900/20 text-red-300 font-normal" colSpan={2}>PUT OI</th>
                          <th className="py-1.5 px-3 text-center bg-red-900/20 text-red-300 font-normal" colSpan={3}>PUT LTP</th>
                        </tr>
                        <tr className="border-b-2 border-muted text-muted-foreground bg-muted/10 text-[10px]">
                          <th className="py-1 px-3 text-right font-normal text-blue-300">LIVE</th>
                          <th className="py-1 px-3 text-right font-normal">CSV</th>
                          <th className="py-1 px-3 text-right font-normal">DIFF</th>
                          <th className="py-1 px-3 text-right font-normal text-blue-300">LIVE</th>
                          <th className="py-1 px-3 text-right font-normal border-r border-muted">CSV</th>
                          <th className="py-1 px-3 text-center font-bold border-x border-muted bg-muted/30" />
                          <th className="py-1 px-3 text-left font-normal border-l border-muted text-red-300">LIVE</th>
                          <th className="py-1 px-3 text-left font-normal">CSV</th>
                          <th className="py-1 px-3 text-left font-normal text-red-300">LIVE</th>
                          <th className="py-1 px-3 text-left font-normal">CSV</th>
                          <th className="py-1 px-3 text-left font-normal">DIFF</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(() => {
                          const csvMap = new Map(csvRows.map((r) => [r.strike, r]));
                          const putsByStrikeCompare = new Map(chainData.puts.map((p) => [p.strikePrice, p]));
                          return chainData.calls.map((call, i) => {
                            const put = putsByStrikeCompare.get(call.strikePrice);
                            const csv = csvMap.get(call.strikePrice);
                            const isATM = i === atmIndex;
                            if (!put) return null;
                            return (
                              <tr key={call.strikePrice} className={cn(
                                "border-b border-muted/30 transition-colors",
                                isATM ? "bg-yellow-500/10" : "hover:bg-muted/10",
                                !csv ? "opacity-50" : ""
                              )}>
                                <td className="py-1.5 px-3 text-right tabular-nums text-blue-300 font-bold">{call.ltp.toFixed(2)}</td>
                                <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{csv?.call.ltp?.toFixed(2) ?? "—"}</td>
                                <td className="py-1.5 px-3 text-right"><DiffBadge live={call.ltp} csv={csv?.call.ltp ?? null} /></td>
                                <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground">{fmtOI(call.openInterest)}</td>
                                <td className="py-1.5 px-3 text-right tabular-nums text-muted-foreground border-r border-muted">{csv?.call.oi != null ? fmtOI(csv.call.oi) : "—"}</td>
                                <td className={cn("py-1.5 px-3 text-center font-bold border-x border-muted", isATM ? "bg-yellow-500/20 text-yellow-300" : "bg-muted/20")}>
                                  {isATM && <span className="text-[9px] block text-yellow-400 leading-none">ATM</span>}
                                  {call.strikePrice}
                                </td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-muted-foreground border-l border-muted">{fmtOI(put.openInterest)}</td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-muted-foreground">{csv?.put.oi != null ? fmtOI(csv.put.oi) : "—"}</td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-red-300 font-bold">{put.ltp.toFixed(2)}</td>
                                <td className="py-1.5 px-3 text-left tabular-nums text-muted-foreground">{csv?.put.ltp?.toFixed(2) ?? "—"}</td>
                                <td className="py-1.5 px-3 text-left"><DiffBadge live={put.ltp} csv={csv?.put.ltp ?? null} /></td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* ── Live Options Chain Table ─────────────────────────────────────── */}
          <div className="border border-muted rounded-sm bg-card overflow-hidden">
            {/* Underlying banner */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-4 py-2.5 border-b border-muted bg-muted/10">
              <div className="font-mono text-sm flex items-center gap-3">
                <span className="text-muted-foreground">Underlying Index:</span>
                <span className="font-bold">{symbol}</span>
                <span className="text-xl font-bold">{chainData.underlyingPrice.toFixed(2)}</span>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono">
                <span className={cn(
                  "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider border",
                  isNSE ? "text-green-400 border-green-500/40 bg-green-500/10"
                    : chainData.dataSource === "Yahoo" ? "text-yellow-400 border-yellow-500/40 bg-yellow-500/10"
                    : "text-muted-foreground border-muted/40 bg-muted/10"
                )}>
                  <Radio className="h-2.5 w-2.5" />
                  {isNSE ? "NSE LIVE" : chainData.dataSource === "Yahoo" ? "YAHOO FINANCE" : "SYNTHETIC"}
                </span>
                <span className="text-muted-foreground">
                  As on {new Date(dataUpdatedAt || Date.now()).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "Asia/Kolkata" })} IST
                </span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 sm:grid-cols-6 border-b border-muted divide-x divide-muted text-center text-xs font-mono">
              {[
                { label: "PCR", value: stats!.pcr.toFixed(2), color: stats!.pcr > 1 ? "text-green-400" : stats!.pcr < 0.7 ? "text-red-400" : "text-yellow-400" },
                { label: "CALL OI", value: fmtIn(stats!.totalCallOI), color: "text-blue-400" },
                { label: "PUT OI",  value: fmtIn(stats!.totalPutOI),  color: "text-red-400"  },
                { label: "CALL VOL",value: fmtIn(stats!.totalCallVol),color: "text-blue-300" },
                { label: "PUT VOL", value: fmtIn(stats!.totalPutVol), color: "text-red-300"  },
                { label: "MAX OI", value: null, callStrike: stats!.maxCallOIStrike, putStrike: stats!.maxPutOIStrike },
              ].map((s, i) => (
                <div key={i} className="py-2 px-2">
                  <div className="text-muted-foreground text-[10px] tracking-wider">{s.label}</div>
                  {s.value !== null
                    ? <div className={cn("font-bold text-sm mt-0.5", s.color)}>{s.value}</div>
                    : <div className="text-[11px] mt-0.5">
                        <span className="text-blue-400">C:{s.callStrike}</span>
                        <span className="text-muted-foreground mx-1">|</span>
                        <span className="text-red-400">P:{s.putStrike}</span>
                      </div>
                  }
                </div>
              ))}
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono border-collapse" style={{ minWidth: "1200px" }}>
                <thead>
                  <tr>
                    <th colSpan={callCols} className="py-2 text-center text-white bg-blue-700/80 border-r border-blue-600 font-semibold tracking-widest">CALLS</th>
                    <th className="py-2 text-center bg-muted/30 border-x border-muted font-bold text-foreground w-20">STRIKE</th>
                    <th colSpan={putCols} className="py-2 text-center text-white bg-red-700/80 border-l border-red-600 font-semibold tracking-widest">PUTS</th>
                  </tr>
                  <tr className="border-b-2 border-muted text-muted-foreground bg-muted/20 text-[11px]">
                    <th className="py-1.5 px-2 text-right font-normal">OI</th>
                    <th className="py-1.5 px-2 text-right font-normal">CHNG OI</th>
                    <th className="py-1.5 px-2 text-right font-normal">VOL</th>
                    <th className="py-1.5 px-2 text-right font-normal">IV</th>
                    {showGreeks && (
                      <>
                        <th className="py-1.5 px-2 text-right font-normal text-cyan-400">DELTA</th>
                        <th className="py-1.5 px-2 text-right font-normal text-cyan-400">GAMMA</th>
                        <th className="py-1.5 px-2 text-right font-normal text-cyan-400">THETA</th>
                        <th className="py-1.5 px-2 text-right font-normal text-cyan-400">VEGA</th>
                      </>
                    )}
                    <th className="py-1.5 px-2 text-right font-normal bg-blue-900/30 text-blue-300">LTP</th>
                    <th className="py-1.5 px-2 text-right font-normal">CHNG</th>
                    <th className="py-1.5 px-2 text-right font-normal">BID QTY</th>
                    <th className="py-1.5 px-2 text-right font-normal">BID</th>
                    <th className="py-1.5 px-2 text-right font-normal">ASK</th>
                    <th className="py-1.5 px-2 text-right font-normal border-r border-muted">ASK QTY</th>
                    <th className="py-1.5 px-2 text-center font-bold border-x border-muted bg-muted/30" />
                    <th className="py-1.5 px-2 text-left font-normal border-l border-muted">BID QTY</th>
                    <th className="py-1.5 px-2 text-left font-normal">BID</th>
                    <th className="py-1.5 px-2 text-left font-normal">ASK</th>
                    <th className="py-1.5 px-2 text-left font-normal">ASK QTY</th>
                    <th className="py-1.5 px-2 text-left font-normal">CHNG</th>
                    <th className="py-1.5 px-2 text-left font-normal bg-red-900/30 text-red-300">LTP</th>
                    {showGreeks && (
                      <>
                        <th className="py-1.5 px-2 text-left font-normal text-cyan-400">VEGA</th>
                        <th className="py-1.5 px-2 text-left font-normal text-cyan-400">THETA</th>
                        <th className="py-1.5 px-2 text-left font-normal text-cyan-400">GAMMA</th>
                        <th className="py-1.5 px-2 text-left font-normal text-cyan-400">DELTA</th>
                      </>
                    )}
                    <th className="py-1.5 px-2 text-left font-normal">IV</th>
                    <th className="py-1.5 px-2 text-left font-normal">VOL</th>
                    <th className="py-1.5 px-2 text-left font-normal">CHNG OI</th>
                    <th className="py-1.5 px-2 text-left font-normal">OI</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const putsByStrikeLive = new Map(chainData.puts.map((p) => [p.strikePrice, p as NseContract]));
                    return chainData.calls.map((call, i) => {
                      const put = putsByStrikeLive.get(call.strikePrice);
                      if (!put) return null;
                      const isATM = i === atmIndex;
                      const isCallITM = call.strikePrice < chainData.underlyingPrice;
                      const isPutITM  = put.strikePrice  > chainData.underlyingPrice;
                      const isMaxCallOI = call.openInterest === stats!.maxCallOI;
                      const isMaxPutOI  = put.openInterest  === stats!.maxPutOI;
                      const nc = call as NseContract;
                      const np = put  as NseContract;
                      return (
                        <tr key={call.strikePrice} className={cn("border-b border-muted/30 transition-colors", isATM ? "hover:bg-yellow-500/10" : "hover:bg-muted/10")}>
                          {/* CALLS */}
                          <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-yellow-500/5" : "")}>
                            <span className={isMaxCallOI ? "text-blue-400 font-bold" : "text-muted-foreground"}>{isMaxCallOI && "★ "}{fmtOI(call.openInterest)}</span>
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-yellow-500/5" : "")}>
                            <Chng v={nc.changeInOI ?? 0} />
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                            {fmtOI(call.volume)}
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                            {call.impliedVolatility.toFixed(2)}
                          </td>
                          {showGreeks && (
                            <>
                              <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                                {(call as any).delta != null ? (call as any).delta.toFixed(2) : "—"}
                              </td>
                              <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                                {(call as any).gamma != null ? (call as any).gamma.toFixed(4) : "—"}
                              </td>
                              <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                                {(call as any).theta != null ? (call as any).theta.toFixed(2) : "—"}
                              </td>
                              <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                                {(call as any).vega != null ? (call as any).vega.toFixed(2) : "—"}
                              </td>
                            </>
                          )}
                          <td className={cn("py-1.5 px-2 text-right tabular-nums font-bold relative group/btn", isCallITM ? "bg-yellow-500/10 text-yellow-200" : "bg-blue-950/20 text-blue-300")}>
                            <div className="flex items-center justify-end gap-1.5">
                              <span className="hidden group-hover/btn:flex gap-1 shrink-0">
                                <button onClick={() => addLeg(call, "BUY")} className="px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded-[2px] text-[9px] font-mono leading-none font-bold">B</button>
                                <button onClick={() => addLeg(call, "SELL")} className="px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-[2px] text-[9px] font-mono leading-none font-bold">S</button>
                              </span>
                              <span>{call.ltp.toFixed(2)}</span>
                            </div>
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums", isCallITM ? "bg-yellow-500/5" : "")}>
                            <Chng v={call.change} />
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                            {nc.bidQty ? fmtOI(nc.bidQty) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                            {nc.bid ? nc.bid.toFixed(2) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground", isCallITM ? "bg-yellow-500/5" : "")}>
                            {nc.ask ? nc.ask.toFixed(2) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-right tabular-nums text-muted-foreground border-r border-muted", isCallITM ? "bg-yellow-500/5" : "")}>
                            {nc.askQty ? fmtOI(nc.askQty) : "–"}
                          </td>

                          {/* STRIKE */}
                          <td className={cn("py-1.5 px-2 text-center font-bold border-x border-muted w-20", isATM ? "bg-yellow-500/20 text-yellow-300 ring-1 ring-inset ring-yellow-500/40" : "bg-muted/20 text-foreground")}>
                            {isATM && <span className="text-[9px] block text-yellow-400 leading-none mb-0.5">ATM</span>}
                            {call.strikePrice}
                          </td>

                          {/* PUTS */}
                          <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground border-l border-muted", isPutITM ? "bg-yellow-500/5" : "")}>
                            {np.bidQty ? fmtOI(np.bidQty) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                            {np.bid ? np.bid.toFixed(2) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                            {np.ask ? np.ask.toFixed(2) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                            {np.askQty ? fmtOI(np.askQty) : "–"}
                          </td>
                          <td className={cn("py-1.5 px-2 text-left tabular-nums", isPutITM ? "bg-yellow-500/5" : "")}>
                            <Chng v={put.change} />
                          </td>
                          <td className={cn("py-1.5 px-2 text-left tabular-nums font-bold relative group/btn", isPutITM ? "bg-yellow-500/10 text-yellow-200" : "bg-red-950/20 text-red-300")}>
                            <div className="flex items-center justify-start gap-1.5">
                              <span>{put.ltp.toFixed(2)}</span>
                              <span className="hidden group-hover/btn:flex gap-1 shrink-0">
                                <button onClick={() => addLeg(put, "BUY")} className="px-1.5 py-0.5 bg-green-500 hover:bg-green-600 text-white rounded-[2px] text-[9px] font-mono leading-none font-bold">B</button>
                                <button onClick={() => addLeg(put, "SELL")} className="px-1.5 py-0.5 bg-red-500 hover:bg-red-600 text-white rounded-[2px] text-[9px] font-mono leading-none font-bold">S</button>
                              </span>
                            </div>
                          </td>
                          {showGreeks && (
                            <>
                              <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                                {(put as any).vega != null ? (put as any).vega.toFixed(2) : "—"}
                              </td>
                              <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                                {(put as any).theta != null ? (put as any).theta.toFixed(2) : "—"}
                              </td>
                              <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                                {(put as any).gamma != null ? (put as any).gamma.toFixed(4) : "—"}
                              </td>
                              <td className={cn("py-1.5 px-2 text-left tabular-nums text-muted-foreground", isPutITM ? "bg-yellow-500/5" : "")}>
                                {(put as any).delta != null ? (put as any).delta.toFixed(2) : "—"}
                              </td>
                            </>
                          )}
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        {strategyBuilderOpen && (
          <div className="xl:col-span-4 space-y-6">
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center justify-between">
                  <span>STRATEGY BUILDER</span>
                  {legs.length > 0 && (
                    <Button onClick={clearLegs} size="sm" variant="outline" className="h-6 text-[10px] font-mono border-muted px-2">
                      <Trash2 className="h-3 w-3 mr-1" /> CLEAR
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {legs.length === 0 ? (
                  <div className="py-12 text-center text-xs font-mono text-muted-foreground border border-dashed border-muted rounded-sm">
                    <Zap className="h-6 w-6 mx-auto mb-2 text-muted-foreground/40" />
                    No legs added yet.<br />
                    Hover over option LTP and click <span className="text-green-400 font-bold">B</span> or <span className="text-red-400 font-bold">S</span> to add legs.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {legs.map((leg) => (
                      <div key={leg.id} className="flex gap-2 items-center bg-muted/10 p-2.5 rounded border border-muted/50 text-xs font-mono">
                        <div className="flex flex-col gap-1 w-16">
                          <span className="text-[8px] text-muted-foreground font-bold">ACTION</span>
                          <Select value={leg.action} onValueChange={(val: "BUY"|"SELL") => updateLeg(leg.id, "action", val)}>
                            <SelectTrigger className="h-7 text-[10px] border-muted bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="BUY">BUY</SelectItem>
                              <SelectItem value="SELL">SELL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex flex-col gap-1 w-14">
                          <span className="text-[8px] text-muted-foreground font-bold">TYPE</span>
                          <Select value={leg.type} onValueChange={(val: "CE"|"PE") => updateLeg(leg.id, "type", val)}>
                            <SelectTrigger className="h-7 text-[10px] border-muted bg-background"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="CE">CE</SelectItem>
                              <SelectItem value="PE">PE</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex-1 flex flex-col gap-1">
                          <span className="text-[8px] text-muted-foreground font-bold">STRIKE</span>
                          <Input 
                            type="number"
                            value={leg.strike}
                            onChange={(e) => updateLeg(leg.id, "strike", Number(e.target.value))}
                            className="h-7 text-xs bg-background border-muted font-mono"
                          />
                        </div>
                        <div className="w-18 flex flex-col gap-1">
                          <span className="text-[8px] text-muted-foreground font-bold">PREMIUM</span>
                          <Input 
                            type="number"
                            value={leg.premium}
                            onChange={(e) => updateLeg(leg.id, "premium", Number(e.target.value))}
                            className="h-7 text-xs bg-background border-muted font-mono"
                          />
                        </div>
                        <div className="w-14 flex flex-col gap-1">
                          <span className="text-[8px] text-muted-foreground font-bold">QTY</span>
                          <Input 
                            type="number"
                            value={leg.qty}
                            onChange={(e) => updateLeg(leg.id, "qty", Number(e.target.value))}
                            className="h-7 text-xs bg-background border-muted font-mono"
                          />
                        </div>
                        <button
                          onClick={() => deleteLeg(leg.id)}
                          className="text-muted-foreground hover:text-destructive shrink-0 mt-4"
                          title="Delete Leg"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {strategyStats && (
                  <div className="space-y-4 pt-4 border-t border-muted">
                    <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                      <div className="bg-muted/10 p-2 rounded border border-muted/30">
                        <div className="text-[8px] text-muted-foreground uppercase">Net Premium</div>
                        <div className={cn("font-bold truncate", strategyStats.netDebitCredit >= 0 ? "text-green-400" : "text-red-400")}>
                          {strategyStats.netDebitCredit >= 0 ? `+₹${strategyStats.netDebitCredit.toLocaleString("en-IN")}` : `-₹${Math.abs(strategyStats.netDebitCredit).toLocaleString("en-IN")}`}
                        </div>
                      </div>
                      <div className="bg-muted/10 p-2 rounded border border-muted/30">
                        <div className="text-[8px] text-muted-foreground uppercase">Breakevens</div>
                        <div className="font-bold text-yellow-400 truncate text-[10px]">
                          {strategyStats.breakevens.length > 0 ? strategyStats.breakevens.map(b => `₹${b}`).join(" / ") : "None"}
                        </div>
                      </div>
                      <div className="bg-muted/10 p-2 rounded border border-muted/30">
                        <div className="text-[8px] text-muted-foreground uppercase">Max Profit</div>
                        <div className="font-bold text-green-400 truncate">{strategyStats.maxProfit}</div>
                      </div>
                      <div className="bg-muted/10 p-2 rounded border border-muted/30">
                        <div className="text-[8px] text-muted-foreground uppercase">Max Loss</div>
                        <div className="font-bold text-red-400 truncate">{strategyStats.maxLoss}</div>
                      </div>
                    </div>

                    <div className="h-44 border border-muted/50 rounded p-1 bg-black/40">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={strategyStats.chartData} margin={{ top: 5, right: 5, left: -25, bottom: 5 }}>
                          <defs>
                            <linearGradient id="payoffPositiveGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#22c55e" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="payoffNegativeGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                          <XAxis dataKey="spot" tick={{ fontSize: 8, fontFamily: "monospace", fill: "#555" }} />
                          <YAxis tick={{ fontSize: 8, fontFamily: "monospace", fill: "#555" }} />
                          <Tooltip
                            contentStyle={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: "2px", fontFamily: "monospace", fontSize: 10 }}
                            formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "PnL"]}
                          />
                          <ReferenceLine y={0} stroke="#444" strokeWidth={1} />
                          <ReferenceLine x={chainData.underlyingPrice} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="3 3" />
                          <Area type="monotone" dataKey="pnlPositive" stroke="#22c55e" strokeWidth={1.5} fill="url(#payoffPositiveGrad)" dot={false} />
                          <Area type="monotone" dataKey="pnlNegative" stroke="#ef4444" strokeWidth={1.5} fill="url(#payoffNegativeGrad)" dot={false} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    <Button
                      onClick={handleExecuteStrategy}
                      disabled={legs.length === 0 || executingStrategy}
                      className="w-full font-mono text-xs font-bold bg-primary hover:bg-primary/95 text-white h-8"
                    >
                      {executingStrategy ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Zap className="h-3.5 w-3.5 mr-1.5" />}
                      EXECUTE SIMULATED BASKET
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
      )}
    </div>
  );
}

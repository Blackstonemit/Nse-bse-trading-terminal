import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { 
  Wallet, 
  TrendingUp, 
  TrendingDown, 
  ShieldAlert, 
  Loader2, 
  Play, 
  RefreshCw, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  ClipboardList, 
  CheckCircle2, 
  DollarSign, 
  X,
  Search,
  BookOpen,
  PieChart
} from "lucide-react";

type PerformanceMetrics = {
  startBalance: number;
  accountBalance: number;
  totalEquity: number;
  openPnL: number;
  realizedPnL: number;
  totalTrades: number;
  openTradesCount: number;
  closedTradesCount: number;
  winRate: number;
};

type Trade = {
  id: number;
  symbol: string;
  action: "BUY" | "SELL";
  price: number;
  quantity: number;
  type: string;
  signalId: number | null;
  status: "OPEN" | "CLOSED";
  entryTime: string;
  exitPrice: number | null;
  exitTime: string | null;
  pnl: number | null;
};

export default function PaperTradingPage() {
  const { toast } = useToast();

  // Dashboard state
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loadingMetrics, setLoadingMetrics] = useState(true);
  const [loadingTrades, setLoadingTrades] = useState(true);

  // Manual Trade Form state
  const [formSymbol, setFormSymbol] = useState("");
  const [formAction, setFormAction] = useState<"BUY" | "SELL">("BUY");
  const [formQuantity, setFormQuantity] = useState(50);
  const [formType, setFormType] = useState<"MARKET" | "LIMIT">("MARKET");
  const [formPrice, setFormPrice] = useState("");
  const [fetchingPrice, setFetchingPrice] = useState(false);
  const [currentSymbolPrice, setCurrentSymbolPrice] = useState<number | null>(null);

  // Action execution state
  const [executingTrade, setExecutingTrade] = useState(false);
  const [closingTradeId, setClosingTradeId] = useState<number | null>(null);

  // Fetch performance metrics
  const fetchMetrics = useCallback(async () => {
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/performance`);
      if (res.ok) {
        const data = await res.json();
        setMetrics(data);
      }
    } catch (err) {
      console.error("Failed to fetch performance metrics", err);
    } finally {
      setLoadingMetrics(false);
    }
  }, []);

  // Fetch trades history
  const fetchTrades = useCallback(async () => {
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trades`);
      if (res.ok) {
        const data = await res.json();
        setTrades(data);
      }
    } catch (err) {
      console.error("Failed to fetch trades", err);
    } finally {
      setLoadingTrades(false);
    }
  }, []);

  // Load initial data
  useEffect(() => {
    fetchMetrics();
    fetchTrades();
  }, [fetchMetrics, fetchTrades]);

  // Hook up automatic updates on the live refresh bar schedule
  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh: forceRefresh } = useLiveRefresh({
    onRefresh: () => {
      fetchMetrics();
      fetchTrades();
      // If we have a cached symbol price, update that too
      if (formSymbol) {
        fetchSymbolPrice(formSymbol, false);
      }
    },
  });

  // Fetch quote helper for manual form
  const fetchSymbolPrice = async (sym: string, showToast = true) => {
    if (!sym) return;
    setFetchingPrice(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/market/quotes?symbols=${sym.toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        const quote = data.find((q: any) => q.symbol.toUpperCase() === sym.toUpperCase());
        if (quote) {
          setCurrentSymbolPrice(quote.price);
          if (formType === "MARKET") {
            setFormPrice(quote.price.toString());
          }
          if (showToast) {
            toast({
              title: "Quote Fetched",
              description: `Resolved ${sym.toUpperCase()} price to ₹${quote.price.toFixed(2)}`,
            });
          }
        } else {
          setCurrentSymbolPrice(null);
          if (showToast) {
            toast({
              title: "Quote Failed",
              description: `Could not resolve quote for symbol: ${sym.toUpperCase()}`,
              variant: "destructive",
            });
          }
        }
      } else {
        setCurrentSymbolPrice(null);
      }
    } catch {
      setCurrentSymbolPrice(null);
    } finally {
      setFetchingPrice(false);
    }
  };

  const handleFetchPriceClick = (e: React.MouseEvent) => {
    e.preventDefault();
    if (formSymbol.trim()) {
      fetchSymbolPrice(formSymbol.trim(), true);
    } else {
      toast({
        title: "Missing Symbol",
        description: "Please enter a symbol code (e.g. RELIANCE, NIFTY) to fetch quotes.",
        variant: "destructive",
      });
    }
  };

  // Execute Simulated Trade
  const handleExecuteTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formSymbol.trim()) {
      toast({ title: "Validation Error", description: "Symbol code is required.", variant: "destructive" });
      return;
    }

    const priceToUse = formType === "MARKET" ? currentSymbolPrice : Number(formPrice);
    if (!priceToUse || isNaN(priceToUse) || priceToUse <= 0) {
      toast({
        title: "Validation Error",
        description: "Please check execution price. Use 'Get Live Price' or enter a valid limit price.",
        variant: "destructive",
      });
      return;
    }

    if (!formQuantity || formQuantity <= 0) {
      toast({ title: "Validation Error", description: "Quantity must be greater than 0.", variant: "destructive" });
      return;
    }

    setExecutingTrade(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: formSymbol.trim().toUpperCase(),
          action: formAction,
          price: priceToUse,
          quantity: formQuantity,
          type: formType,
        }),
      });

      if (res.ok) {
        toast({
          title: "Order Executed",
          description: `Simulated ${formAction} order for ${formQuantity} ${formSymbol.toUpperCase()} filled at ₹${priceToUse.toFixed(2)}`,
        });
        setFormSymbol("");
        setCurrentSymbolPrice(null);
        setFormPrice("");
        fetchMetrics();
        fetchTrades();
      } else {
        const errorData = await res.json();
        toast({
          title: "Execution Failed",
          description: errorData.error || "Failed to execute simulated paper trade.",
          variant: "destructive",
        });
      }
    } catch {
      toast({ title: "Execution Failed", description: "Network error submitting trade.", variant: "destructive" });
    } finally {
      setExecutingTrade(false);
    }
  };

  // Close Active Position
  const handleClosePosition = async (tradeId: number, posSymbol: string, currentPrice: number) => {
    setClosingTradeId(tradeId);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/paper/trade/${tradeId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exitPrice: currentPrice }),
      });

      if (res.ok) {
        toast({
          title: "Position Exited",
          description: `Simulated position for ${posSymbol} closed at ₹${currentPrice.toFixed(2)}`,
        });
        fetchMetrics();
        fetchTrades();
      } else {
        toast({ title: "Exit Failed", description: "Failed to close simulated trade.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Exit Failed", description: "Network error closing simulated trade.", variant: "destructive" });
    } finally {
      setClosingTradeId(null);
    }
  };

  // Separate Open and Closed Trades for rendering
  const openPositions = trades.filter((t) => t.status === "OPEN");
  const closedTrades = trades.filter((t) => t.status === "CLOSED");

  // Format currency helper
  const fmt = (num: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 2,
    }).format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-sm border border-primary/20 text-primary">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">SIMULATED PAPER TRADER</h1>
            <p className="text-xs text-muted-foreground font-mono">
              Virtual sandbox portfolio with live market valuations and immediate order entry.
            </p>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={forceRefresh}
          />
        </div>
      </div>

      {/* Metrics Grid */}
      {loadingMetrics ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} className="rounded-sm border-muted bg-card">
              <CardContent className="p-4 flex flex-col justify-center h-24">
                <Loader2 className="h-5 w-5 animate-spin text-primary mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Equity Card */}
          <Card className={cn(
            "rounded-sm border-muted transition-all bg-card relative overflow-hidden",
            metrics && metrics.openPnL >= 0 ? "border-green-500/20" : "border-red-500/20"
          )}>
            <div className={cn(
              "absolute top-0 left-0 w-1 h-full",
              metrics && metrics.openPnL >= 0 ? "bg-green-500" : "bg-red-500"
            )} />
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">PORTFOLIO EQUITY</span>
              <div className="text-xl font-bold font-mono tracking-tight tabular-nums">
                {metrics ? fmt(metrics.totalEquity) : "₹0.00"}
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono">
                {metrics && metrics.openPnL >= 0 ? (
                  <span className="text-green-400 flex items-center gap-0.5">
                    <ArrowUpRight className="h-3.5 w-3.5" />
                    {fmt(metrics.openPnL)} Unrealized P&L
                  </span>
                ) : (
                  <span className="text-red-400 flex items-center gap-0.5">
                    <ArrowDownRight className="h-3.5 w-3.5" />
                    {fmt(metrics ? metrics.openPnL : 0)} Unrealized P&L
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Account Balance Card */}
          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">CASH BALANCE</span>
              <div className="text-xl font-bold font-mono tracking-tight tabular-nums">
                {metrics ? fmt(metrics.accountBalance) : "₹0.00"}
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                Initial Capital: {metrics ? fmt(metrics.startBalance) : "₹0.00"}
              </span>
            </CardContent>
          </Card>

          {/* Realized P&L Card */}
          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">REALIZED GAINS</span>
              <div className={cn(
                "text-xl font-bold font-mono tracking-tight tabular-nums",
                metrics && metrics.realizedPnL > 0 ? "text-green-400" : metrics && metrics.realizedPnL < 0 ? "text-red-400" : ""
              )}>
                {metrics ? (metrics.realizedPnL > 0 ? "+" : "") + fmt(metrics.realizedPnL) : "₹0.00"}
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                From {metrics ? metrics.closedTradesCount : 0} Completed Trades
              </span>
            </CardContent>
          </Card>

          {/* Performance Rate Card */}
          <Card className="rounded-sm border-muted bg-card">
            <CardContent className="p-4 space-y-1">
              <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">WIN PROBABILITY</span>
              <div className="flex items-baseline gap-2">
                <div className="text-xl font-bold font-mono tracking-tight tabular-nums">
                  {metrics ? `${metrics.winRate.toFixed(1)}%` : "0.0%"}
                </div>
                <Badge variant="outline" className="border-muted text-[10px] h-4 font-mono px-1">
                  {metrics ? `${metrics.totalTrades} TOTAL` : "0 TOTAL"}
                </Badge>
              </div>
              <span className="text-xs font-mono text-muted-foreground">
                {metrics ? metrics.openTradesCount : 0} open and {metrics ? metrics.closedTradesCount : 0} closed entries
              </span>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main layout grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left column: Positions tracking (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Active Open Positions Card */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted bg-muted/10">
              <CardTitle className="text-sm font-mono flex items-center justify-between">
                <span>ACTIVE OPEN POSITIONS ({openPositions.length})</span>
                <span className="text-xs font-normal text-muted-foreground">Valued at live quotes</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTrades ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
                  <span className="text-xs font-mono text-muted-foreground block mt-2">RESOLVING SIMULATED HOLDINGS...</span>
                </div>
              ) : openPositions.length === 0 ? (
                <div className="py-12 text-center text-xs font-mono text-muted-foreground border border-dashed border-muted m-4 rounded-sm">
                  No active simulated positions open. Place a market/limit order or execute from the Scalper Room.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs font-mono text-left border-collapse">
                    <thead>
                      <tr className="border-b border-muted bg-muted/5 text-muted-foreground">
                        <th className="py-2.5 px-4">SYMBOL</th>
                        <th className="py-2.5 px-4">ACTION</th>
                        <th className="py-2.5 px-4 text-right">SIZE</th>
                        <th className="py-2.5 px-4 text-right">ENTRY PX</th>
                        <th className="py-2.5 px-4 text-right">CURRENT PX</th>
                        <th className="py-2.5 px-4 text-right">UNREALIZED P&L</th>
                        <th className="py-2.5 px-4 text-right">ACTION</th>
                      </tr>
                    </thead>
                    <tbody>
                      {openPositions.map((pos) => {
                        // Current price fallback to entry price if market lookup not resolved
                        const curPrice = pos.exitPrice || pos.price; 
                        const pnl = pos.action === "BUY" ? (curPrice - pos.price) * pos.quantity : (pos.price - curPrice) * pos.quantity;
                        const isWin = pnl >= 0;

                        return (
                          <tr key={pos.id} className="border-b border-muted/30 hover:bg-muted/5 transition-colors">
                            <td className="py-3 px-4 font-bold tracking-wider">{pos.symbol}</td>
                            <td className="py-3 px-4">
                              <Badge className={cn(
                                "text-[10px] font-mono",
                                pos.action === "BUY" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                              )}>
                                {pos.action}
                              </Badge>
                            </td>
                            <td className="py-3 px-4 text-right tabular-nums">{pos.quantity}</td>
                            <td className="py-3 px-4 text-right tabular-nums">₹{pos.price.toFixed(2)}</td>
                            <td className="py-3 px-4 text-right tabular-nums">₹{curPrice.toFixed(2)}</td>
                            <td className={cn(
                              "py-3 px-4 text-right tabular-nums font-bold",
                              isWin ? "text-green-400" : "text-red-400"
                            )}>
                              {isWin ? "+" : ""}₹{pnl.toFixed(2)}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <Button
                                size="sm"
                                variant="destructive"
                                disabled={closingTradeId === pos.id}
                                onClick={() => handleClosePosition(pos.id, pos.symbol, curPrice)}
                                className="h-7 text-[10px] font-mono px-3"
                              >
                                {closingTradeId === pos.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  "EXIT"
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Historical Trade Auditing Log */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted bg-muted/10">
              <CardTitle className="text-sm font-mono flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-primary" />
                <span>COMPLETED TRADE LOGS ({closedTrades.length})</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {loadingTrades ? (
                <div className="py-12 text-center">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : closedTrades.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-muted-foreground">
                  No completed simulated trades found in system database.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[400px]">
                  <table className="w-full text-xs font-mono text-left border-collapse">
                    <thead>
                      <tr className="border-b border-muted bg-muted/5 text-muted-foreground sticky top-0 bg-[#121212] z-10">
                        <th className="py-2.5 px-4">CLOSED TIME</th>
                        <th className="py-2.5 px-4">SYMBOL</th>
                        <th className="py-2.5 px-4">ACTION</th>
                        <th className="py-2.5 px-4 text-right">SIZE</th>
                        <th className="py-2.5 px-4 text-right">ENTRY PX</th>
                        <th className="py-2.5 px-4 text-right">EXIT PX</th>
                        <th className="py-2.5 px-4 text-right">REALIZED P&L</th>
                        <th className="py-2.5 px-4 text-right">TYPE</th>
                      </tr>
                    </thead>
                    <tbody>
                      {closedTrades.map((t) => {
                        const isWin = (t.pnl || 0) >= 0;
                        const dateFormatted = t.exitTime 
                          ? new Date(t.exitTime).toLocaleDateString("en-IN", { month: "short", day: "numeric" }) + " " + new Date(t.exitTime).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", second: "2-digit" })
                          : "—";

                        return (
                          <tr key={t.id} className="border-b border-muted/30 hover:bg-muted/5 transition-colors">
                            <td className="py-2.5 px-4 text-muted-foreground whitespace-nowrap">{dateFormatted}</td>
                            <td className="py-2.5 px-4 font-bold">{t.symbol}</td>
                            <td className="py-2.5 px-4">
                              <Badge className={cn(
                                "text-[10px] font-mono",
                                t.action === "BUY" ? "bg-green-500/10 text-green-400 border border-green-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                              )}>
                                {t.action}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-4 text-right tabular-nums">{t.quantity}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums">₹{t.price.toFixed(2)}</td>
                            <td className="py-2.5 px-4 text-right tabular-nums">₹{t.exitPrice ? t.exitPrice.toFixed(2) : "—"}</td>
                            <td className={cn(
                              "py-2.5 px-4 text-right tabular-nums font-bold",
                              isWin ? "text-green-400" : "text-red-400"
                            )}>
                              {isWin ? "+" : ""}₹{t.pnl ? t.pnl.toFixed(2) : "0.00"}
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <Badge variant="outline" className="text-[9px] font-normal border-muted text-muted-foreground uppercase">
                                {t.type}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Execution Desk (1/3 width) */}
        <div className="space-y-6">
          
          {/* Order Placement Desk */}
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted bg-muted/10 flex flex-row items-center gap-2">
              <Play className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-mono">SIMULATED EXECUTION DESK</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <form onSubmit={handleExecuteTrade} className="space-y-4 font-mono text-xs">
                
                {/* Symbol Entry */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground tracking-wider uppercase block">SYMBOL CODE</label>
                  <div className="flex gap-2">
                    <Input
                      required
                      value={formSymbol}
                      onChange={(e) => {
                        setFormSymbol(e.target.value);
                        setCurrentSymbolPrice(null); // Clear resolved price on edits
                      }}
                      placeholder="e.g. RELIANCE, TCS, NIFTY"
                      className="uppercase bg-background border-muted h-8"
                    />
                    <Button
                      type="button"
                      disabled={fetchingPrice || !formSymbol.trim()}
                      onClick={handleFetchPriceClick}
                      size="sm"
                      variant="secondary"
                      className="h-8 shrink-0 flex gap-1.5 items-center px-3"
                    >
                      {fetchingPrice ? (
                        <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                      ) : (
                        <Search className="h-3.5 w-3.5" />
                      )}
                      QUOTE
                    </Button>
                  </div>
                  {currentSymbolPrice !== null && (
                    <div className="mt-1 flex items-center justify-between text-[11px] bg-green-500/5 border border-green-500/20 px-2.5 py-1 rounded-sm">
                      <span className="text-muted-foreground">Live Market Price:</span>
                      <span className="font-bold text-green-400 font-mono">₹{currentSymbolPrice.toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Trade Action (BUY/SELL) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground tracking-wider uppercase block">ACTION TYPE</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setFormAction("BUY")}
                      className={cn(
                        "py-1.5 border rounded-sm font-bold transition-all text-center",
                        formAction === "BUY" 
                          ? "border-green-500 text-green-400 bg-green-500/10" 
                          : "border-muted text-muted-foreground hover:bg-muted/20"
                      )}
                    >
                      BUY (LONG)
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormAction("SELL")}
                      className={cn(
                        "py-1.5 border rounded-sm font-bold transition-all text-center",
                        formAction === "SELL" 
                          ? "border-red-500 text-red-400 bg-red-500/10" 
                          : "border-muted text-muted-foreground hover:bg-muted/20"
                      )}
                    >
                      SELL (SHORT)
                    </button>
                  </div>
                </div>

                {/* Quantity */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground tracking-wider uppercase block">TRADE QUANTITY</label>
                  <Input
                    type="number"
                    required
                    min={1}
                    value={formQuantity}
                    onChange={(e) => setFormQuantity(Math.max(1, Number(e.target.value)))}
                    className="bg-background border-muted h-8"
                  />
                </div>

                {/* Execution Type (MARKET / LIMIT) */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground tracking-wider uppercase block">ORDER TYPE</label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setFormType("MARKET");
                        if (currentSymbolPrice !== null) {
                          setFormPrice(currentSymbolPrice.toString());
                        } else {
                          setFormPrice("");
                        }
                      }}
                      className={cn(
                        "py-1.5 border rounded-sm transition-all text-center",
                        formType === "MARKET" 
                          ? "border-primary text-primary bg-primary/5 font-bold" 
                          : "border-muted text-muted-foreground hover:bg-muted/20"
                      )}
                    >
                      MARKET
                    </button>
                    <button
                      type="button"
                      onClick={() => setFormType("LIMIT")}
                      className={cn(
                        "py-1.5 border rounded-sm transition-all text-center",
                        formType === "LIMIT" 
                          ? "border-primary text-primary bg-primary/5 font-bold" 
                          : "border-muted text-muted-foreground hover:bg-muted/20"
                      )}
                    >
                      LIMIT
                    </button>
                  </div>
                </div>

                {/* Order Price */}
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground tracking-wider uppercase block">
                    {formType === "MARKET" ? "MARKET PRICE REFERENCE" : "LIMIT EXECUTION PRICE (₹)"}
                  </label>
                  <Input
                    type="number"
                    step="0.05"
                    required
                    disabled={formType === "MARKET"}
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder={formType === "MARKET" ? "Get Live Price first..." : "Enter limit price..."}
                    className="bg-background border-muted h-8 font-bold disabled:opacity-75 disabled:cursor-not-allowed"
                  />
                  {formType === "MARKET" && currentSymbolPrice === null && (
                    <span className="text-[9px] text-yellow-400/80 block mt-0.5">
                      ⚠️ Market order will require looking up the live quote. Click "QUOTE" above first.
                    </span>
                  )}
                </div>

                {/* Submit button */}
                <Button
                  type="submit"
                  disabled={executingTrade || (formType === "MARKET" && currentSymbolPrice === null)}
                  className="w-full h-9 mt-6 font-bold font-mono text-xs flex gap-1.5 items-center justify-center bg-primary text-primary-foreground hover:bg-primary/95"
                >
                  {executingTrade ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      PLACING ORDER...
                    </>
                  ) : (
                    <>
                      <Play className="h-3.5 w-3.5 fill-current" />
                      EXECUTE SIMULATED ORDER
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Sandbox Info Alert */}
          <Card className="rounded-sm border-muted bg-card border-dashed">
            <CardContent className="p-4 flex gap-3 text-[11px] font-mono leading-relaxed text-muted-foreground">
              <ShieldAlert className="h-5 w-5 text-yellow-400 shrink-0" />
              <div>
                <span className="font-bold text-foreground block uppercase text-[10px] tracking-wider mb-0.5">SANDBOX ENVIRONMENT</span>
                This portal runs local paper trades stored on SQLite database. Prices are mapped in real-time from Yahoo Finance Indian markets (NSE/BSE). No real financial positions or orders are placed.
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

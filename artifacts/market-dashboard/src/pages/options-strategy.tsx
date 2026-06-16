import { useState, useMemo, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { 
  Layers, 
  Plus, 
  Trash2, 
  Play, 
  Info, 
  TrendingUp, 
  TrendingDown, 
  ChevronRight, 
  Zap, 
  CheckCircle2,
  Workflow,
  Loader2
} from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Area, AreaChart } from "recharts";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
interface StrategyLeg {
  id: string;
  action: "BUY" | "SELL";
  type: "CE" | "PE";
  strike: number;
  premium: number;
  qty: number;
}

const PRESETS: Record<string, { name: string; getLegs: (spot: number) => StrategyLeg[] }> = {
  custom: { name: "Custom Strategy", getLegs: () => [] },
  bullCall: {
    name: "Bull Call Spread",
    getLegs: (spot) => [
      { id: "1", action: "BUY", type: "CE", strike: Math.round(spot / 100) * 100, premium: 120, qty: 50 },
      { id: "2", action: "SELL", type: "CE", strike: Math.round((spot + 100) / 100) * 100, premium: 65, qty: 50 }
    ]
  },
  bearPut: {
    name: "Bear Put Spread",
    getLegs: (spot) => [
      { id: "1", action: "BUY", type: "PE", strike: Math.round(spot / 100) * 100, premium: 115, qty: 50 },
      { id: "2", action: "SELL", type: "PE", strike: Math.round((spot - 100) / 100) * 100, premium: 60, qty: 50 }
    ]
  },
  straddle: {
    name: "Long Straddle",
    getLegs: (spot) => [
      { id: "1", action: "BUY", type: "CE", strike: Math.round(spot / 100) * 100, premium: 120, qty: 50 },
      { id: "2", action: "BUY", type: "PE", strike: Math.round(spot / 100) * 100, premium: 115, qty: 50 }
    ]
  },
  ironCondor: {
    name: "Iron Condor",
    getLegs: (spot) => [
      { id: "1", action: "BUY", type: "PE", strike: Math.round((spot - 200) / 100) * 100, premium: 15, qty: 50 },
      { id: "2", action: "SELL", type: "PE", strike: Math.round((spot - 100) / 100) * 100, premium: 45, qty: 50 },
      { id: "3", action: "SELL", type: "CE", strike: Math.round((spot + 100) / 100) * 100, premium: 50, qty: 50 },
      { id: "4", action: "BUY", type: "CE", strike: Math.round((spot + 200) / 100) * 100, premium: 18, qty: 50 }
    ]
  }
};

// ── Component ────────────────────────────────────────────────────────────────
export default function OptionsStrategyPage() {
  const { settings } = useSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState(settings.defaultSymbol || "NIFTY");
  const [underlyingPrice, setUnderlyingPrice] = useState(22000);
  const [legs, setLegs] = useState<StrategyLeg[]>(PRESETS.bullCall.getLegs(22000));
  const [preset, setPreset] = useState("bullCall");
  const [executing, setExecuting] = useState(false);

  // Sync preset choice to legs
  const handlePresetChange = (key: string) => {
    setPreset(key);
    if (PRESETS[key]) {
      setLegs(PRESETS[key].getLegs(underlyingPrice));
    }
  };

  // Add Leg
  const addLeg = () => {
    const nextId = String(Date.now());
    const strike = Math.round(underlyingPrice / 100) * 100;
    setLegs((prev) => [...prev, { id: nextId, action: "BUY", type: "CE", strike, premium: 100, qty: 50 }]);
    setPreset("custom");
  };

  // Delete Leg
  const deleteLeg = (id: string) => {
    setLegs((prev) => prev.filter((l) => l.id !== id));
    setPreset("custom");
  };

  // Update Leg Field
  const updateLeg = (id: string, key: keyof StrategyLeg, val: any) => {
    setLegs((prev) =>
      prev.map((l) => (l.id === id ? { ...l, [key]: val } : l))
    );
    setPreset("custom");
  };

  // Calculations for Payoff
  const stats = useMemo(() => {
    if (legs.length === 0) return null;

    let netDebitCredit = 0; // Negative is Debit, Positive is Credit
    legs.forEach((l) => {
      const cost = l.premium * l.qty;
      if (l.action === "BUY") {
        netDebitCredit -= cost;
      } else {
        netDebitCredit += cost;
      }
    });

    // Generate payoff chart spots range
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
        pnlNegative: totalPayoff < 0 ? Math.round(totalPayoff) : 0
      });
    }

    // Solve for breakevens via linear interpolation
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
      breakevens
    };
  }, [legs, underlyingPrice]);

  // Execute Simulated strategy order
  const handleExecuteStrategy = async () => {
    if (legs.length === 0) return;
    setExecuting(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      
      // Place each leg sequentially as a paper trade
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
              type: "SIGNAL"
            })
          });
          if (res.ok) successCount++;
        })
      );

      if (successCount === legs.length) {
        toast({
          title: "Strategy Placed",
          description: `Successfully filled simulated basket containing ${legs.length} legs for ${symbol}.`
        });
      } else {
        toast({
          title: "Partial Execution",
          description: `Successfully filled ${successCount}/${legs.length} legs.`,
          variant: "destructive"
        });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/paper/trades"] });
    } catch {
      toast({
        title: "Execution Error",
        description: "Failed to place simulated option strategy.",
        variant: "destructive"
      });
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-primary/10 p-2 rounded-sm border border-primary/20 text-primary">
            <Workflow className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">STRATEGY BUILDER</h1>
            <p className="text-xs text-muted-foreground font-mono">
              Build options strategy combinations with visual payoff models
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Configuration Column */}
        <div className="lg:col-span-5 space-y-6">
          <Card className="rounded-sm border-muted bg-card">
            <CardHeader className="p-4 border-b border-muted">
              <CardTitle className="text-sm font-mono flex items-center justify-between">
                <span>LEGS MANAGEMENT</span>
                <Button onClick={addLeg} size="sm" variant="outline" className="h-6 text-[10px] font-mono border-muted px-2">
                  <Plus className="h-3 w-3 mr-1" /> ADD LEG
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground">UNDERLYING</label>
                  <Input 
                    value={symbol} 
                    onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                    className="font-mono bg-background border-muted uppercase h-8 text-xs" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-mono text-muted-foreground">SPOT PRICE (₹)</label>
                  <Input 
                    type="number"
                    value={underlyingPrice} 
                    onChange={(e) => setUnderlyingPrice(Number(e.target.value))}
                    className="font-mono bg-background border-muted h-8 text-xs" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-mono text-muted-foreground">STRATEGY PRESETS</label>
                <Select value={preset} onValueChange={handlePresetChange}>
                  <SelectTrigger className="font-mono border-muted bg-background h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRESETS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Legs Table */}
              {legs.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-muted-foreground">
                  No legs active. Click Add Leg or choose a preset strategy.
                </div>
              ) : (
                <div className="space-y-3 pt-2 border-t border-muted/40">
                  {legs.map((leg, idx) => (
                    <div key={leg.id} className="flex gap-2 items-center bg-muted/10 p-2.5 rounded border border-muted/50 text-xs font-mono relative">
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
                        <span className="text-[8px] text-muted-foreground font-bold">LTP/PREM</span>
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

              <Button
                onClick={handleExecuteStrategy}
                disabled={legs.length === 0 || executing}
                className="w-full font-mono text-xs font-bold bg-primary hover:bg-primary/95 text-white h-9 mt-4"
              >
                {executing ? <Loader2 className="h-4 w-4 animate-spin mr-1.5" /> : <Zap className="h-4 w-4 mr-1.5" />}
                EXECUTE SIMULATED STRATEGY BASKET
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard / Analytics Column */}
        <div className="lg:col-span-7 space-y-6">
          {stats && (
            <div className="space-y-6">
              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { 
                    label: "NET PREMIUM", 
                    value: stats.netDebitCredit >= 0 ? `+₹${stats.netDebitCredit.toLocaleString("en-IN")}` : `-₹${Math.abs(stats.netDebitCredit).toLocaleString("en-IN")}`, 
                    sub: stats.netDebitCredit >= 0 ? "NET CREDIT" : "NET DEBIT", 
                    color: stats.netDebitCredit >= 0 ? "text-green-400" : "text-red-400" 
                  },
                  { 
                    label: "MAX PROFIT", 
                    value: stats.maxProfit, 
                    sub: "Strategy cap", 
                    color: "text-success" 
                  },
                  { 
                    label: "MAX LOSS", 
                    value: stats.maxLoss, 
                    sub: "Worst drawdown", 
                    color: "text-destructive" 
                  },
                  { 
                    label: "BREAKEVENS", 
                    value: stats.breakevens.length > 0 ? stats.breakevens.map(b => `₹${b}`).join(" / ") : "None", 
                    sub: "Payoff pivot spots", 
                    color: "text-yellow-400" 
                  },
                ].map((s) => (
                  <Card key={s.label} className="rounded-sm border-muted bg-card">
                    <CardContent className="p-4">
                      <div className="text-[10px] font-mono text-muted-foreground mb-1">{s.label}</div>
                      <div className={cn("text-base font-bold font-mono truncate", s.color)}>{s.value}</div>
                      <div className="text-[10px] font-mono text-muted-foreground mt-0.5">{s.sub}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Payoff Chart */}
              <Card className="rounded-sm border-muted bg-card">
                <CardHeader className="p-4 border-b border-muted">
                  <CardTitle className="text-sm font-mono">OPTIONS STRATEGY PAYOFF AT EXPIRY (₹)</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={stats.chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                      <defs>
                        <linearGradient id="payoffPositiveGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="payoffNegativeGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ef4444" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#222" />
                      <XAxis dataKey="spot" tick={{ fontSize: 9, fontFamily: "monospace", fill: "#888" }} />
                      <YAxis tick={{ fontSize: 9, fontFamily: "monospace", fill: "#888" }} />
                      <Tooltip
                        contentStyle={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: "2px", fontFamily: "monospace", fontSize: 11 }}
                        formatter={(val: number) => [`₹${val.toLocaleString("en-IN")}`, "Payoff"]}
                      />
                      <ReferenceLine y={0} stroke="#444" strokeWidth={1.5} />
                      <ReferenceLine x={underlyingPrice} stroke="#3b82f6" strokeWidth={1.5} strokeDasharray="4 4" label={{ value: "Current Spot", fill: "#3b82f6", fontSize: 9, fontFamily: "monospace", position: "top" }} />
                      
                      {stats.breakevens.map((be) => (
                        <ReferenceLine key={be} x={be} stroke="#eab308" strokeWidth={1} strokeDasharray="2 2" label={{ value: "BE", fill: "#eab308", fontSize: 8, fontFamily: "monospace" }} />
                      ))}

                      <Area type="monotone" dataKey="pnlPositive" stroke="#22c55e" strokeWidth={2} fill="url(#payoffPositiveGrad)" dot={false} />
                      <Area type="monotone" dataKey="pnlNegative" stroke="#ef4444" strokeWidth={2} fill="url(#payoffNegativeGrad)" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

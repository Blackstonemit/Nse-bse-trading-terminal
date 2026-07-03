import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layers, Box, Loader2, ArrowRightLeft, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface MarketDepth {
  price: number;
  quantity: number;
  orders: number;
}

interface BlockTrade {
  id: string;
  timestamp: string;
  price: number;
  quantity: number;
  type: "BUY" | "SELL";
  value: number;
}

export default function OrderFlowPage() {
  const [symbol, setSymbol] = useState("NIFTY");

  const { data: depthRes, isLoading: depthLoading } = useQuery<{ data: { bids: MarketDepth[], asks: MarketDepth[] } }>({
    queryKey: ["/api/orderflow/depth", symbol],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/orderflow/depth/${symbol}`));
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 5000,
  });

  const { data: blocksRes, isLoading: blocksLoading } = useQuery<{ data: BlockTrade[] }>({
    queryKey: ["/api/orderflow/blocks", symbol],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/orderflow/blocks/${symbol}`));
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const bids = depthRes?.data?.bids || [];
  const asks = depthRes?.data?.asks || [];
  const blocks = blocksRes?.data || [];

  // Calculate DOM max quantity for visualizing depth bars
  const maxBidQty = useMemo(() => Math.max(...bids.map(b => b.quantity), 1), [bids]);
  const maxAskQty = useMemo(() => Math.max(...asks.map(a => a.quantity), 1), [asks]);
  const maxQty = Math.max(maxBidQty, maxAskQty);

  const formatNumber = (num: number) => new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(num);

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-2 sm:space-y-0">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Layers className="h-6 w-6 text-primary" />
            Order Flow & Market Depth
          </h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">
            Level 2 DOM and Institutional Block Trades (Synthetic Data)
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input 
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="Symbol (e.g. NIFTY)"
            className="w-40 font-mono"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        
        {/* DOM Panel */}
        <Card className="lg:col-span-3 bg-[#0a0a0a] border-white/5">
          <CardHeader className="border-b border-white/5 py-4">
            <CardTitle className="text-sm font-mono flex items-center gap-2">
              <ArrowRightLeft className="h-4 w-4 text-emerald-400" />
              Depth Of Market (DOM)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0 font-mono text-[10px] sm:text-xs">
            {depthLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col">
                {/* Asks (Sell Orders) */}
                <div className="flex flex-col-reverse">
                  {asks.slice().reverse().map((ask, i) => (
                    <div key={`ask-${i}`} className="relative grid grid-cols-3 py-1 px-4 hover:bg-white/5 items-center group cursor-crosshair">
                      <div className="absolute inset-y-0 right-0 bg-red-500/10" style={{ width: `${(ask.quantity / maxQty) * 100}%` }} />
                      <div className="text-red-400 text-left z-10">{ask.price.toFixed(2)}</div>
                      <div className="text-right text-muted-foreground z-10">{formatNumber(ask.quantity)}</div>
                      <div className="text-right text-muted-foreground/50 z-10">{ask.orders}</div>
                    </div>
                  ))}
                </div>
                
                {/* Spread Divider */}
                <div className="h-px bg-white/10 my-1 mx-4" />

                {/* Bids (Buy Orders) */}
                <div className="flex flex-col">
                  {bids.map((bid, i) => (
                    <div key={`bid-${i}`} className="relative grid grid-cols-3 py-1 px-4 hover:bg-white/5 items-center group cursor-crosshair">
                      <div className="absolute inset-y-0 left-0 bg-emerald-500/10" style={{ width: `${(bid.quantity / maxQty) * 100}%` }} />
                      <div className="text-emerald-400 text-left z-10">{bid.price.toFixed(2)}</div>
                      <div className="text-right text-muted-foreground z-10">{formatNumber(bid.quantity)}</div>
                      <div className="text-right text-muted-foreground/50 z-10">{bid.orders}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Block Trades Panel */}
        <Card className="lg:col-span-4 bg-[#0a0a0a] border-white/5">
          <CardHeader className="border-b border-white/5 py-4">
            <CardTitle className="text-sm font-mono flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Box className="h-4 w-4 text-purple-400" />
                Institutional Block Trades
              </div>
              <Badge variant="outline" className="font-mono text-[10px] bg-purple-500/10 text-purple-400 border-purple-500/20">
                WHALE TRACKER
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {blocksLoading ? (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-6 w-6 animate-spin" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px] sm:text-xs">
                  <thead className="text-muted-foreground bg-muted/20 border-b border-white/5">
                    <tr>
                      <th className="px-4 py-2 font-normal">TIME</th>
                      <th className="px-4 py-2 font-normal">SIDE</th>
                      <th className="px-4 py-2 font-normal text-right">PRICE</th>
                      <th className="px-4 py-2 font-normal text-right">QTY</th>
                      <th className="px-4 py-2 font-normal text-right">VALUE (₹)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blocks.map((trade) => (
                      <tr key={trade.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(trade.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>
                        <td className="px-4 py-2">
                          <span className={`px-2 py-0.5 rounded-sm bg-opacity-10 font-bold ${
                            trade.type === "BUY" ? "text-emerald-400 bg-emerald-400" : "text-red-400 bg-red-400"
                          }`}>
                            {trade.type}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-white">
                          {trade.price.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-right text-muted-foreground">
                          {formatNumber(trade.quantity)}
                        </td>
                        <td className="px-4 py-2 text-right font-medium text-white">
                          {formatNumber(trade.value)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="p-4 border-t border-white/5 bg-yellow-500/5 flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-xs font-medium text-yellow-500/90">Simulated Environment</p>
                <p className="text-[10px] text-yellow-500/70 font-mono">
                  This data is synthetically generated for UI demonstration. In a production environment, this module requires a dedicated Level 2 FIX connection or paid data vendor API.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  );
}

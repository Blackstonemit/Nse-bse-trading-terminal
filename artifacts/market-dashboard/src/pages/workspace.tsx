import React, { Suspense, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { 
  LayoutGrid, Grid2X2, ArrowLeftRight, Move, X, Eye, 
  LineChart, List, TerminalSquare, Wallet, Zap, Settings, RefreshCw 
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const LazyMiniChartWidget = React.lazy(() => import("@/components/mini-chart-widget"));

// ── WIDGET DEFINITIONS ────────────────────────────────────────────────────────
type WidgetType = "chart" | "watchlist" | "signals" | "positions" | "orderbook";

const WIDGET_META: Record<WidgetType, { title: string; icon: any; color: string }> = {
  chart: { title: "Candlestick Chart", icon: LineChart, color: "text-blue-400" },
  watchlist: { title: "Watchlist Tracker", icon: List, color: "text-amber-400" },
  signals: { title: "Signals Feed", icon: TerminalSquare, color: "text-purple-400" },
  positions: { title: "Active Positions", icon: Wallet, color: "text-green-400" },
  orderbook: { title: "L2 Depth Ladder", icon: Zap, color: "text-red-400" },
};

// ── CUSTOM GRID COMPONENT ─────────────────────────────────────────────────────
export default function WorkspacePage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeSymbol, setActiveSymbol] = useState("RELIANCE");
  const [gridPreset, setGridPreset] = useState<"split" | "wide-left" | "tall-right">("split");

  // Widget layout mapping (indices 0 to 3 corresponding to Slot 1-4)
  const [layout, setLayout] = useState<WidgetType[]>([
    "chart",
    "watchlist",
    "signals",
    "positions"
  ]);

  // Drag state
  const [draggedSlot, setDraggedSlot] = useState<number | null>(null);

  // ── Drag & Drop Handlers ────────────────────────────────────────────────────
  const handleDragStart = (e: React.DragEvent, slotIdx: number) => {
    setDraggedSlot(slotIdx);
    e.dataTransfer.setData("text/plain", slotIdx.toString());
  };

  const handleDrop = (e: React.DragEvent, targetSlotIdx: number) => {
    e.preventDefault();
    const sourceSlotIdxStr = e.dataTransfer.getData("text/plain");
    if (!sourceSlotIdxStr && sourceSlotIdxStr !== "0") return;
    const sourceSlotIdx = Number(sourceSlotIdxStr);
    if (isNaN(sourceSlotIdx) || sourceSlotIdx === targetSlotIdx) return;

    const sourceWidget = layout[sourceSlotIdx];
    const targetWidget = layout[targetSlotIdx];

    setLayout((prev) => {
      if (sourceSlotIdx < 0 || sourceSlotIdx >= prev.length || targetSlotIdx < 0 || targetSlotIdx >= prev.length) return prev;
      const next = [...prev];
      const temp = next[sourceSlotIdx];
      next[sourceSlotIdx] = next[targetSlotIdx];
      next[targetSlotIdx] = temp;
      return next;
    });
    setDraggedSlot(null);

    const sourceTitle = WIDGET_META[sourceWidget]?.title || "Widget";
    const targetTitle = WIDGET_META[targetWidget]?.title || "Widget";
    toast({
      title: "Workspace Customised",
      description: `Swapped ${sourceTitle} with ${targetTitle}.`,
    });
  };

  const handleWidgetChange = (slotIdx: number, type: WidgetType) => {
    setLayout((prev) => {
      const next = [...prev];
      next[slotIdx] = type;
      return next;
    });
  };

  // ── Grid Layout styling computed ───────────────────────────────────────────
  const gridClassName = useMemo(() => {
    switch (gridPreset) {
      case "wide-left":
        return "grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[75vh]";
      case "tall-right":
        return "grid grid-cols-1 lg:grid-cols-3 gap-4 min-h-[75vh]";
      case "split":
      default:
        return "grid grid-cols-1 lg:grid-cols-2 gap-4 min-h-[75vh]";
    }
  }, [gridPreset]);

  const getSlotClassName = (idx: number) => {
    if (gridPreset === "wide-left" && idx === 0) {
      return "lg:col-span-2 h-full flex flex-col";
    }
    if (gridPreset === "tall-right" && idx === 1) {
      return "lg:col-span-1 lg:row-span-2 h-full flex flex-col";
    }
    return "h-full flex flex-col";
  };

  return (
    <div className="space-y-4">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border border-muted bg-card p-3 rounded-sm font-mono">
        <div className="flex items-center gap-2.5">
          <div className="bg-primary/10 p-2 rounded-sm border border-primary/20 text-primary">
            <LayoutGrid className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-foreground">PRO WORKSPACE GRID</h1>
            <p className="text-[10px] text-muted-foreground">Drag widget headers to swap positions. Click widgets to select assets.</p>
          </div>
        </div>

        {/* Console control bar */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5 border border-muted bg-background rounded-sm px-2 py-1">
            <span className="text-[9px] text-muted-foreground mr-1">ACTIVE TICKET:</span>
            <input
              type="text"
              value={activeSymbol}
              onChange={(e) => setActiveSymbol(e.target.value.toUpperCase())}
              className="bg-transparent border-none outline-none font-bold text-xs uppercase w-20 text-primary"
            />
          </div>

          <div className="flex items-center gap-1 border border-muted bg-background rounded-sm p-0.5">
            <button
              onClick={() => setGridPreset("split")}
              className={cn("px-2.5 py-1 text-[10px] rounded-sm transition-colors", gridPreset === "split" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted/30")}
            >
              2x2 SPLIT
            </button>
            <button
              onClick={() => setGridPreset("wide-left")}
              className={cn("px-2.5 py-1 text-[10px] rounded-sm transition-colors", gridPreset === "wide-left" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted/30")}
            >
              WIDE LEFT
            </button>
            <button
              onClick={() => setGridPreset("tall-right")}
              className={cn("px-2.5 py-1 text-[10px] rounded-sm transition-colors", gridPreset === "tall-right" ? "bg-primary text-primary-foreground font-bold" : "text-muted-foreground hover:bg-muted/30")}
            >
              TALL RIGHT
            </button>
          </div>
        </div>
      </div>

      {/* Main Drag-Drop Workspace Grid */}
      <div className={gridClassName}>
        {layout.map((widgetType, idx) => (
          <div
            key={idx}
            className={getSlotClassName(idx)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleDrop(e, idx)}
          >
            <WorkspaceWidgetCard
              type={widgetType}
              slotIdx={idx}
              symbol={activeSymbol}
              onDragStart={(e) => handleDragStart(e, idx)}
              onChangeWidget={(type) => handleWidgetChange(idx, type)}
              onSetSymbol={setActiveSymbol}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WORKSPACE WIDGET CARD WRAPPER ─────────────────────────────────────────────
interface WidgetCardProps {
  type: WidgetType;
  slotIdx: number;
  symbol: string;
  onDragStart: (e: React.DragEvent) => void;
  onChangeWidget: (type: WidgetType) => void;
  onSetSymbol: (symbol: string) => void;
}

function WorkspaceWidgetCard({ type, slotIdx, symbol, onDragStart, onChangeWidget, onSetSymbol }: WidgetCardProps) {
  const Meta = WIDGET_META[type] || { title: "Widget", icon: LineChart, color: "text-primary" };
  const Icon = Meta.icon;

  return (
    <Card className="rounded-sm border-muted bg-card flex-1 flex flex-col overflow-hidden">
      <CardHeader 
        draggable
        onDragStart={onDragStart}
        className="p-3 border-b border-muted bg-muted/10 cursor-grab active:cursor-grabbing flex flex-row items-center justify-between select-none shrink-0"
      >
        <CardTitle className="text-xs font-mono flex items-center gap-1.5 uppercase font-bold text-foreground">
          <Move className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Icon className={cn("h-4 w-4", Meta.color)} />
          <span>{Meta.title} ({symbol})</span>
        </CardTitle>

        {/* Change Widget dropdown selection */}
        <select
          value={type}
          onChange={(e) => onChangeWidget(e.target.value as WidgetType)}
          className="bg-background border border-muted font-mono text-[9px] px-1.5 py-0.5 rounded-sm outline-none cursor-pointer text-muted-foreground focus:text-foreground"
        >
          <option value="chart">Chart</option>
          <option value="watchlist">Watchlist</option>
          <option value="signals">Signals</option>
          <option value="positions">Positions</option>
          <option value="orderbook">Depth Book</option>
        </select>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-auto bg-background">
        <WorkspaceWidgetContent type={type} symbol={symbol} onSetSymbol={onSetSymbol} />
      </CardContent>
    </Card>
  );
}

// ── WORKSPACE WIDGET CONTENT ROUTER ───────────────────────────────────────────
function WorkspaceWidgetContent({ type, symbol, onSetSymbol }: { type: WidgetType; symbol: string; onSetSymbol: (sym: string) => void }) {
  switch (type) {
    case "chart":
      return (
        <Suspense fallback={
          <div className="h-[300px] flex items-center justify-center font-mono text-[10px] text-muted-foreground animate-pulse">
            LOADING CHART COMPONENT...
          </div>
        }>
          <LazyMiniChartWidget symbol={symbol} />
        </Suspense>
      );
    case "watchlist":
      return <MiniWatchlistWidget onSetSymbol={onSetSymbol} />;
    case "signals":
      return <MiniSignalsWidget onSetSymbol={onSetSymbol} />;
    case "positions":
      return <MiniPositionsWidget symbol={symbol} />;
    case "orderbook":
      return <MiniOrderBookWidget symbol={symbol} />;
    default:
      return null;
  }
}



// ── WIDGET 2: MINI WATCHLIST WIDGET ───────────────────────────────────────────
function MiniWatchlistWidget({ onSetSymbol }: { onSetSymbol: (sym: string) => void }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: list, refetch } = useQuery<any[]>({
    queryKey: ["workspace-watchlist"],
    queryFn: async () => {
      const res = await fetch(`${base}/api/watchlist`);
      return res.json();
    }
  });

  return (
    <div className="overflow-x-auto font-mono text-[10px]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-muted bg-muted/10 text-muted-foreground">
            <th className="py-2 px-3">SYMBOL</th>
            <th className="py-2 px-3">NAME</th>
            <th className="py-2 px-3">EXCH</th>
          </tr>
        </thead>
        <tbody>
          {!list || list.length === 0 ? (
            <tr>
              <td colSpan={3} className="py-8 text-center text-muted-foreground">Watchlist is empty.</td>
            </tr>
          ) : (
            list.map((item) => (
              <tr 
                key={item.id} 
                onClick={() => onSetSymbol(item.symbol)}
                className="border-b border-muted/30 hover:bg-muted/20 cursor-pointer"
              >
                <td className="py-2 px-3 font-bold text-primary">{item.symbol}</td>
                <td className="py-2 px-3 text-muted-foreground truncate max-w-[120px]">{item.name}</td>
                <td className="py-2 px-3"><Badge className="bg-primary/10 text-primary text-[8px] border-none">{item.exchange}</Badge></td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── WIDGET 3: MINI SIGNALS WIDGET ─────────────────────────────────────────────
function MiniSignalsWidget({ onSetSymbol }: { onSetSymbol: (sym: string) => void }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: signals } = useQuery<any[]>({
    queryKey: ["workspace-signals"],
    queryFn: async () => {
      const res = await fetch(`${base}/api/signals`);
      return res.json();
    }
  });

  return (
    <div className="overflow-y-auto max-h-[300px] font-mono text-[10px] divide-y divide-muted/30">
      {!signals || signals.length === 0 ? (
        <div className="py-8 text-center text-muted-foreground">No active recommendations.</div>
      ) : (
        signals.slice(0, 15).map((sig) => (
          <div 
            key={sig.id} 
            onClick={() => onSetSymbol(sig.symbol)}
            className="p-2 hover:bg-muted/10 cursor-pointer flex justify-between items-start gap-1"
          >
            <div>
              <div className="font-bold flex items-center gap-1.5">
                <span className="text-foreground">{sig.symbol}</span>
                <Badge className={cn("text-[8px] px-1 py-0 border-none", sig.action === "BUY" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                  {sig.action}
                </Badge>
              </div>
              <div className="text-[9px] text-muted-foreground leading-normal mt-0.5">{sig.displayText}</div>
            </div>
            <div className="text-right">
              <span className="font-bold text-primary">₹{sig.entryPrice}</span>
              <span className="block text-[8px] text-muted-foreground">Conf: {sig.confidence}%</span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ── WIDGET 4: MINI POSITIONS WIDGET ───────────────────────────────────────────
function MiniPositionsWidget({ symbol }: { symbol: string }) {
  const base = import.meta.env.BASE_URL.replace(/\/$/, "");
  const { data: positions } = useQuery<any[]>({
    queryKey: ["workspace-positions"],
    queryFn: async () => {
      const res = await fetch(`${base}/api/paper/trades?status=OPEN`);
      return res.json();
    },
    refetchInterval: 5000,
  });

  return (
    <div className="overflow-x-auto font-mono text-[10px]">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="border-b border-muted bg-muted/10 text-muted-foreground">
            <th className="py-2 px-3">TICKET</th>
            <th className="py-2 px-3 text-right">PRICE</th>
            <th className="py-2 px-3 text-right">QTY</th>
            <th className="py-2 px-3 text-right">LIMITS</th>
          </tr>
        </thead>
        <tbody>
          {!positions || positions.length === 0 ? (
            <tr>
              <td colSpan={4} className="py-8 text-center text-muted-foreground">No open paper positions.</td>
            </tr>
          ) : (
            positions.map((pos) => (
              <tr key={pos.id} className="border-b border-muted/30 hover:bg-muted/20">
                <td className="py-2 px-3">
                  <div className="font-bold text-foreground">{pos.symbol}</div>
                  <Badge className={cn("text-[8px] px-1 border-none leading-none", pos.action === "BUY" ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400")}>
                    {pos.action}
                  </Badge>
                </td>
                <td className="py-2 px-3 text-right font-bold">₹{pos.price.toFixed(2)}</td>
                <td className="py-2 px-3 text-right">{pos.quantity}</td>
                <td className="py-2 px-3 text-right text-[8px] leading-tight space-y-0.5">
                  {pos.takeProfit && <div className="text-green-400">TP: {pos.takeProfit}</div>}
                  {pos.stopLoss && <div className="text-red-400">SL: {pos.stopLoss}</div>}
                  {pos.trailingStop && <div className="text-orange-400">TSL: {pos.trailingStop}</div>}
                  {!pos.takeProfit && !pos.stopLoss && !pos.trailingStop && <span className="text-muted-foreground">—</span>}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── WIDGET 5: MINI LEVEL-2 ORDER BOOK WIDGET ──────────────────────────────────
function MiniOrderBookWidget({ symbol }: { symbol: string }) {
  const [bids, setBids] = useState<any[]>([]);
  const [asks, setAsks] = useState<any[]>([]);
  const [lastPrice, setLastPrice] = useState(1500);

  useEffect(() => {
    // Generate initial pricing
    const basePrices: Record<string, number> = {
      RELIANCE: 2450,
      TCS: 3200,
      INFY: 1450,
      NIFTY: 18500,
      BANKNIFTY: 42000,
      SBIN: 580,
    };
    const startPrice = basePrices[symbol] || 1200;
    setLastPrice(startPrice);

    const generateTicks = () => {
      const current = startPrice + (Math.random() - 0.5) * startPrice * 0.005;
      setLastPrice(current);
      const tickSpacing = current * 0.0002;

      const newBids = [];
      const newAsks = [];
      for (let i = 1; i <= 5; i++) {
        newBids.push({
          price: Number((current - i * tickSpacing).toFixed(2)),
          size: Math.floor(Math.random() * 800) + 50
        });
        newAsks.push({
          price: Number((current + i * tickSpacing).toFixed(2)),
          size: Math.floor(Math.random() * 800) + 50
        });
      }
      setBids(newBids.sort((a, b) => b.price - a.price));
      setAsks(newAsks.sort((a, b) => a.price - b.price));
    };

    generateTicks();
    const interval = setInterval(generateTicks, 600);
    return () => clearInterval(interval);
  }, [symbol]);

  return (
    <div className="font-mono text-[10px] select-none p-1.5 flex flex-col h-full justify-between">
      {/* Asks (Red) */}
      <div className="flex flex-col">
        {asks.slice().reverse().map((ask, idx) => (
          <div key={idx} className="flex justify-between items-center py-0.5 hover:bg-muted/10 px-1.5">
            <span className="text-red-400 font-bold">₹{ask.price.toFixed(2)}</span>
            <span className="text-muted-foreground">{ask.size}</span>
          </div>
        ))}
      </div>

      {/* Mid Spread */}
      <div className="border-y border-muted/50 my-1 py-1 text-center bg-muted/5 font-bold flex justify-between px-1.5">
        <span className="text-muted-foreground">MID PRICE</span>
        <span className="text-primary">₹{lastPrice.toFixed(2)}</span>
      </div>

      {/* Bids (Green) */}
      <div className="flex flex-col">
        {bids.map((bid, idx) => (
          <div key={idx} className="flex justify-between items-center py-0.5 hover:bg-muted/10 px-1.5">
            <span className="text-green-400 font-bold">₹{bid.price.toFixed(2)}</span>
            <span className="text-muted-foreground">{bid.size}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

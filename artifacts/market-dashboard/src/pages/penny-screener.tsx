import { useState, useMemo } from "react";
import { useGetScreenerPenny } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Coins, 
  Rocket, 
  Gem, 
  Zap, 
  SlidersHorizontal, 
  Search, 
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PennyScreenerPage() {
  const { data: stocks, isLoading, refetch, isRefetching } = useGetScreenerPenny({
    query: {
      refetchInterval: 7200000, // 2 hours auto-refresh
      staleTime: 7200000
    } as any
  });

  const [activeTab, setActiveTab] = useState<string>("micro");
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Filter Sliders State
  const [maxMarketCap, setMaxMarketCap] = useState<number>(250);
  const [maxStockPrice, setMaxStockPrice] = useState<number>(50);
  const [minSalesGrowth, setMinSalesGrowth] = useState<number>(20);
  const [maxDebtToEquity, setMaxDebtToEquity] = useState<number>(0.3);

  // Filtered stocks based on search and tab logic
  const filteredStocks = useMemo(() => {
    if (!stocks) return [];
    const q = searchQuery.trim().toLowerCase();
    
    let list = stocks;
    if (q) {
      list = list.filter((s) => 
        s.symbol.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.sector.toLowerCase().includes(q) ||
        s.tags.some(t => t.toLowerCase().includes(q))
      );
    } else {
      if (activeTab === "micro") {
        list = list.filter((s) => s.marketCapCr <= 150 || s.tags.includes("MICRO_CAP_TURNAROUND"));
      } else if (activeTab === "sub50") {
        list = list.filter((s) => s.currentPrice <= 50 || s.tags.includes("SUB_50_GROWTH"));
      } else if (activeTab === "debtfree") {
        list = list.filter((s) => s.debtToEquity <= 0.20 || s.tags.includes("DEBT_FREE"));
      } else if (activeTab === "custom") {
        list = list.filter((s) => 
          s.marketCapCr <= maxMarketCap &&
          s.currentPrice <= maxStockPrice &&
          s.salesCagr3Yr >= minSalesGrowth &&
          s.debtToEquity <= maxDebtToEquity
        );
      }
    }

    return list.sort((a, b) => b.turnaroundScore - a.turnaroundScore);
  }, [stocks, searchQuery, activeTab, maxMarketCap, maxStockPrice, minSalesGrowth, maxDebtToEquity]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground flex items-center gap-2">
              <Coins className="h-6 w-6 text-yellow-400" />
              PENNY STOCK SCREENER
            </h1>
            <Badge variant="outline" className="font-mono text-xs bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
              ₹100 CR CAP & SUB-₹100 GEMS
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin text-green-400" />
              AUTO-REFRESH: 2 HOURS
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Filter high-growth micro-cap turnaround stocks under ₹100 Cr market cap with prices under ₹100.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search symbol or sector..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 font-mono text-xs bg-card border-muted h-9"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={() => refetch()} 
            disabled={isRefetching}
            className="font-mono text-xs border-muted h-9"
          >
            <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", isRefetching && "animate-spin")} />
            REFRESH
          </Button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 bg-muted/20 p-1 font-mono text-xs h-auto gap-1 border border-muted/40 rounded-sm">
          <TabsTrigger value="micro" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black py-2 flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            <span>MICRO-CAP TURNAROUND</span>
          </TabsTrigger>
          <TabsTrigger value="sub50" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black py-2 flex items-center gap-1.5">
            <Gem className="h-3.5 w-3.5" />
            <span>GROWTH UNDER ₹50</span>
          </TabsTrigger>
          <TabsTrigger value="debtfree" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black py-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>DEBT-FREE PENNY</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="data-[state=active]:bg-yellow-500 data-[state=active]:text-black py-2 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>CUSTOM SLIDERS</span>
          </TabsTrigger>
        </TabsList>

        {/* Custom Sliders Panel */}
        {activeTab === "custom" && (
          <Card className="mt-4 rounded-sm border-muted bg-card">
            <CardHeader className="py-3 px-4 border-b border-muted/40">
              <CardTitle className="text-xs font-mono font-bold tracking-wider flex items-center gap-2 text-yellow-400">
                <SlidersHorizontal className="h-4 w-4" />
                MICRO-CAP PARAMETER SLIDERS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Market Cap (Cr):</span>
                  <span className="font-bold text-foreground">₹{maxMarketCap} Cr</span>
                </div>
                <Slider value={[maxMarketCap]} min={50} max={500} step={25} onValueChange={(v) => setMaxMarketCap(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Stock Price:</span>
                  <span className="font-bold text-foreground">₹{maxStockPrice}</span>
                </div>
                <Slider value={[maxStockPrice]} min={10} max={100} step={5} onValueChange={(v) => setMaxStockPrice(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Sales Growth (%):</span>
                  <span className="font-bold text-foreground">+{minSalesGrowth}%</span>
                </div>
                <Slider value={[minSalesGrowth]} min={10} max={50} step={5} onValueChange={(v) => setMinSalesGrowth(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Debt/Equity:</span>
                  <span className="font-bold text-foreground">{maxDebtToEquity}</span>
                </div>
                <Slider value={[maxDebtToEquity]} min={0} max={1.0} step={0.05} onValueChange={(v) => setMaxDebtToEquity(v[0])} />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Screener Data Table View */}
        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-sm" />
              ))}
            </div>
          ) : (
            <div className="border border-muted/40 rounded-sm overflow-hidden bg-card">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-xs">
                  <thead className="bg-muted/30 text-muted-foreground border-b border-muted/40 uppercase tracking-wider text-[11px]">
                    <tr>
                      <th className="p-3">Company / Symbol</th>
                      <th className="p-3 text-right">Price (₹)</th>
                      <th className="p-3 text-right">M.Cap (Cr)</th>
                      <th className="p-3 text-right">P/E</th>
                      <th className="p-3 text-right">ROE %</th>
                      <th className="p-3 text-right">Debt/Eq</th>
                      <th className="p-3 text-right">Sales CAGR</th>
                      <th className="p-3 text-right">Profit CAGR</th>
                      <th className="p-3 text-center">Turnaround Score</th>
                      <th className="p-3">Highlights</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-muted/30">
                    {filteredStocks.map((s) => (
                      <tr key={s.symbol} className="hover:bg-muted/10 transition-colors">
                        <td className="p-3">
                          <div className="font-bold text-foreground flex items-center gap-1.5">
                            {s.symbol}
                            <Badge variant="outline" className="text-[9px] px-1 py-0 border-muted/60 text-muted-foreground">
                              {s.sector}
                            </Badge>
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[200px]">{s.name}</div>
                        </td>
                        <td className="p-3 text-right font-bold text-yellow-400">
                          ₹{s.currentPrice.toFixed(2)}
                        </td>
                        <td className="p-3 text-right text-foreground font-semibold">
                          ₹{s.marketCapCr} Cr
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">
                          {s.peRatio}x
                        </td>
                        <td className="p-3 text-right font-bold text-green-400">
                          {s.roePercent}%
                        </td>
                        <td className={cn("p-3 text-right font-semibold", s.debtToEquity <= 0.2 ? "text-green-400" : "text-foreground")}>
                          {s.debtToEquity}
                        </td>
                        <td className="p-3 text-right text-foreground font-semibold">
                          +{s.salesCagr3Yr}%
                        </td>
                        <td className="p-3 text-right text-green-400 font-bold">
                          +{s.profitCagr3Yr}%
                        </td>
                        <td className="p-3 text-center">
                          <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-mono text-xs px-2 py-0.5">
                            {s.turnaroundScore} / 100
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap gap-1">
                            {s.tags.map((tag) => (
                              <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded-sm border border-muted/50 text-muted-foreground bg-muted/20">
                                {tag.replace(/_/g, " ")}
                              </span>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                    {filteredStocks.length === 0 && (
                      <tr>
                        <td colSpan={10} className="p-8 text-center text-muted-foreground">
                          No micro-cap stocks matched the current filter criteria. Try adjusting the parameter sliders or search query.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </Tabs>
    </div>
  );
}

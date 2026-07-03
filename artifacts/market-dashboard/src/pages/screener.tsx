import { useState, useMemo } from "react";
import { useGetScreenerMultibagger } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Rocket, 
  Gem, 
  Zap, 
  SlidersHorizontal, 
  Search, 
  RefreshCw
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function MultibaggerScreenerPage() {
  const { data: stocks, isLoading, refetch, isRefetching } = useGetScreenerMultibagger({
    query: {
      refetchInterval: 7200000, // 2 hours auto-refresh
      staleTime: 7200000,
    } as any
  });

  const [activeTab, setActiveTab] = useState<string>("core");
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Filter Sliders State
  const [minMarketCap, setMinMarketCap] = useState<number>(30000);
  const [maxPe, setMaxPe] = useState<number>(80);
  const [minRoe, setMinRoe] = useState<number>(20);
  const [maxDebtToEquity, setMaxDebtToEquity] = useState<number>(0.5);

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
      if (activeTab === "core") {
        list = list.filter((s) => s.tags.includes("CORE_MULTIBAGGER") || s.multibaggerScore >= 88);
      } else if (activeTab === "value") {
        list = list.filter((s) => s.tags.includes("VALUATION_PLAY") || s.peRatio <= 50 || s.priceToBook <= 12);
      } else if (activeTab === "momentum") {
        list = list.filter((s) => s.tags.includes("MOMENTUM_BREAKOUT") || s.relativeStrengthIndex >= 65 || s.volumeSpikeRatio >= 2.0);
      } else if (activeTab === "custom") {
        list = list.filter((s) => 
          s.marketCapCr >= minMarketCap &&
          s.peRatio <= maxPe &&
          s.roePercent >= minRoe &&
          s.debtToEquity <= maxDebtToEquity
        );
      }
    }

    return list.sort((a, b) => b.multibaggerScore - a.multibaggerScore);
  }, [stocks, searchQuery, activeTab, minMarketCap, maxPe, minRoe, maxDebtToEquity]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight font-mono text-foreground">MULTIBAGGER SCREENER</h1>
            <Badge variant="outline" className="font-mono text-xs bg-primary/10 text-primary border-primary/30">
              NSE / BSE INDIA
            </Badge>
            <Badge variant="outline" className="font-mono text-[10px] bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin text-green-400" />
              AUTO-REFRESH: 2 HOURS
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Discover high-compounding growth stocks with high ROE, low debt, and breakout technical momentum.
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
          <TabsTrigger value="core" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 flex items-center gap-1.5">
            <Rocket className="h-3.5 w-3.5" />
            <span>MULTIBAGGER CORE</span>
          </TabsTrigger>
          <TabsTrigger value="value" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 flex items-center gap-1.5">
            <Gem className="h-3.5 w-3.5" />
            <span>VALUATION & VALUE</span>
          </TabsTrigger>
          <TabsTrigger value="momentum" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5" />
            <span>TECHNICAL MOMENTUM</span>
          </TabsTrigger>
          <TabsTrigger value="custom" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground py-2 flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            <span>CUSTOM SLIDERS</span>
          </TabsTrigger>
        </TabsList>

        {/* Custom Sliders Panel */}
        {activeTab === "custom" && (
          <Card className="mt-4 rounded-sm border-muted bg-card">
            <CardHeader className="py-3 px-4 border-b border-muted/40">
              <CardTitle className="text-xs font-mono font-bold tracking-wider flex items-center gap-2 text-primary">
                <SlidersHorizontal className="h-4 w-4" />
                INTERACTIVE PARAMETER SLIDERS
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-4 gap-6 font-mono text-xs">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min Market Cap (Cr):</span>
                  <span className="font-bold text-foreground">₹{minMarketCap.toLocaleString()} Cr</span>
                </div>
                <Slider value={[minMarketCap]} min={10000} max={200000} step={5000} onValueChange={(v) => setMinMarketCap(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max P/E Ratio:</span>
                  <span className="font-bold text-foreground">{maxPe}x</span>
                </div>
                <Slider value={[maxPe]} min={10} max={100} step={5} onValueChange={(v) => setMaxPe(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Min ROE (%):</span>
                  <span className="font-bold text-foreground">{minRoe}%</span>
                </div>
                <Slider value={[minRoe]} min={10} max={40} step={2} onValueChange={(v) => setMinRoe(v[0])} />
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Max Debt/Equity:</span>
                  <span className="font-bold text-foreground">{maxDebtToEquity}</span>
                </div>
                <Slider value={[maxDebtToEquity]} min={0} max={1.5} step={0.05} onValueChange={(v) => setMaxDebtToEquity(v[0])} />
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
                      <th className="p-3 text-right">RSI</th>
                      <th className="p-3 text-center">Score</th>
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
                        <td className="p-3 text-right font-bold text-foreground">
                          ₹{s.currentPrice.toLocaleString()}
                        </td>
                        <td className="p-3 text-right text-muted-foreground">
                          ₹{s.marketCapCr.toLocaleString()} Cr
                        </td>
                        <td className="p-3 text-right font-semibold text-foreground">
                          {s.peRatio}x
                        </td>
                        <td className="p-3 text-right font-bold text-green-400">
                          {s.roePercent}%
                        </td>
                        <td className={cn("p-3 text-right font-semibold", s.debtToEquity <= 0.1 ? "text-green-400" : "text-foreground")}>
                          {s.debtToEquity}
                        </td>
                        <td className="p-3 text-right text-foreground font-semibold">
                          +{s.salesCagr3Yr}%
                        </td>
                        <td className={cn("p-3 text-right font-bold", s.relativeStrengthIndex >= 65 ? "text-yellow-400" : "text-foreground")}>
                          {s.relativeStrengthIndex}
                        </td>
                        <td className="p-3 text-center">
                          <Badge className="bg-primary/20 text-primary border-primary/40 font-mono text-xs px-2 py-0.5">
                            {s.multibaggerScore} / 100
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
                          No stocks matched the current filter criteria. Try adjusting the parameters or search query.
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

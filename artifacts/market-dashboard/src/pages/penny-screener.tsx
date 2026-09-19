import { useState, useMemo } from "react";
import { useGetScreenerPenny } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useSettings } from "@/lib/settings";
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
  RefreshCw,
  Brain,
  ChevronDown,
  ChevronUp,
  AlertCircle
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiUrl } from "@/lib/api";

interface InsightData {
  provider: string;
  timestamp: string;
  content: string;
}

export function SubagentInsightCard({ type }: { type: "multibagger" | "penny" }) {
  const [isOpen, setIsOpen] = useState(true);

  const { data: insight, isLoading } = useQuery<InsightData | null>({
    queryKey: ["screener-insight", type],
    queryFn: async () => {
      const res = await fetch(apiUrl(`/api/screener/${type}/insight`));
      if (!res.ok) throw new Error("Failed to load subagent insights");
      return res.json();
    },
    refetchInterval: 300000, // Auto-refresh insights every 5 minutes
    staleTime: 300000,
  });

  if (isLoading) {
    return (
      <Card className="rounded-sm border-muted glass p-4 shimmer h-24">
      </Card>
    );
  }

  const title = type === "multibagger" ? "MULTIBAGGER RESEARCH REPORT" : "TURNAROUND PENNY STOCK SEARCH REPORT";
  const badgeColor = type === "multibagger" ? "bg-primary/10 text-primary border-primary/30" : "bg-yellow-500/10 text-yellow-400 border-yellow-500/30";

  return (
    <Card className="rounded-sm border-muted glass border-glow-primary hover-glow overflow-hidden transition-all duration-200">
      <CardHeader className="py-2 px-4 bg-muted/20 border-b border-muted/40 flex flex-row items-center justify-between space-y-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Brain className="h-4 w-4 text-primary animate-pulse" />
          <CardTitle className="text-xs font-mono font-bold tracking-wider uppercase text-foreground pl-4 live-pulse">
            AUTONOMOUS SUBAGENT RESEARCH TERMINAL: {title}
          </CardTitle>
          {insight && (
            <Badge variant="outline" className={cn("font-mono text-[9px] uppercase", badgeColor)}>
              MODEL: {insight.provider}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {insight && (
            <span className="text-[10px] text-muted-foreground font-mono hidden sm:inline">
              LAST SWEEP: {new Date(insight.timestamp).toLocaleString()}
            </span>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsOpen(!isOpen)}
            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
          >
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="p-4 bg-muted/5 font-mono text-xs text-muted-foreground leading-relaxed max-h-96 overflow-y-auto space-y-3">
          {insight ? (
            <div className="whitespace-pre-wrap font-sans text-sm text-foreground/90 leading-relaxed bg-[#0c0c14]/40 p-4 border border-muted/40 rounded-sm">
              {insight.content}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-500 p-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>No subagent report found. Running background cycles will generate analysis insights here.</span>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function PennyScreenerPage() {
  const { settings } = useSettings();
  const [screenerQuery, setScreenerQuery] = useState<string>("");
  const [activeFormula, setActiveFormula] = useState<string>("");

  const { data: stocks, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["screener-penny-custom", activeFormula, settings.screenerUsername],
    queryFn: async () => {
      const url = activeFormula
        ? apiUrl(`/api/screener/penny?query=${encodeURIComponent(activeFormula)}`)
        : apiUrl("/api/screener/penny");
      const res = await fetch(url, {
        headers: {
          "x-screener-username": settings.screenerUsername || "",
          "x-screener-password": settings.screenerPassword || "",
        },
      });
      if (!res.ok) throw new Error("Failed to fetch penny screener data");
      return res.json();
    },
    refetchInterval: 7200000, // 2 hours auto-refresh
    staleTime: 7200000,
  });

  const [activeTab, setActiveTab] = useState<string>("micro");
  const [searchQuery, setSearchQuery] = useState("");

  // Custom Filter Sliders State
  const [maxMarketCap, setMaxMarketCap] = useState<number>(250);
  const [maxStockPrice, setMaxStockPrice] = useState<number>(50);
  const [minSalesGrowth, setMinSalesGrowth] = useState<number>(20);
  const [maxDebtToEquity, setMaxDebtToEquity] = useState<number>(0.3);

  const presets = [
    { label: "Sub-₹100 Turnaround GEMS", query: "Market Capitalization < 150 AND Current price < 100 AND Debt to equity < 0.3 AND Sales growth 3years > 10 AND Net Profit > 0" },
    { label: "Debt Free Micro-Caps", query: "Market Capitalization < 200 AND Debt to equity == 0 AND Current price < 50 AND Sales growth 3years > 15" },
    { label: "High Growth Turnaround", query: "Market Capitalization < 300 AND Profit growth 3years > 30 AND Sales growth 3years > 20 AND Debt to equity < 0.4" },
    { label: "Sub-₹30 Penny Breakouts", query: "Market Capitalization < 100 AND Current price < 30 AND Debt to equity < 0.2 AND Net Profit > 0" },
  ];

  const handleRunFormula = (formulaToRun?: string) => {
    const q = formulaToRun !== undefined ? formulaToRun : screenerQuery;
    setActiveFormula(q.trim());
    if (formulaToRun !== undefined) {
      setScreenerQuery(formulaToRun);
    }
  };

  // Filtered stocks based on search and tab logic
  const filteredStocks = useMemo(() => {
    if (!stocks || !Array.isArray(stocks)) return [];
    const q = searchQuery.trim().toLowerCase();
    
    let list = stocks;
    if (q) {
      list = list.filter((s: any) => 
        s.symbol?.toLowerCase().includes(q) ||
        s.name?.toLowerCase().includes(q) ||
        s.sector?.toLowerCase().includes(q) ||
        (s.tags && s.tags.some((t: string) => t.toLowerCase().includes(q)))
      );
    } else {
      if (activeTab === "micro") {
        list = list.filter((s: any) => s.marketCapCr <= 150 || (s.tags && s.tags.includes("MICRO_CAP_TURNAROUND")));
      } else if (activeTab === "sub50") {
        list = list.filter((s: any) => s.currentPrice <= 50 || (s.tags && s.tags.includes("SUB_50_GROWTH")));
      } else if (activeTab === "debtfree") {
        list = list.filter((s: any) => s.debtToEquity <= 0.20 || (s.tags && s.tags.includes("DEBT_FREE")));
      } else if (activeTab === "custom") {
        list = list.filter((s: any) => 
          s.marketCapCr <= maxMarketCap &&
          s.currentPrice <= maxStockPrice &&
          s.salesCagr3Yr >= minSalesGrowth &&
          s.debtToEquity <= maxDebtToEquity
        );
      }
    }

    return list.sort((a: any, b: any) => b.turnaroundScore - a.turnaroundScore);
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
            {activeFormula && (
              <Badge variant="outline" className="font-mono text-[10px] bg-yellow-500/10 text-yellow-400 border-yellow-500/30">
                CUSTOM FORMULA ACTIVE
              </Badge>
            )}
            <Badge variant="outline" className="font-mono text-[10px] bg-green-500/10 text-green-400 border-green-500/30 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5 animate-spin text-green-400" />
              AUTO-REFRESH: 2 HOURS
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground font-mono mt-1">
            Discover micro-cap turnaround stories and undervalued high-growth sub-₹100 stocks.
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

      {/* Screener.in Custom Query Formula Bar */}
      <Card className="rounded-sm border-muted glass border-glow-primary p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-yellow-400" />
            <span className="text-xs font-mono font-bold tracking-wider uppercase text-foreground">
              SCREENER.IN PENNY STOCK FORMULA BAR
            </span>
          </div>
          {activeFormula && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRunFormula("")}
              className="h-6 text-[10px] font-mono text-muted-foreground hover:text-foreground"
            >
              RESET TO DEFAULT QUERY
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Enter Screener.in Query e.g. Market Capitalization < 150 AND Current price < 100 AND Debt to equity < 0.3"
            value={screenerQuery}
            onChange={(e) => setScreenerQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRunFormula()}
            className="font-mono text-xs bg-card border-muted h-9 flex-1"
          />
          <Button
            onClick={() => handleRunFormula()}
            disabled={isRefetching}
            className="font-mono text-xs h-9 bg-yellow-500 text-black hover:bg-yellow-400 font-bold"
          >
            RUN FORMULA
          </Button>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-mono text-muted-foreground uppercase">Penny Presets:</span>
          {presets.map((p, idx) => (
            <Badge
              key={idx}
              variant="outline"
              onClick={() => handleRunFormula(p.query)}
              className={cn(
                "font-mono text-[10px] cursor-pointer hover:bg-yellow-500/20 hover:text-yellow-400 transition-colors",
                activeFormula === p.query && "bg-yellow-500/20 text-yellow-400 border-yellow-500/50"
              )}
            >
              {p.label}
            </Badge>
          ))}
        </div>
      </Card>

      <SubagentInsightCard type="penny" />

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
          <Card className="mt-4 rounded-sm border-muted glass hover-glow transition-all duration-200">
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
            <div className="border border-muted/40 rounded-sm overflow-hidden glass hover-glow transition-all duration-200">
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
                            {s.tags?.map((tag: string) => (
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

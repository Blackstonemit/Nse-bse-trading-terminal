import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { 
  Building2, 
  Search, 
  TrendingUp, 
  DollarSign, 
  BarChart4, 
  AlertCircle,
  Briefcase,
  BrainCircuit,
  Loader2,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Activity,
  Newspaper,
  CalendarDays,
  ExternalLink,
  ChevronDown
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, LineChart, Line } from "recharts";

function formatNumber(num: number | null | undefined): string {
  if (num == null) return "N/A";
  if (num >= 1e12) return (num / 1e12).toFixed(2) + "T";
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

function formatRatio(num: number | null | undefined): string {
  if (num == null) return "N/A";
  return num.toFixed(2);
}

function formatPercent(num: number | null | undefined): string {
  if (num == null) return "N/A";
  return (num * 100).toFixed(2) + "%";
}

// Transform earnings history for Recharts
function transformEarnings(earningsData: any) {
  if (!earningsData?.earningsChart?.quarterly) return [];
  return earningsData.earningsChart.quarterly.map((q: any) => ({
    date: q.date,
    actual: q.actual,
    estimate: q.estimate
  }));
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function SymbolSearch({ onSelect }: { onSelect: (symbol: string) => void }) {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useState<HTMLDivElement | null>(null);

  const { data: results, isLoading } = useQuery({
    queryKey: ["symbol-search", debouncedQuery],
    queryFn: async () => {
      const res = await fetch(`/api/fundamentals/search?q=${encodeURIComponent(debouncedQuery)}`);
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: debouncedQuery.length > 1
  });

  return (
    <div className="relative w-full md:w-80 font-mono">
      <div className="relative flex items-center">
        <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
        <Input 
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onBlur={() => setTimeout(() => setIsOpen(false), 200)}
          placeholder="Search company or symbol..."
          className="w-full pl-9 pr-4 bg-sidebar border-sidebar-border/50 uppercase"
        />
      </div>
      {isOpen && query.length > 1 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-sidebar border border-sidebar-border/50 shadow-xl rounded-md max-h-64 overflow-y-auto">
          {isLoading && <div className="p-3 text-sm text-muted-foreground text-center">Searching...</div>}
          {!isLoading && results && results.length === 0 && (
            <div className="p-3 text-sm text-muted-foreground text-center">No results found</div>
          )}
          {!isLoading && results && results.length > 0 && results.map((res: any, idx: number) => (
            <div 
              key={idx} 
              className="p-3 hover:bg-sidebar-accent cursor-pointer flex justify-between items-center border-b border-sidebar-border/30 last:border-0"
              onClick={() => {
                const baseSymbol = res.symbol.replace(".NS", "").replace(".BO", "");
                setQuery(baseSymbol);
                onSelect(baseSymbol);
                setIsOpen(false);
              }}
            >
              <div>
                <div className="font-bold text-white text-sm">{res.symbol}</div>
                <div className="text-xs text-muted-foreground line-clamp-1">{res.shortname || res.longname}</div>
              </div>
              <div className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                {res.exchDisp}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function FundamentalAnalysisPage() {
  const [searchInput, setSearchInput] = useState("RELIANCE");
  const [activeSymbol, setActiveSymbol] = useState("RELIANCE");
  const [aiProvider, setAiProvider] = useState("committee");

  const { data, isLoading, error } = useQuery({
    queryKey: ["fundamentals", activeSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/fundamentals/${activeSymbol}`);
      if (!res.ok) throw new Error("Failed to fetch fundamental data");
      return res.json();
    },
    enabled: !!activeSymbol,
    retry: false
  });

  const { data: newsData, isLoading: isNewsLoading } = useQuery({
    queryKey: ["fundamentals-news", activeSymbol],
    queryFn: async () => {
      const res = await fetch(`/api/fundamentals/${activeSymbol}/news`);
      if (!res.ok) throw new Error("Failed to fetch news");
      return res.json();
    },
    enabled: !!activeSymbol,
    retry: false
  });

  const analyzeMutation = useMutation({
    mutationFn: async (fundamentalData: any) => {
      const res = await fetch("/api/fundamentals/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: activeSymbol,
          fundamentalData,
          provider: aiProvider
        })
      });
      if (!res.ok) throw new Error("Analysis failed");
      return res.json();
    }
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setActiveSymbol(searchInput.trim().toUpperCase());
      analyzeMutation.reset();
    }
  };

  const handleRunAnalysis = () => {
    if (data) analyzeMutation.mutate(data);
  };

  const earningsChartData = useMemo(() => {
    return data?.earnings ? transformEarnings(data.earnings) : [];
  }, [data?.earnings]);

  return (
    <div className="p-6 space-y-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-2 font-mono tracking-tight">
            <Building2 className="h-7 w-7 text-primary" />
            FUNDAMENTAL ANALYSIS
          </h1>
          <p className="text-muted-foreground mt-1">Deep-dive valuation, AI thesis, and financial health metrics.</p>
        </div>

        <SymbolSearch onSelect={(sym) => {
          setActiveSymbol(sym);
          analyzeMutation.reset();
        }} />
      </div>

      {isLoading && (
        <div className="h-64 flex flex-col items-center justify-center font-mono text-sm text-muted-foreground animate-pulse">
          <Building2 className="h-8 w-8 mb-4 text-primary animate-bounce" />
          FETCHING FUNDAMENTALS FOR {activeSymbol}...
        </div>
      )}

      {error && !isLoading && (
        <Card className="bg-destructive/10 border-destructive">
          <CardContent className="pt-6 flex items-center gap-3 text-destructive font-mono">
            <AlertCircle className="h-5 w-5" />
            <p>Error loading fundamental data for {activeSymbol}. Ensure the symbol is correct.</p>
          </CardContent>
        </Card>
      )}

      {data && !isLoading && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Header Info */}
          <div className="bg-sidebar rounded-lg p-6 border border-sidebar-border/50 flex flex-col md:flex-row gap-6 justify-between items-center shadow-md">
            <div>
              <div className="text-sm font-mono text-muted-foreground mb-1">EQUITY</div>
              <h2 className="text-4xl font-bold text-white tracking-tight">{data.symbol}</h2>
              <div className="text-sm text-muted-foreground mt-1">Yahoo Symbol: {data.yahooSymbol}</div>
            </div>
            
            {data.price && (
              <div className="text-right">
                <div className="text-sm font-mono text-muted-foreground mb-1">CURRENT PRICE</div>
                <div className="text-3xl font-bold text-primary font-mono">
                  {data.price.currencySymbol || "₹"}{data.price.regularMarketPrice?.toFixed(2) || "N/A"}
                </div>
                {data.price.regularMarketChangePercent != null && (
                  <div className={`text-sm font-bold font-mono mt-1 flex items-center justify-end gap-1 ${data.price.regularMarketChangePercent >= 0 ? "text-success" : "text-destructive"}`}>
                    {data.price.regularMarketChangePercent >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingUp className="h-3 w-3 rotate-180" />}
                    {data.price.regularMarketChangePercent >= 0 ? "+" : ""}
                    {(data.price.regularMarketChangePercent * 100).toFixed(2)}%
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left Column: AI Analysis & Charting */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* AI Fundamental Thesis */}
              <Card className="bg-sidebar border-sidebar-border/50 shadow-md">
                <CardHeader className="pb-2 border-b border-sidebar-border/30 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-primary">
                    <BrainCircuit className="h-5 w-5" />
                    AI FUNDAMENTAL THESIS
                  </CardTitle>
                  {!analyzeMutation.data && !analyzeMutation.isPending && (
                    <Button size="sm" onClick={handleRunAnalysis} className="font-mono h-8">
                      <Activity className="h-4 w-4 mr-2" />
                      GENERATE THESIS
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="pt-6">
                  {analyzeMutation.isPending && (
                    <div className="h-32 flex flex-col items-center justify-center font-mono text-sm text-primary animate-pulse">
                      <Loader2 className="h-6 w-6 mb-3 animate-spin" />
                      GENERATING VALUE THESIS...
                    </div>
                  )}
                  {analyzeMutation.data && (
                    <div className="space-y-4 animate-in fade-in duration-500">
                      <div className="flex items-center gap-3">
                        <div className="flex-1 p-3 rounded bg-sidebar-accent/30 border border-sidebar-border/50">
                          <div className="text-xs text-muted-foreground font-mono mb-1">VERDICT</div>
                          <div className="flex items-center gap-2 font-bold text-lg font-mono">
                            {analyzeMutation.data.overallVerdict.includes("BUY") ? <CheckCircle2 className="h-5 w-5 text-success" /> : 
                             analyzeMutation.data.overallVerdict.includes("SELL") ? <XCircle className="h-5 w-5 text-destructive" /> :
                             <HelpCircle className="h-5 w-5 text-warning" />}
                            <span className={
                              analyzeMutation.data.overallVerdict.includes("BUY") ? "text-success" : 
                              analyzeMutation.data.overallVerdict.includes("SELL") ? "text-destructive" : "text-warning"
                            }>
                              {analyzeMutation.data.overallVerdict}
                            </span>
                          </div>
                        </div>
                        <div className="flex-1 p-3 rounded bg-sidebar-accent/30 border border-sidebar-border/50">
                          <div className="text-xs text-muted-foreground font-mono mb-1">CONFIDENCE</div>
                          <div className="font-bold text-lg font-mono text-white">
                            {analyzeMutation.data.confidence}%
                          </div>
                        </div>
                      </div>
                      
                      <div className="p-4 rounded-md bg-primary/5 border border-primary/20 text-sm leading-relaxed">
                        <p className="font-medium text-white mb-2">Executive Summary</p>
                        <p className="text-muted-foreground">{analyzeMutation.data.summary}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="font-mono text-xs text-primary mb-2">VALUATION</div>
                          <p className="text-muted-foreground leading-relaxed text-xs">{analyzeMutation.data.valuation}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="font-mono text-xs text-success mb-2">FINANCIAL HEALTH</div>
                          <p className="text-muted-foreground leading-relaxed text-xs">{analyzeMutation.data.financialHealth}</p>
                        </div>
                        <div className="space-y-1">
                          <div className="font-mono text-xs text-warning mb-2">GROWTH & PROFITABILITY</div>
                          <p className="text-muted-foreground leading-relaxed text-xs">{analyzeMutation.data.profitabilityAndGrowth}</p>
                        </div>
                      </div>
                    </div>
                  )}
                  {!analyzeMutation.data && !analyzeMutation.isPending && (
                    <div className="h-32 flex items-center justify-center text-muted-foreground text-sm font-mono border border-dashed border-sidebar-border/50 rounded-lg">
                      Click 'Generate Thesis' to run fundamental AI analysis.
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Earnings History Chart */}
              {earningsChartData.length > 0 && (
                <Card className="bg-sidebar border-sidebar-border/50 shadow-md">
                  <CardHeader className="pb-2 border-b border-sidebar-border/30">
                    <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                      <BarChart4 className="h-4 w-4 text-primary" />
                      QUARTERLY EARNINGS (ACTUAL VS ESTIMATE)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-6 h-72">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={earningsChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#6b7280", fontSize: 12 }} width={40} />
                        <Tooltip 
                          contentStyle={{ backgroundColor: "#1e1e2d", borderColor: "#3f3f5a", borderRadius: "8px" }}
                          itemStyle={{ color: "#e2e8f0" }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Bar dataKey="estimate" name="Estimate" fill="#3f3f5a" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="actual" name="Actual" fill="#4ade80" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Right Column: Key Stats */}
            <div className="space-y-6">
              {/* Valuation Metrics */}
              <Card className="bg-sidebar border-sidebar-border/50 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="pb-2 border-b border-sidebar-border/30">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    VALUATION METRICS
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Market Cap</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.price?.marketCap)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Trailing P/E</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatRatio(data.summaryDetail?.trailingPE)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Forward P/E</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatRatio(data.summaryDetail?.forwardPE)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">PEG Ratio (5yr)</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatRatio(data.defaultKeyStatistics?.pegRatio)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Price / Book</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatRatio(data.defaultKeyStatistics?.priceToBook)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Price / Sales</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatRatio(data.summaryDetail?.priceToSalesTrailing12Months)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Financial Highlights */}
              <Card className="bg-sidebar border-sidebar-border/50 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="pb-2 border-b border-sidebar-border/30">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                    <DollarSign className="h-4 w-4 text-success" />
                    FINANCIAL HIGHLIGHTS
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Total Revenue</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.financialData?.totalRevenue)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">EBITDA</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.financialData?.ebitda)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Total Cash</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.financialData?.totalCash)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Total Debt</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.financialData?.totalDebt)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Operating Cash Flow</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.financialData?.operatingCashflow)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Free Cashflow</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatNumber(data.financialData?.freeCashflow)}
                    </span>
                  </div>
                </CardContent>
              </Card>

              {/* Profitability & Margins */}
              <Card className="bg-sidebar border-sidebar-border/50 shadow-sm transition-all hover:shadow-md">
                <CardHeader className="pb-2 border-b border-sidebar-border/30">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                    <BarChart4 className="h-4 w-4 text-warning" />
                    PROFITABILITY
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Profit Margin</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatPercent(data.financialData?.profitMargin)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Operating Margin</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatPercent(data.financialData?.operatingMargin)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Gross Margins</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatPercent(data.financialData?.grossMargins)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Return on Assets (ROA)</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatPercent(data.financialData?.returnOnAssets)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Return on Equity (ROE)</span>
                    <span className="font-mono font-bold text-white transition-transform group-hover:scale-105">
                      {formatPercent(data.financialData?.returnOnEquity)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center group">
                    <span className="text-sm text-muted-foreground">Revenue Growth (YoY)</span>
                    <span className={`font-mono font-bold transition-transform group-hover:scale-105 ${data.financialData?.revenueGrowth > 0 ? "text-success" : "text-destructive"}`}>
                      {formatPercent(data.financialData?.revenueGrowth)}
                    </span>
                  </div>
                </CardContent>
              </Card>

            </div>

            {/* Share Statistics */}
            <Card className="bg-sidebar border-sidebar-border/50 lg:col-span-3 shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="pb-2 border-b border-sidebar-border/30">
                <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                  <Briefcase className="h-4 w-4 text-primary" />
                  SHARE STATISTICS & DIVIDENDS
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Shares Outstanding</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatNumber(data.defaultKeyStatistics?.sharesOutstanding)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Float Shares</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatNumber(data.defaultKeyStatistics?.floatShares)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Diluted EPS</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatRatio(data.defaultKeyStatistics?.trailingEps)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Book Value Per Share</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatRatio(data.defaultKeyStatistics?.bookValue)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Dividend Yield</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatPercent(data.summaryDetail?.dividendYield)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">Beta (5Y Monthly)</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatRatio(data.defaultKeyStatistics?.beta)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">52-Week High</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatRatio(data.summaryDetail?.fiftyTwoWeekHigh)}</div>
                </div>
                <div className="group">
                  <div className="text-xs text-muted-foreground mb-1 uppercase font-mono">52-Week Low</div>
                  <div className="text-xl font-bold text-white font-mono group-hover:text-primary transition-colors">{formatRatio(data.summaryDetail?.fiftyTwoWeekLow)}</div>
                </div>
              </CardContent>
            </Card>

            {/* Activities and News */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:col-span-3">
              {/* Activities */}
              <Card className="bg-sidebar border-sidebar-border/50 shadow-sm transition-all hover:shadow-md lg:col-span-1">
                <CardHeader className="pb-2 border-b border-sidebar-border/30">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                    <CalendarDays className="h-4 w-4 text-warning" />
                    ACTIVITIES & EVENTS
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {data.calendarEvents?.earnings ? (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                      <div className="text-xs text-muted-foreground font-mono mb-1 uppercase">Next Earnings Date</div>
                      <div className="font-bold text-sm text-white">
                        {data.calendarEvents.earnings.earningsDate?.[0] ? new Date(data.calendarEvents.earnings.earningsDate[0]).toLocaleDateString() : "N/A"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Est. Average: {data.calendarEvents.earnings.earningsAverage ? data.calendarEvents.earnings.earningsAverage.toFixed(2) : "N/A"}
                      </div>
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic">No earnings data available.</div>
                  )}

                  {data.calendarEvents?.exDividendDate && (
                    <div className="p-3 bg-primary/5 border border-primary/20 rounded-md">
                      <div className="text-xs text-muted-foreground font-mono mb-1 uppercase">Ex-Dividend Date</div>
                      <div className="font-bold text-sm text-white">
                        {new Date(data.calendarEvents.exDividendDate).toLocaleDateString()}
                      </div>
                    </div>
                  )}

                  {data.recommendationTrend?.trend?.[0] && (
                    <div className="p-3 bg-sidebar-accent/30 border border-sidebar-border/50 rounded-md">
                      <div className="text-xs text-muted-foreground font-mono mb-2 uppercase">Analyst Recommendations</div>
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-success">Strong Buy</span>
                        <span className="font-bold">{data.recommendationTrend.trend[0].strongBuy}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-success">Buy</span>
                        <span className="font-bold">{data.recommendationTrend.trend[0].buy}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mb-1">
                        <span className="text-muted-foreground">Hold</span>
                        <span className="font-bold">{data.recommendationTrend.trend[0].hold}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs">
                        <span className="text-destructive">Sell</span>
                        <span className="font-bold">{data.recommendationTrend.trend[0].sell}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* News */}
              <Card className="bg-sidebar border-sidebar-border/50 shadow-sm transition-all hover:shadow-md lg:col-span-2">
                <CardHeader className="pb-2 border-b border-sidebar-border/30">
                  <CardTitle className="text-sm font-mono flex items-center gap-2 text-muted-foreground">
                    <Newspaper className="h-4 w-4 text-primary" />
                    RECENT NEWS
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {isNewsLoading ? (
                    <div className="flex justify-center p-4">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : newsData && newsData.length > 0 ? (
                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
                      {newsData.map((item: any) => (
                        <a 
                          key={item.uuid} 
                          href={item.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="block p-4 rounded-md border border-sidebar-border/50 hover:bg-sidebar-accent/50 transition-colors group"
                        >
                          <div className="flex justify-between items-start gap-4">
                            <div className="space-y-1">
                              <h4 className="font-medium text-sm text-white group-hover:text-primary transition-colors line-clamp-2">
                                {item.title}
                              </h4>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>{item.publisher}</span>
                                <span>•</span>
                                <span>{new Date(item.providerPublishTime * 1000).toLocaleString()}</span>
                              </div>
                            </div>
                            <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </div>
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="text-sm text-muted-foreground italic p-4 text-center">
                      No recent news found for this symbol.
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

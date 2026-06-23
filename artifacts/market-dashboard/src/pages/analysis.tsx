import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { 
  useGetTechnicalAnalysis, 
  getGetTechnicalAnalysisQueryKey,
  useRunAgentAnalysis,
  GetTechnicalAnalysisInterval
} from "@workspace/api-client-react";
import { useLiveRefresh } from "@/hooks/use-live-refresh";
import { LiveRefreshBar } from "@/components/live-refresh-bar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Search, Loader2, BrainCircuit, Cpu, TrendingUp, TrendingDown, ShieldAlert, X, Sliders } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSettings } from "@/lib/settings";
import { cn } from "@/lib/utils";

type AgentResult = {
  symbol: string;
  summary: string;
  keyLevels: { support: number[]; resistance: number[] };
  signals: Array<{
    action: string;
    displayText: string;
    entryPrice: number | null;
    targetPrice: number | null;
    stopLoss: number | null;
    confidence: number;
    rationale: string;
    instrumentType: string;
  }>;
  riskAssessment: string;
  generatedAt: string;
};

const styleColors: Record<string, string> = {
  conservative: "text-blue-400 border-blue-500/30 bg-blue-500/10",
  moderate: "text-yellow-400 border-yellow-500/30 bg-yellow-500/10",
  aggressive: "text-red-400 border-red-500/30 bg-red-500/10",
};

export default function AnalysisBoard() {
  const { settings: agentSettings } = useSettings();
  const queryClient = useQueryClient();

  const [symbol, setSymbol] = useState(agentSettings.defaultSymbol);
  const [searchInput, setSearchInput] = useState(agentSettings.defaultSymbol);
  const [interval, setAnalysisInterval] = useState<GetTechnicalAnalysisInterval>("1d");
  const [instrumentType, setInstrumentType] = useState<string>(agentSettings.agentInstrumentType);
  const [agentResult, setAgentResult] = useState<AgentResult | null>(null);
  const [autoRanOnce, setAutoRanOnce] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<string>(agentSettings.agentProvider || "fallback");

  const { toast } = useToast();

  const { data: analysis, isLoading: loadingAnalysis, isError: analysisError } = useGetTechnicalAnalysis(
    { symbol, interval },
    { query: { queryKey: getGetTechnicalAnalysisQueryKey({ symbol, interval }), retry: 1 } }
  );

  const currentPrice = analysis?.currentPrice;

  const { isMarketOpen, isPreOpen, lastUpdatedIST, countdown, refresh } = useLiveRefresh({
    onRefresh: () => {
      queryClient.invalidateQueries({ queryKey: getGetTechnicalAnalysisQueryKey({ symbol, interval }) });
    },
  });

  const runAgent = useRunAgentAnalysis();

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const s = searchInput.trim().toUpperCase();
      setSymbol(s);
      setAgentResult(null);
    }
  };

  const handleAnalyze = (overrideSymbol?: string) => {
    const targetSymbol = overrideSymbol ?? (searchInput.trim().toUpperCase() || symbol);
    if (targetSymbol !== symbol && !overrideSymbol) {
      setSymbol(targetSymbol);
      setAgentResult(null);
    }

    runAgent.mutate({
      data: {
        symbol: targetSymbol,
        timeframe: agentSettings.agentTimeframe,
        instrumentType,
        numSignals: agentSettings.agentNumSignals,
        maxTokens: agentSettings.agentMaxTokens,
        style: agentSettings.agentStyle,
        customContext: agentSettings.agentCustomContext,
        confidenceThreshold: agentSettings.agentConfidenceThreshold,
        saveSignals: agentSettings.agentSaveSignals,
        provider: selectedProvider,
      } as Parameters<typeof runAgent.mutate>[0]["data"]
    }, {
      onSuccess: (result) => {
        setAgentResult(result as unknown as AgentResult);
        toast({ title: "AI Analysis Complete", description: `Analysis ready for ${targetSymbol}` });
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to run agent analysis.", variant: "destructive" });
      },
    });
  };

  // Auto-run on mount if enabled in settings
  useEffect(() => {
    if (agentSettings.agentAutoRun && !autoRanOnce) {
      setAutoRanOnce(true);
      handleAnalyze(symbol);
    }
  }, []);

  const confidenceThreshold = agentSettings.agentConfidenceThreshold;
  const filteredSignals = agentResult?.signals.filter((s) => s.confidence >= confidenceThreshold) ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight font-mono">TECHNICAL ANALYSIS</h1>
          <LiveRefreshBar
            isMarketOpen={isMarketOpen}
            isPreOpen={isPreOpen}
            lastUpdatedIST={lastUpdatedIST}
            countdown={countdown}
            onRefresh={refresh}
          />
        </div>

        <div className="flex gap-2 items-center flex-wrap">
          <form onSubmit={handleSearch} className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="pl-9 w-[180px] font-mono border-muted bg-card uppercase"
              placeholder="SYMBOL..."
            />
          </form>

          <Select value={interval} onValueChange={(v: GetTechnicalAnalysisInterval) => setAnalysisInterval(v)}>
            <SelectTrigger className="w-[110px] font-mono border-muted bg-card">
              <SelectValue placeholder="INTERVAL" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5m">5 MIN</SelectItem>
              <SelectItem value="15m">15 MIN</SelectItem>
              <SelectItem value="1h">1 HOUR</SelectItem>
              <SelectItem value="1d">1 DAY</SelectItem>
            </SelectContent>
          </Select>

          <Select value={instrumentType} onValueChange={setInstrumentType}>
            <SelectTrigger className="w-[110px] font-mono border-muted bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="STOCK">STOCK</SelectItem>
              <SelectItem value="INDEX">INDEX</SelectItem>
              <SelectItem value="OPTIONS">OPTIONS</SelectItem>
              <SelectItem value="FUTURES">FUTURES</SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedProvider} onValueChange={(v) => setSelectedProvider(v)}>
            <SelectTrigger className="w-[125px] font-mono border-muted bg-card text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="fallback">Auto Fallback</SelectItem>
              <SelectItem value="nvidia">NVIDIA NIM</SelectItem>
              <SelectItem value="openai">ChatGPT</SelectItem>
              <SelectItem value="claude">Claude</SelectItem>
              <SelectItem value="gemini">Gemini</SelectItem>
              <SelectItem value="gemma">Gemma</SelectItem>
              <SelectItem value="ollama">Ollama Local</SelectItem>
              <SelectItem value="deepseek">DeepSeek AI</SelectItem>
              <SelectItem value="groq">Groq Fast</SelectItem>
            </SelectContent>
          </Select>

          {/* Agent config summary badge */}
          <div className={cn(
            "hidden sm:flex items-center gap-1 text-[10px] font-mono border rounded-sm px-2 py-1",
            styleColors[agentSettings.agentStyle] ?? "border-muted text-muted-foreground"
          )}>
            <Sliders className="h-3 w-3" />
            {agentSettings.agentStyle.toUpperCase()} · {agentSettings.agentTimeframe} · ≥{confidenceThreshold}%
          </div>

          <Button
            onClick={() => handleAnalyze()}
            disabled={runAgent.isPending}
            className="font-mono bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {runAgent.isPending
              ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              : <BrainCircuit className="mr-2 h-4 w-4" />}
            AI AGENT
          </Button>
        </div>
      </div>

      {/* Auto-run indicator */}
      {agentSettings.agentAutoRun && !autoRanOnce && (
        <div className="flex items-center gap-2 text-xs font-mono text-primary/80 border border-primary/20 bg-primary/5 rounded-sm px-3 py-2">
          <Loader2 className="h-3 w-3 animate-spin" />
          Auto-Run enabled — launching agent analysis…
        </div>
      )}

      {/* Agent running */}
      {runAgent.isPending && (
        <Card className="rounded-sm border-primary/40 bg-primary/5">
          <CardContent className="p-6 flex items-center gap-4">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <div>
              <div className="font-mono font-bold text-sm">RUNNING AI ANALYSIS…</div>
              <div className="text-xs text-muted-foreground mt-1">
                Style: <span className="capitalize">{agentSettings.agentStyle}</span> ·
                Timeframe: {agentSettings.agentTimeframe} ·
                Instrument: {instrumentType} ·
                Tokens: {agentSettings.agentMaxTokens}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Agent result */}
      {agentResult && !runAgent.isPending && (
        <Card className="rounded-sm border-primary/40 bg-card">
          <CardHeader className="p-4 border-b border-muted flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 flex-wrap">
              <BrainCircuit className="h-4 w-4 text-primary" />
              <CardTitle className="text-sm font-mono">AI AGENT ANALYSIS — {agentResult.symbol}</CardTitle>
              <Badge variant="outline" className={cn("text-[10px] font-mono border", styleColors[agentSettings.agentStyle])}>
                {agentSettings.agentStyle.toUpperCase()}
              </Badge>
              <Badge variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                {agentSettings.agentTimeframe}
              </Badge>
              {agentSettings.agentConfidenceThreshold > 0 && (
                <Badge variant="outline" className="text-[10px] font-mono border-muted text-muted-foreground">
                  ≥{agentSettings.agentConfidenceThreshold}% CONF
                </Badge>
              )}
            </div>
            <button onClick={() => setAgentResult(null)} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="p-4 space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">{agentResult.summary}</p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-success/5 border border-success/20 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-3.5 w-3.5 text-success" />
                  <span className="text-xs font-mono font-bold text-success">SUPPORT LEVELS</span>
                </div>
                <div className="space-y-1">
                  {agentResult.keyLevels.support.length > 0
                    ? agentResult.keyLevels.support.map((lvl, i) => (
                        <div key={i} className="font-mono text-sm font-bold">{typeof lvl === "number" ? lvl.toFixed(2) : lvl}</div>
                      ))
                    : <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="bg-destructive/5 border border-destructive/20 rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                  <span className="text-xs font-mono font-bold text-destructive">RESISTANCE LEVELS</span>
                </div>
                <div className="space-y-1">
                  {agentResult.keyLevels.resistance.length > 0
                    ? agentResult.keyLevels.resistance.map((lvl, i) => (
                        <div key={i} className="font-mono text-sm font-bold">{typeof lvl === "number" ? lvl.toFixed(2) : lvl}</div>
                      ))
                    : <div className="text-xs text-muted-foreground">—</div>}
                </div>
              </div>

              <div className="bg-muted/20 border border-muted rounded-sm p-3">
                <div className="flex items-center gap-2 mb-2">
                  <ShieldAlert className="h-3.5 w-3.5 text-warning" />
                  <span className="text-xs font-mono font-bold text-warning">RISK ASSESSMENT</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{agentResult.riskAssessment}</p>
              </div>
            </div>

            {/* Signals */}
            {filteredSignals.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="text-xs font-mono text-muted-foreground font-bold tracking-wider">AI SIGNALS</div>
                  {agentResult.signals.length !== filteredSignals.length && (
                    <div className="text-xs font-mono text-muted-foreground">
                      {agentResult.signals.length - filteredSignals.length} signal(s) filtered (below {confidenceThreshold}% confidence)
                    </div>
                  )}
                </div>
                {filteredSignals.map((sig, i) => (
                  <div key={i} className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-3 border border-muted rounded-sm bg-muted/10 hover:bg-muted/20 transition-colors">
                    <div className="flex items-start gap-3">
                      <Badge variant="outline" className={cn(
                        "font-mono text-xs border-0 px-2 py-0.5 shrink-0",
                        sig.action === "BUY" ? "bg-success/20 text-success" :
                        sig.action === "SELL" ? "bg-destructive/20 text-destructive" :
                        "bg-warning/20 text-warning"
                      )}>
                        {sig.action}
                      </Badge>
                      <div>
                        <div className="font-mono font-bold text-sm">{sig.displayText}</div>
                        <div className="text-xs text-muted-foreground mt-0.5">{sig.rationale}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-mono shrink-0">
                      <div className="text-muted-foreground">ENTRY: <span className="text-foreground font-bold">{sig.entryPrice ?? "—"}</span></div>
                      <div className="text-muted-foreground">TARGET: <span className="text-success font-bold">{sig.targetPrice ?? "—"}</span></div>
                      <div className="text-muted-foreground">SL: <span className="text-destructive font-bold">{sig.stopLoss ?? "—"}</span></div>
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-[10px] font-bold border",
                        sig.confidence > 70 ? "text-success border-success/30 bg-success/10" :
                        sig.confidence > 40 ? "text-warning border-warning/30 bg-warning/10" :
                        "text-destructive border-destructive/30 bg-destructive/10"
                      )}>
                        {sig.confidence}%
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : agentResult.signals.length > 0 ? (
              <div className="text-center py-4 border border-muted border-dashed rounded-sm text-xs font-mono text-muted-foreground">
                All {agentResult.signals.length} signal(s) filtered below {confidenceThreshold}% confidence threshold.
                Lower the threshold in Settings → AI Agent.
              </div>
            ) : null}

            <div className="text-[10px] font-mono text-muted-foreground/50 text-right">
              Generated at {new Date(agentResult.generatedAt).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata" })} · Saved to signals: {agentSettings.agentSaveSignals ? "YES" : "NO"}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Technical indicators */}
      {loadingAnalysis ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      ) : analysisError || !analysis ? (
        <div className="py-20 text-center border border-muted border-dashed rounded-sm bg-card">
          <h3 className="text-lg font-mono font-bold text-muted-foreground">NO DATA FOUND FOR {symbol}</h3>
          <p className="text-sm text-muted-foreground mt-2">
            {analysisError ? "Could not fetch market data. Markets may be closed or the symbol is invalid." : "Enter a valid NSE symbol and press Enter."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="rounded-sm border-muted col-span-1 md:col-span-2 bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">OVERALL SIGNAL</div>
                <div className="flex items-center gap-4">
                  <div className={cn("text-4xl font-bold font-mono tracking-tight",
                    analysis.overallSignal === "BUY" ? "text-success" :
                    analysis.overallSignal === "SELL" ? "text-destructive" : "text-warning"
                  )}>
                    {analysis.overallSignal}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-mono text-muted-foreground mb-1">STRENGTH: {analysis.signalStrength}%</div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div className={cn("h-full",
                        analysis.overallSignal === "BUY" ? "bg-success" :
                        analysis.overallSignal === "SELL" ? "bg-destructive" : "bg-warning"
                      )} style={{ width: `${analysis.signalStrength}%` }} />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">TREND</div>
                <Badge variant="outline" className={cn(
                  "font-mono text-lg py-1 px-3 w-fit border-0",
                  analysis?.trend?.includes("BULLISH") ? "bg-success/20 text-success" :
                  analysis?.trend?.includes("BEARISH") ? "bg-destructive/20 text-destructive" : "bg-warning/20 text-warning"
                )}>
                  {analysis?.trend ? analysis.trend.replace("_", " ") : "NEUTRAL"}
                </Badge>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardContent className="p-6 flex flex-col justify-center h-full">
                <div className="text-sm font-mono text-muted-foreground mb-2">RSI (14)</div>
                <div className={cn("text-3xl font-bold font-mono",
                  analysis.rsi && analysis.rsi > 70 ? "text-destructive" :
                  analysis.rsi && analysis.rsi < 30 ? "text-success" : "text-foreground"
                )}>
                  {analysis.rsi?.toFixed(2) || "N/A"}
                </div>
                <div className="text-xs font-mono text-muted-foreground mt-1">
                  {analysis.rsi && analysis.rsi > 70 ? "OVERBOUGHT" :
                   analysis.rsi && analysis.rsi < 30 ? "OVERSOLD" : "NEUTRAL"}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MACD (12, 26, 9)</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "MACD LINE", val: analysis.macd?.macd.toFixed(4) },
                  { label: "SIGNAL LINE", val: analysis.macd?.signal.toFixed(4) },
                  { label: "HISTOGRAM", val: analysis.macd?.histogram.toFixed(4), color: (analysis.macd?.histogram ?? 0) > 0 ? "text-success" : "text-destructive" },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center border-b border-muted pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-sm text-muted-foreground">{r.label}</span>
                    <span className={cn("font-mono font-bold", r.color)}>{r.val || "N/A"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">MOVING AVERAGES</CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                {[
                  { label: "SMA 20",  val: analysis.sma20?.toFixed(2) },
                  { label: "SMA 50",  val: analysis.sma50?.toFixed(2) },
                  { label: "SMA 200", val: analysis.sma200?.toFixed(2) },
                  { label: "EMA 9",   val: analysis.ema9?.toFixed(2) },
                ].map((r) => (
                  <div key={r.label} className="flex justify-between items-center border-b border-muted pb-2 last:border-0 last:pb-0">
                    <span className="font-mono text-sm text-muted-foreground">{r.label}</span>
                    <span className="font-mono font-bold">{r.val || "N/A"}</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card md:col-span-2">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">BOLLINGER BANDS (20, 2)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-3 gap-6 text-center">
                  {[
                    { label: "UPPER BAND", val: analysis.bollingerBands?.upper.toFixed(2), border: "border-muted" },
                    { label: "MIDDLE (SMA 20)", val: analysis.bollingerBands?.middle.toFixed(2), border: "border-primary/20" },
                    { label: "LOWER BAND", val: analysis.bollingerBands?.lower.toFixed(2), border: "border-muted" },
                  ].map((b) => (
                    <div key={b.label} className={cn("bg-muted/20 p-4 rounded-sm border", b.border)}>
                      <div className="text-xs font-mono text-muted-foreground mb-2">{b.label}</div>
                      <div className="font-mono font-bold text-lg">{b.val || "N/A"}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* ──── ADVANCED INDICATORS SECTION ──── */}
            
            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-primary" />
                  ADVANCED TREND & STRUCTURE
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="font-mono text-xs text-muted-foreground">SUPERTREND (7, 3)</span>
                  <Badge variant="outline" className={cn(
                    "font-mono text-xs border px-2 py-0.5",
                    analysis.supertrend?.direction === "BULLISH"
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  )}>
                    {analysis.supertrend?.direction || "N/A"}
                  </Badge>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="font-mono text-xs text-muted-foreground">SUPERTREND LEVEL</span>
                  <span className="font-mono font-bold">{analysis.supertrend?.value?.toFixed(2) || "N/A"}</span>
                </div>
                <div className="text-[11px] text-muted-foreground font-mono pb-2 border-b border-muted/50">
                  {analysis.supertrend?.direction === "BULLISH" ? (
                    <span className="text-success">▲ Price is trading ABOVE the Supertrend band.</span>
                  ) : (
                    <span className="text-destructive">▼ Price is trading BELOW the Supertrend band.</span>
                  )}
                </div>

                {/* Aroon Section */}
                <div className="flex justify-between items-center border-b border-muted pb-2 pt-2">
                  <span className="font-mono text-xs text-muted-foreground">AROON UP / DOWN</span>
                  <span className="font-mono font-bold text-xs">
                    {analysis.aroon?.up || "50"}% / {analysis.aroon?.down || "50"}%
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-12 shrink-0">UP:</span>
                    <Progress value={analysis.aroon?.up || 50} className="h-1.5 [&>div]:bg-success flex-1" />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-mono text-muted-foreground w-12 shrink-0">DOWN:</span>
                    <Progress value={analysis.aroon?.down || 50} className="h-1.5 [&>div]:bg-destructive flex-1" />
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono mt-1">
                    {analysis.aroon ? (
                      analysis.aroon.up > analysis.aroon.down ? (
                        <span className="text-success">Uptrend dominant</span>
                      ) : analysis.aroon.down > analysis.aroon.up ? (
                        <span className="text-destructive">Downtrend dominant</span>
                      ) : (
                        <span>Range-bound market</span>
                      )
                    ) : "N/A"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  ADX & STOCHASTIC
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                <div className="flex justify-between items-center border-b border-muted pb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">ADX (14)</span>
                  <span className="font-mono font-bold">
                    {analysis.adx?.adx?.toFixed(1) || "N/A"}{" "}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      ({analysis.adx ? (analysis.adx.adx > 25 ? "STRONG TREND" : "WEAK TREND") : "N/A"})
                    </span>
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">STOCH K / D</span>
                  <span className="font-mono font-bold">
                    {analysis.stochastic?.k?.toFixed(1) || "N/A"} / {analysis.stochastic?.d?.toFixed(1) || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">ATR (14)</span>
                  <span className="font-mono font-bold">{analysis.atr?.toFixed(2) || "N/A"}</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono pt-1">
                  DYNAMIC STOP: Place stops 2xATR (~{(2 * (analysis.atr ?? 0)).toFixed(1)} pts) away from entries.
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5">
                  <Cpu className="h-4 w-4 text-primary" />
                  MOMENTUM OSCILLATORS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-3">
                {/* Schaff Trend Cycle */}
                <div className="flex justify-between items-center border-b border-muted pb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">STC (23, 50, 10)</span>
                  <span className={cn(
                    "font-mono font-bold",
                    analysis.stc && analysis.stc > 75 ? "text-destructive" : analysis.stc && analysis.stc < 25 ? "text-success" : "text-foreground"
                  )}>
                    {analysis.stc?.toFixed(1) || "50.0"}
                  </span>
                </div>
                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden mb-1">
                  <div className={cn("h-full",
                    analysis.stc && analysis.stc > 50 ? "bg-destructive" : "bg-success"
                  )} style={{ width: `${analysis.stc || 50}%` }} />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground pb-2 border-b border-muted/50">
                  {analysis.stc ? (
                    analysis.stc > 50 ? <span className="text-destructive">BEARISH MOMENTUM</span> : <span className="text-success">BULLISH MOMENTUM</span>
                  ) : "N/A"}
                </div>

                {/* Klinger Volume Oscillator */}
                <div className="flex justify-between items-center border-b border-muted pb-1.5 pt-1">
                  <span className="font-mono text-xs text-muted-foreground">KLINGER (34, 55, 13)</span>
                  <span className="font-mono font-bold text-xs">
                    KVO: {analysis.klinger ? analysis.klinger.kvo.toLocaleString("en-IN") : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-1.5">
                  <span className="font-mono text-xs text-muted-foreground">KLINGER SIGNAL</span>
                  <span className="font-mono font-bold text-xs">
                    {analysis.klinger ? analysis.klinger.signal.toLocaleString("en-IN") : "N/A"}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono">
                  {analysis.klinger ? (
                    analysis.klinger.kvo > analysis.klinger.signal ? (
                      <span className="text-success">KVO above signal - bullish</span>
                    ) : (
                      <span className="text-destructive">KVO below signal - bearish</span>
                    )
                  ) : "N/A"}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono flex items-center gap-1.5">
                  <Sliders className="h-4 w-4 text-primary" />
                  VOLUME & FLOW INDICATORS
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="font-mono text-xs text-muted-foreground">VWAP</span>
                  <span className="font-mono font-bold">{analysis.vwap?.toFixed(2) || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="font-mono text-xs text-muted-foreground">OBV (VOLUME FLOW)</span>
                  <span className="font-mono font-bold">
                    {analysis.obv ? (analysis.obv >= 1000000 ? `${(analysis.obv / 1000000).toFixed(1)}M` : analysis.obv.toLocaleString("en-IN")) : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-muted pb-2">
                  <span className="font-mono text-xs text-muted-foreground">SESSION POC</span>
                  <span className="font-mono font-bold">{analysis.sessionPoc?.toFixed(2) || "N/A"}</span>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-1">
                  {analysis.vwap && currentPrice ? (
                    currentPrice > analysis.vwap ? (
                      <span className="text-success">VWAP acts as dynamic support/resistance. Price above VWAP (bullish bias)</span>
                    ) : (
                      <span className="text-destructive">VWAP acts as dynamic support/resistance. Price below VWAP (bearish bias)</span>
                    )
                  ) : "N/A"}
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card md:col-span-2">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">FIBONACCI RETRACEMENT LEVELS (50 BAR RANGE)</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  {[
                    { label: "HIGH (100%)", val: analysis.fibonacci?.h100, color: "text-success" },
                    { label: "78.6%", val: analysis.fibonacci?.h786, color: "text-success/80" },
                    { label: "61.8%", val: analysis.fibonacci?.h618, color: "text-foreground" },
                    { label: "50.0%", val: analysis.fibonacci?.h50, color: "text-foreground" },
                    { label: "38.2%", val: analysis.fibonacci?.h382, color: "text-foreground" },
                    { label: "23.6%", val: analysis.fibonacci?.h236, color: "text-destructive/80" },
                    { label: "LOW (0%)", val: analysis.fibonacci?.h0, color: "text-destructive" },
                  ].map((fib) => (
                    <div key={fib.label} className="bg-muted/10 border border-muted/30 p-3 rounded-sm text-center">
                      <div className="text-[10px] font-mono text-muted-foreground mb-1">{fib.label}</div>
                      <div className={cn("font-mono text-xs font-bold", fib.color)}>{fib.val?.toFixed(2) || "N/A"}</div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-3 text-center">
                  Key support/resistance: 38.2%, 50%, 61.8% are the most watched retracement levels.
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-sm border-muted bg-card md:col-span-2">
              <CardHeader className="p-4 border-b border-muted">
                <CardTitle className="text-sm font-mono">INDIA VIX - VOLATILITY GAUGE</CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                  <div>
                    <div className="text-3xl font-bold font-mono text-warning">
                      {analysis.indiaVix?.toFixed(2) || "15.00"}
                    </div>
                    <span className="text-[11px] text-muted-foreground font-mono block mt-1">
                      {analysis.indiaVix && analysis.indiaVix > 18 ? "ELEVATED" : "NORMAL"}
                    </span>
                  </div>
                  <div className="flex-1 max-w-md w-full">
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                      <div className="bg-success h-full" style={{ width: "30%" }} />
                      <div className="bg-warning h-full" style={{ width: "40%" }} />
                      <div className="bg-destructive h-full" style={{ width: "30%" }} />
                    </div>
                    <div className="flex justify-between text-[9px] font-mono text-muted-foreground mt-2">
                      <span>LOW (&lt;15)</span>
                      <span>MODERATE (15-20)</span>
                      <span>HIGH (&gt;20)</span>
                    </div>
                  </div>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono mt-3">
                  India VIX measures expected market volatility over the next 30 days. Above 20 - options expensive.
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}

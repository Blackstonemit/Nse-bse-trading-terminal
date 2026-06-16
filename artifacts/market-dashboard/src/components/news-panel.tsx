import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useGetMarketNews,
  useAnalyzeMarketNews,
  getGetMarketNewsQueryKey,
} from "@workspace/api-client-react";
import {
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  Brain,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  MinusCircle,
  Globe,
  Coins,
  Flame,
  Briefcase,
  Layers,
  Sparkles,
  MessageSquare,
  Send,
  Trash2,
  Plus,
  BrainCircuit,
  Loader2,
  User as UserIcon,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────────────────────────
export interface NewsItem {
  uuid: string;
  title: string;
  publisher: string;
  link: string;
  time: string;
  tags: string[];
}

export interface NewsAnalysisResult {
  marketSentiment: "BULLISH" | "BEARISH" | "NEUTRAL";
  impactScore: number;
  summary: string;
  catalysts: string[];
  risks: string[];
}

interface NewsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

interface DBMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

interface DBConversation {
  id: number;
  title: string;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────
function getRelativeTime(timeStr: string): string {
  try {
    const d = new Date(timeStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays}d ago`;
  } catch {
    return "";
  }
}

function getTagIcon(tag: string) {
  const t = tag.toLowerCase();
  if (t.includes("rupee") || t.includes("inr")) return <Coins className="h-3 w-3 mr-1" />;
  if (t.includes("gold") || t.includes("commodity")) return <Sparkles className="h-3 w-3 mr-1" />;
  if (t.includes("oil") || t.includes("energy")) return <Flame className="h-3 w-3 mr-1" />;
  if (t.includes("deal") || t.includes("business")) return <Briefcase className="h-3 w-3 mr-1" />;
  if (t.includes("india")) return <Layers className="h-3 w-3 mr-1" />;
  return <Globe className="h-3 w-3 mr-1" />;
}

function getTagStyle(tag: string): string {
  const t = tag.toLowerCase();
  if (t.includes("rupee") || t.includes("inr")) return "bg-indigo-950/40 text-indigo-400 border-indigo-900/50";
  if (t.includes("gold") || t.includes("commodity")) return "bg-amber-950/40 text-amber-400 border-amber-900/50";
  if (t.includes("oil") || t.includes("energy")) return "bg-rose-950/40 text-rose-400 border-rose-900/50";
  if (t.includes("deal") || t.includes("business")) return "bg-emerald-950/40 text-emerald-400 border-emerald-900/50";
  if (t.includes("india")) return "bg-cyan-950/40 text-cyan-400 border-cyan-900/50";
  if (t.includes("global")) return "bg-blue-950/40 text-blue-400 border-blue-900/50";
  return "bg-zinc-900 text-zinc-400 border-zinc-800";
}

// ── Component ────────────────────────────────────────────────────────────────
export function NewsPanel({ isOpen, onToggle }: NewsPanelProps) {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"news" | "copilot">("news");
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [aiAnalysis, setAiAnalysis] = useState<NewsAnalysisResult | null>(null);
  const lastAnalyzedRef = useRef<string>("");

  // Copilot States
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [chatInput, setChatInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── Queries & Mutations for News ──
  const { data: newsData, isLoading: loadingNews, isFetching: fetchingNews, refetch: refetchNews } = useGetMarketNews({
    query: {
      queryKey: getGetMarketNewsQueryKey(),
      refetchInterval: false,
      staleTime: 60000,
    }
  });

  const analyzeMutation = useAnalyzeMarketNews();

  const handleRefresh = useCallback(() => {
    refetchNews();
    setSecondsLeft(300);
  }, [refetchNews]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          refetchNews();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [refetchNews]);

  const formattedCountdown = useMemo(() => {
    const m = Math.floor(secondsLeft / 60);
    const s = secondsLeft % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }, [secondsLeft]);

  const handleAiAnalysis = useCallback(() => {
    if (!Array.isArray(newsData) || newsData.length === 0) return;
    const titles = newsData.map((item) => item.title);
    lastAnalyzedRef.current = titles.join("|");
    
    analyzeMutation.mutate(
      { data: { newsTitles: titles } },
      {
        onSuccess: (data) => {
          setAiAnalysis(data as NewsAnalysisResult);
        },
      }
    );
  }, [newsData, analyzeMutation]);

  useEffect(() => {
    if (Array.isArray(newsData) && newsData.length > 0) {
      const titlesStr = newsData.map((item) => item.title).join("|");
      if (lastAnalyzedRef.current !== titlesStr) {
        lastAnalyzedRef.current = titlesStr;
        handleAiAnalysis();
      }
    }
  }, [newsData, handleAiAnalysis]);

  // ── Queries & Mutations for Copilot ──
  const { data: conversationsList = [], refetch: refetchConversations } = useQuery<DBConversation[]>({
    queryKey: ["/api/conversations"],
    queryFn: async () => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/conversations`);
      if (!res.ok) throw new Error("Failed to fetch conversations");
      return res.json();
    },
    enabled: activeTab === "copilot"
  });

  const { data: messagesList = [], isLoading: loadingMessages, refetch: refetchMessages } = useQuery<DBMessage[]>({
    queryKey: ["/api/conversations", activeConvId, "messages"],
    queryFn: async () => {
      if (!activeConvId) return [];
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/conversations/${activeConvId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: activeTab === "copilot" && !!activeConvId
  });

  const createConvMutation = useMutation({
    mutationFn: async (title: string) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title })
      });
      if (!res.ok) throw new Error("Failed to create conversation");
      return res.json() as Promise<DBConversation>;
    },
    onSuccess: (newConv) => {
      refetchConversations();
      setActiveConvId(newConv.id);
    }
  });

  const deleteConvMutation = useMutation({
    mutationFn: async (id: number) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete conversation");
    },
    onSuccess: () => {
      refetchConversations();
      setActiveConvId(null);
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (content: string) => {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/conversations/${activeConvId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content })
      });
      if (!res.ok) throw new Error("Chat call failed");
      return res.json() as Promise<{ message: DBMessage; executedTools: any[] }>;
    },
    onSuccess: () => {
      refetchMessages();
      setChatInput("");
    }
  });

  const activeConversation = useMemo(() => {
    return conversationsList.find((c) => c.id === activeConvId) ?? null;
  }, [conversationsList, activeConvId]);

  // Scroll to bottom helper
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (messagesList.length > 0) {
      scrollToBottom();
    }
  }, [messagesList.length, scrollToBottom]);

  const handleSend = () => {
    const val = chatInput.trim();
    if (!val || chatMutation.isPending) return;
    chatMutation.mutate(val);
  };

  const handleNewChat = () => {
    const title = `Scans & Trades - ${new Date().toLocaleTimeString("en-IN", { hour: '2-digit', minute: '2-digit' })}`;
    createConvMutation.mutate(title);
  };

  return (
    <div
      className={cn(
        "fixed top-0 right-0 z-20 h-screen w-[360px] border-l border-border bg-card/90 backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Stick out toggle handle */}
      <button
        onClick={onToggle}
        className="absolute left-[-28px] top-20 w-7 h-12 bg-card border border-r-0 border-border rounded-l-md flex items-center justify-center cursor-pointer shadow-md hover:bg-muted/50 transition-colors z-30 focus:outline-none"
      >
        {isOpen ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronLeft className="h-4 w-4 text-primary animate-pulse" />
        )}
      </button>

      {/* Header and Tab Selector */}
      <div className="h-14 px-3 border-b border-border flex items-center justify-between shrink-0 bg-background/50">
        <div className="flex w-full items-center justify-between">
          <div className="flex gap-1 border border-muted bg-background/30 p-0.5 rounded-sm">
            <button
              onClick={() => setActiveTab("news")}
              className={cn(
                "px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded-sm transition-colors cursor-pointer",
                activeTab === "news" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/30"
              )}
            >
              News
            </button>
            <button
              onClick={() => setActiveTab("copilot")}
              className={cn(
                "px-2.5 py-1 text-[9px] font-mono font-bold uppercase rounded-sm transition-colors cursor-pointer",
                activeTab === "copilot" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted/30"
              )}
            >
              AI Copilot
            </button>
          </div>

          {activeTab === "news" ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[9px] text-muted-foreground bg-muted/30 px-1 rounded">
                {formattedCountdown}
              </span>
              <button
                onClick={handleRefresh}
                disabled={fetchingNews || loadingNews}
                className="p-1 rounded hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw
                  className={cn(
                    "h-3 w-3",
                    (fetchingNews || loadingNews) && "animate-spin text-primary"
                  )}
                />
              </button>
            </div>
          ) : (
            <Button
              onClick={handleNewChat}
              disabled={createConvMutation.isPending}
              size="sm"
              variant="outline"
              className="h-7 text-[9px] font-mono border-muted px-2 gap-1 flex items-center"
            >
              <Plus className="h-3 w-3" />
              NEW CHAT
            </Button>
          )}
        </div>
      </div>

      {/* Main Tabbed Sections */}
      {activeTab === "news" ? (
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {/* AI Sentiment Analysis Card */}
            <div className="border border-border/60 rounded-md bg-muted/10 p-3 space-y-3 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/5 rounded-full blur-2xl pointer-events-none" />
              
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Brain className="h-4 w-4 text-primary" />
                  <span className="font-mono text-[10px] font-bold text-muted-foreground uppercase">
                    AI Sentiment Scan
                  </span>
                </div>
                {aiAnalysis && (
                  <button
                    onClick={handleAiAnalysis}
                    disabled={analyzeMutation.isPending}
                    className="text-[9px] text-primary hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    Re-analyze
                  </button>
                )}
              </div>

              {!aiAnalysis && !analyzeMutation.isPending && (
                <div className="py-2 text-center space-y-2">
                  <p className="text-[11px] text-muted-foreground">
                    Analyze global & local news to scan NIFTY/BANKNIFTY impact.
                  </p>
                  <button
                    onClick={handleAiAnalysis}
                    disabled={loadingNews || !newsData || newsData.length === 0}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 bg-primary hover:bg-primary/95 text-primary-foreground text-xs font-mono rounded font-bold transition-all shadow-md"
                  >
                    <Brain className="h-3.5 w-3.5" />
                    Scan Sentiment
                  </button>
                </div>
              )}

              {analyzeMutation.isPending && (
                <div className="py-6 flex flex-col items-center justify-center space-y-2">
                  <Spinner className="h-4 w-4 text-primary" />
                  <span className="text-[10px] text-muted-foreground font-mono animate-pulse">
                    Scanning news catalysts...
                  </span>
                </div>
              )}

              {aiAnalysis && !analyzeMutation.isPending && (
                <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-200">
                  <div className="flex items-center justify-between p-2 rounded-sm border border-border bg-background/50">
                    <div>
                      <span className="text-[9px] text-muted-foreground font-mono block leading-none mb-1">SENTIMENT</span>
                      <span
                        className={cn(
                          "text-xs font-bold tracking-wide",
                          aiAnalysis.marketSentiment === "BULLISH" && "text-success",
                          aiAnalysis.marketSentiment === "BEARISH" && "text-destructive",
                          aiAnalysis.marketSentiment === "NEUTRAL" && "text-warning"
                        )}
                      >
                        {aiAnalysis.marketSentiment}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-[9px] text-muted-foreground font-mono block leading-none mb-1">IMPACT SCORE</span>
                      <span className="text-xs font-bold font-mono">
                        {aiAnalysis.impactScore}/100
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Progress
                      value={aiAnalysis.impactScore}
                      className={cn(
                        "h-1.5",
                        aiAnalysis.marketSentiment === "BULLISH" && "[&>div]:bg-success",
                        aiAnalysis.marketSentiment === "BEARISH" && "[&>div]:bg-destructive",
                        aiAnalysis.marketSentiment === "NEUTRAL" && "[&>div]:bg-warning"
                      )}
                    />
                  </div>

                  <p className="text-[11px] leading-relaxed text-muted-foreground bg-background/30 p-2 rounded border border-border/30">
                    {aiAnalysis.summary}
                  </p>

                  <div className="space-y-2 pt-1 border-t border-border/40">
                    {aiAnalysis.catalysts && aiAnalysis.catalysts.length > 0 && (
                      <div className="space-y-1">
                        <span className="text-[9px] text-success font-mono uppercase tracking-wider block font-bold">
                          ▲ Catalysts
                        </span>
                        {aiAnalysis.catalysts.map((cat, idx) => (
                          <div key={idx} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-success shrink-0 mt-0.5" />
                            <span>{cat}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {aiAnalysis.risks && aiAnalysis.risks.length > 0 && (
                      <div className="space-y-1 pt-1">
                        <span className="text-[9px] text-destructive font-mono uppercase tracking-wider block font-bold">
                          ▼ Tail Risks
                        </span>
                        {aiAnalysis.risks.map((risk, idx) => (
                          <div key={idx} className="flex items-start gap-1 text-[10px] text-muted-foreground">
                            <AlertTriangle className="h-3 w-3 text-destructive shrink-0 mt-0.5" />
                            <span>{risk}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between border-b border-border/50 pb-1">
              <span className="font-mono text-[9px] text-muted-foreground uppercase tracking-wider">
                Headline Feed
              </span>
              <span className="font-mono text-[9px] text-muted-foreground">
                {newsData ? `${newsData.length} Articles` : "Loading..."}
              </span>
            </div>

            {loadingNews && (
              <div className="space-y-3 py-6">
                {Array.from({ length: 4 }).map((_, idx) => (
                  <div key={idx} className="space-y-2 border border-border/40 rounded p-3 animate-pulse bg-muted/5">
                    <div className="h-3 bg-muted rounded w-3/4" />
                    <div className="h-3 bg-muted rounded w-1/2" />
                    <div className="flex justify-between pt-1">
                      <div className="h-2 bg-muted rounded w-1/4" />
                      <div className="h-2 bg-muted rounded w-1/6" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loadingNews && (!Array.isArray(newsData) || newsData.length === 0) && (
              <div className="py-12 text-center text-muted-foreground font-mono text-[11px]">
                NO NEWS CURRENTLY INDEXED
              </div>
            )}

            {Array.isArray(newsData) && newsData.length > 0 && (
              <div className="space-y-3">
                {newsData.map((item: any) => (
                  <div
                    key={item.uuid}
                    onClick={() => window.open(item.link, "_blank")}
                    className="group relative p-3 border border-border/50 rounded bg-background hover:bg-muted/10 hover:border-border transition-all duration-200 cursor-pointer shadow-xs"
                  >
                    <h3 className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {item.title}
                    </h3>
                    {item.tags && item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {item.tags.map((tag: string) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className={cn(
                              "px-1.5 py-0 text-[8px] border font-medium flex items-center",
                              getTagStyle(tag)
                            )}
                          >
                            {getTagIcon(tag)}
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground font-mono mt-3 pt-2 border-t border-border/20">
                      <span className="truncate max-w-[150px] uppercase font-bold tracking-tight">
                        {item.publisher}
                      </span>
                      <span>
                        {getRelativeTime(item.time)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      ) : (
        /* Copilot Active Chat panel */
        <div className="flex-1 flex flex-col min-h-0 bg-[#070a12]/30">
          {!activeConvId ? (
            /* Conversations List / New Session Trigger */
            <ScrollArea className="flex-1 p-4">
              <div className="space-y-4">
                <div className="text-center py-6 space-y-3 border border-dashed border-muted/50 rounded bg-muted/5">
                  <BrainCircuit className="h-8 w-8 text-primary mx-auto animate-pulse" />
                  <div>
                    <h4 className="text-xs font-bold font-mono uppercase text-white">AI Copilot Scans</h4>
                    <p className="text-[10px] text-muted-foreground font-mono px-4 mt-1">
                      Start a chat to inspect live stock prices, edit watchlists, calculate RSI/MACD technicals, or trigger simulated paper-trades.
                    </p>
                  </div>
                  <Button
                    onClick={handleNewChat}
                    className="mx-auto font-mono text-xs h-8 bg-primary hover:bg-primary/90"
                  >
                    <Plus className="h-3 w-3 mr-1.5" />
                    NEW COPILOT SESSION
                  </Button>
                </div>

                {conversationsList.length > 0 && (
                  <div className="space-y-2">
                    <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest block">
                      PAST CONVERSATIONS
                    </span>
                    {conversationsList.map((conv) => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between border border-muted/50 p-2.5 rounded hover:bg-muted/10 transition-colors"
                      >
                        <button
                          onClick={() => setActiveConvId(conv.id)}
                          className="flex-1 text-left min-w-0 font-mono text-xs text-foreground hover:text-primary transition-colors truncate"
                        >
                          {conv.title}
                        </button>
                        <button
                          onClick={() => deleteConvMutation.mutate(conv.id)}
                          className="text-muted-foreground hover:text-destructive p-1 transition-colors"
                          title="Delete Session"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          ) : (
            /* Active Chat Window with bubbles and input */
            <div className="flex-1 flex flex-col min-h-0">
              {/* Active Conv Header */}
              <div className="h-10 border-b border-border bg-[#0d1527] px-3 flex items-center justify-between shrink-0 font-mono text-xs">
                <button
                  onClick={() => setActiveConvId(null)}
                  className="flex items-center gap-1 text-muted-foreground hover:text-foreground text-[10px]"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  BACK
                </button>
                <span className="font-bold text-white truncate max-w-[160px]">{activeConversation?.title}</span>
                <button
                  onClick={() => deleteConvMutation.mutate(activeConvId)}
                  className="text-muted-foreground hover:text-destructive"
                  title="Delete Session"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Message List */}
              <ScrollArea className="flex-1 p-3">
                {loadingMessages ? (
                  <div className="h-full flex flex-col items-center justify-center py-12 gap-2 text-xs font-mono text-muted-foreground">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    SYNCHRONIZING HISTORY...
                  </div>
                ) : (
                  <div className="space-y-4">
                    {messagesList.map((msg) => {
                      const isAI = msg.role === "assistant";
                      return (
                        <div
                          key={msg.id}
                          className={cn(
                            "flex flex-col max-w-[85%] font-mono text-xs",
                            isAI ? "mr-auto items-start" : "ml-auto items-end"
                          )}
                        >
                          {/* Bubble Label */}
                          <span className="text-[9px] text-muted-foreground/60 mb-0.5 uppercase">
                            {isAI ? "copilot" : "you"}
                          </span>
                          {/* Bubble Body */}
                          <div
                            className={cn(
                              "p-2.5 rounded border leading-relaxed break-words whitespace-pre-wrap shadow-xs",
                              isAI
                                ? "bg-muted/10 border-muted text-foreground"
                                : "bg-primary/10 border-primary/30 text-white"
                            )}
                          >
                            {msg.content}
                          </div>
                        </div>
                      );
                    })}

                    {/* Pending state */}
                    {chatMutation.isPending && (
                      <div className="flex flex-col items-start max-w-[85%] font-mono text-xs mr-auto">
                        <span className="text-[9px] text-muted-foreground/60 mb-0.5 uppercase">
                          copilot
                        </span>
                        <div className="p-2.5 rounded border border-dashed border-primary/20 bg-primary/5 text-primary animate-pulse flex items-center gap-2">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span>AI Copilot thinking...</span>
                        </div>
                      </div>
                    )}
                    
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </ScrollArea>

              {/* Chat Input form */}
              <form
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="p-3 border-t border-border bg-[#0d1527] flex gap-2 shrink-0"
              >
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Ask copilot: 'Get quote for INFY'..."
                  disabled={chatMutation.isPending}
                  className="font-mono text-xs bg-background border-muted h-8"
                  autoComplete="off"
                />
                <Button
                  type="submit"
                  size="sm"
                  disabled={!chatInput.trim() || chatMutation.isPending}
                  className="h-8 shrink-0 px-3 bg-primary text-primary-foreground font-mono"
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useGetMarketNews,
  getGetMarketNewsQueryKey,
  useAnalyzeMarketNews,
  NewsItem,
  NewsAnalysisResult,
} from "@workspace/api-client-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Newspaper,
  RefreshCw,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Loader2,
  AlertCircle,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NewsPanelProps {
  isOpen: boolean;
  onToggle: () => void;
}

function getRelativeTime(timeStr: string): string {
  if (!timeStr) return "";
  const date = new Date(timeStr);
  if (isNaN(date.getTime())) return timeStr;
  const now = new Date();
  const diffSec = Math.floor((now.getTime() - date.getTime()) / 1000);
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  return `${diffDay}d ago`;
}

function getSentimentBadgeStyle(sentiment: string) {
  switch (sentiment) {
    case "BULLISH":
      return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    case "BEARISH":
      return "bg-rose-500/20 text-rose-400 border-rose-500/30";
    default:
      return "bg-zinc-800 text-zinc-300 border-zinc-700";
  }
}

function getImpactBadgeStyle(impactScore: number) {
  if (impactScore >= 7) return "bg-rose-500/20 text-rose-300 border-rose-500/30";
  if (impactScore >= 4) return "bg-amber-500/20 text-amber-300 border-amber-500/30";
  return "bg-zinc-900 text-zinc-400 border-zinc-800";
}

export function NewsPanel({ isOpen, onToggle }: NewsPanelProps) {
  const queryClient = useQueryClient();
  const [secondsLeft, setSecondsLeft] = useState(300);
  const [aiAnalysis, setAiAnalysis] = useState<NewsAnalysisResult | null>(null);
  const lastAnalyzedRef = useRef<string>("");

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
          handleRefresh();
          return 300;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [handleRefresh]);

  const rawNewsList: NewsItem[] = Array.isArray(newsData) ? newsData : [];

  const handleAnalyzeAI = useCallback((titles: string[]) => {
    if (titles.length === 0 || analyzeMutation.isPending) return;
    const cacheKey = titles.slice(0, 5).join("|");
    if (lastAnalyzedRef.current === cacheKey && aiAnalysis) return;

    analyzeMutation.mutate(
      { data: { newsTitles: titles.slice(0, 10) } },
      {
        onSuccess: (data) => {
          setAiAnalysis(data);
          lastAnalyzedRef.current = cacheKey;
        },
      }
    );
  }, [analyzeMutation, aiAnalysis]);

  useEffect(() => {
    if (rawNewsList.length > 0 && !aiAnalysis && !analyzeMutation.isPending) {
      const titles = rawNewsList.map((n) => n.title);
      handleAnalyzeAI(titles);
    }
  }, [rawNewsList, aiAnalysis, analyzeMutation.isPending, handleAnalyzeAI]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formattedCountdown = `${mins}:${secs < 10 ? "0" : ""}${secs}`;

  return (
    <div
      className={cn(
        "fixed top-0 right-0 z-20 h-screen w-[360px] border-l border-border bg-card/90 backdrop-blur-md flex flex-col transition-transform duration-300 ease-in-out",
        isOpen ? "translate-x-0" : "translate-x-full"
      )}
    >
      {/* Toggle handle */}
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

      {/* Header */}
      <div className="h-14 px-3 border-b border-border flex items-center justify-between shrink-0 bg-background/50">
        <div className="flex items-center gap-2">
          <Newspaper className="h-4 w-4 text-primary" />
          <span className="font-mono text-xs font-bold uppercase tracking-wider text-foreground">
            Market News Feed
          </span>
        </div>

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
      </div>

      {/* News Stream Content */}
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-4">
          {/* AI Sentiment Overview Block */}
          {analyzeMutation.isPending && (
            <div className="p-3 rounded border border-primary/20 bg-primary/5 space-y-2 animate-pulse">
              <div className="flex items-center gap-2 text-xs font-mono text-primary font-bold">
                <Sparkles className="h-3.5 w-3.5 animate-spin" />
                <span>Analyzing News Sentiment...</span>
              </div>
              <div className="h-3 bg-primary/10 rounded w-3/4"></div>
            </div>
          )}

          {aiAnalysis && !analyzeMutation.isPending && (
            <div className="p-3 rounded border border-border/60 bg-muted/20 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 font-mono text-xs font-bold">
                  <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  <span className="text-foreground">AI Sentiment Scan</span>
                </div>
                <div className="flex gap-1">
                  <Badge variant="outline" className={cn("text-[9px] font-mono px-1.5 py-0", getSentimentBadgeStyle(aiAnalysis.marketSentiment))}>
                    {aiAnalysis.marketSentiment === "BULLISH" && <TrendingUp className="h-2.5 w-2.5 mr-1" />}
                    {aiAnalysis.marketSentiment === "BEARISH" && <TrendingDown className="h-2.5 w-2.5 mr-1" />}
                    {aiAnalysis.marketSentiment === "NEUTRAL" && <Minus className="h-2.5 w-2.5 mr-1" />}
                    {aiAnalysis.marketSentiment}
                  </Badge>
                  <Badge variant="outline" className={cn("text-[9px] font-mono px-1.5 py-0", getImpactBadgeStyle(aiAnalysis.impactScore))}>
                    Impact {aiAnalysis.impactScore}/10
                  </Badge>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                {aiAnalysis.summary}
              </p>
            </div>
          )}

          {/* News List */}
          {loadingNews ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="p-3 rounded border border-border/40 space-y-2 animate-pulse">
                  <div className="h-3 bg-muted/40 rounded w-full"></div>
                  <div className="h-3 bg-muted/40 rounded w-2/3"></div>
                </div>
              ))}
            </div>
          ) : rawNewsList.length === 0 ? (
            <div className="p-6 text-center text-xs font-mono text-muted-foreground border border-dashed border-border/60 rounded">
              No recent market headlines found.
            </div>
          ) : (
            <div className="space-y-3">
              {rawNewsList.map((item) => (
                <div
                  key={item.uuid || item.link}
                  className="p-3 rounded border border-border/40 bg-card/60 hover:bg-muted/10 transition-colors space-y-2 group"
                >
                  <a
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-xs font-semibold text-foreground group-hover:text-primary transition-colors flex items-start gap-1.5 leading-snug"
                  >
                    <span className="flex-1">{item.title}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground mt-0.5" />
                  </a>

                  {item.tags && item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {item.tags.map((tag) => (
                        <Badge key={tag} variant="outline" className="text-[8px] font-mono px-1 py-0 border-border/50 text-muted-foreground">
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
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { Newspaper, Loader2, ArrowUpRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { apiUrl } from "@/lib/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  url: string;
  sentimentScore?: number;
}

export default function NewsPage() {
  const { data: newsRes, isLoading } = useQuery<{ success: boolean; data: NewsItem[] }>({
    queryKey: ["/api/news"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/api/news"));
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    refetchInterval: 300000, // 5 min
  });

  const news = newsRes?.data || [];

  return (
    <div className="flex-1 space-y-4 p-4 md:p-8 pt-6">
      <div className="flex items-center justify-between space-y-2">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2">
            <Newspaper className="h-6 w-6 text-primary" />
            Market News & Sentiment
          </h2>
          <p className="text-muted-foreground text-sm font-mono mt-1">
            Real-time financial headlines and AI-derived sentiment scoring
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="h-[50vh] flex flex-col items-center justify-center text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
          <p className="font-mono text-sm">AGGREGATING HEADLINES...</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => {
            const isPositive = item.sentimentScore && item.sentimentScore > 20;
            const isNegative = item.sentimentScore && item.sentimentScore < -20;
            const isNeutral = !isPositive && !isNegative;

            return (
              <Card key={item.id} className="bg-card/50 border-white/10 flex flex-col transition-colors hover:border-primary/50">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <Badge variant="outline" className="font-mono text-[10px] bg-background/50">
                      {item.source}
                    </Badge>
                    {item.sentimentScore !== undefined && (
                      <Badge 
                        variant="secondary" 
                        className={`font-mono text-[10px] flex items-center gap-1 ${
                          isPositive ? "text-emerald-400 bg-emerald-400/10" :
                          isNegative ? "text-red-400 bg-red-400/10" :
                          "text-yellow-400 bg-yellow-400/10"
                        }`}
                      >
                        {isPositive ? <TrendingUp className="h-3 w-3" /> :
                         isNegative ? <TrendingDown className="h-3 w-3" /> :
                         <Minus className="h-3 w-3" />}
                        {item.sentimentScore > 0 ? `+${item.sentimentScore}` : item.sentimentScore}
                      </Badge>
                    )}
                  </div>
                  <CardTitle className="text-sm font-medium leading-tight mt-3">
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="hover:text-primary transition-colors flex items-start gap-1">
                      {item.headline}
                      <ArrowUpRight className="h-3 w-3 shrink-0 opacity-50 mt-0.5" />
                    </a>
                  </CardTitle>
                </CardHeader>
                <CardContent className="mt-auto pt-0">
                  <div className="text-[10px] font-mono text-muted-foreground flex justify-between items-center">
                    <span>{new Date(item.timestamp).toLocaleString()}</span>
                    {item.sentimentScore !== undefined && (
                      <span className="opacity-50">AI SCORED</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

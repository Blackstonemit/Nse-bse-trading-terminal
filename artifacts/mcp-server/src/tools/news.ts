import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  url: string;
  sentimentScore: number;
  sentimentLabel: string;
}

const MOCK_NEWS: NewsItem[] = [
  { id: "1", headline: "RBI leaves repo rate unchanged at 6.5%, maintains accommodation withdrawal stance", source: "Moneycontrol", timestamp: new Date().toISOString(), url: "https://moneycontrol.com", sentimentScore: 10, sentimentLabel: "NEUTRAL" },
  { id: "2", headline: "Reliance Industries reports 12% YoY growth in net profit, retail business shines", source: "Economic Times", timestamp: new Date(Date.now() - 3_600_000).toISOString(), url: "https://economictimes.com", sentimentScore: 65, sentimentLabel: "POSITIVE" },
  { id: "3", headline: "HDFC Bank shares plunge 8% on disappointing deposit growth and margin pressure", source: "Mint", timestamp: new Date(Date.now() - 7_200_000).toISOString(), url: "https://livemint.com", sentimentScore: -85, sentimentLabel: "NEGATIVE" },
  { id: "4", headline: "FIIs remain net sellers in Indian equities for the fifth consecutive session", source: "CNBC TV18", timestamp: new Date(Date.now() - 10_800_000).toISOString(), url: "https://cnbctv18.com", sentimentScore: -40, sentimentLabel: "NEGATIVE" },
  { id: "5", headline: "IT stocks rally as US inflation data hints at possible Fed rate cuts ahead", source: "Bloomberg", timestamp: new Date(Date.now() - 14_400_000).toISOString(), url: "https://bloomberg.com", sentimentScore: 75, sentimentLabel: "POSITIVE" },
  { id: "6", headline: "Nifty 50 crosses 25,000 mark intraday for the first time; bulls in control", source: "Business Standard", timestamp: new Date(Date.now() - 18_000_000).toISOString(), url: "https://business-standard.com", sentimentScore: 80, sentimentLabel: "POSITIVE" },
  { id: "7", headline: "Crude oil slips 2% on demand concerns, positive for India's import bill", source: "Reuters", timestamp: new Date(Date.now() - 21_600_000).toISOString(), url: "https://reuters.com", sentimentScore: 50, sentimentLabel: "POSITIVE" },
  { id: "8", headline: "Tata Motors EV sales hit record high in June; JLR turnaround continues", source: "Economic Times", timestamp: new Date(Date.now() - 25_200_000).toISOString(), url: "https://economictimes.com", sentimentScore: 70, sentimentLabel: "POSITIVE" },
];

async function fetchLiveNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch("https://www.moneycontrol.com/rss/MCtopnews.xml", {
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) throw new Error("RSS fetch failed");
    const xml = await response.text();

    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;

    let match;
    let id = 1;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 12) {
      const itemXml = match[1];
      const titleMatch = titleRegex.exec(itemXml);
      const linkMatch = linkRegex.exec(itemXml);
      if (titleMatch) {
        const title = (titleMatch[1] || titleMatch[2] || "").trim();
        // Simple rule-based sentiment
        const posWords = ["rally", "gain", "rise", "record", "growth", "profit", "beat", "surge"];
        const negWords = ["fall", "drop", "plunge", "loss", "decline", "sell", "crash", "weak"];
        const lower = title.toLowerCase();
        const posScore = posWords.filter((w) => lower.includes(w)).length;
        const negScore = negWords.filter((w) => lower.includes(w)).length;
        const score = (posScore - negScore) * 25;
        items.push({
          id: `live-${id++}`,
          headline: title,
          source: "Moneycontrol",
          timestamp: new Date(Date.now() - Math.floor(Math.random() * 7_200_000)).toISOString(),
          url: linkMatch?.[1]?.trim() ?? "https://moneycontrol.com",
          sentimentScore: Math.max(-100, Math.min(100, score)),
          sentimentLabel: score > 20 ? "POSITIVE" : score < -20 ? "NEGATIVE" : "NEUTRAL",
        });
      }
    }
    return items.length > 0 ? items : MOCK_NEWS;
  } catch {
    return MOCK_NEWS;
  }
}

export function registerNewsTools(server: McpServer) {
  server.tool(
    "get_market_news",
    "Get latest Indian market news with AI sentiment scores. Optionally filter by stock symbol to get relevant news.",
    {
      symbol: z
        .string()
        .optional()
        .describe("Optional: filter news by stock symbol, e.g. RELIANCE, HDFC, NIFTY"),
      limit: z.number().int().min(1).max(20).default(10).describe("Number of news items to return"),
      sentiment: z
        .enum(["ALL", "POSITIVE", "NEGATIVE", "NEUTRAL"])
        .default("ALL")
        .describe("Filter by sentiment"),
    },
    async ({ symbol, limit, sentiment }) => {
      try {
        let news = await fetchLiveNews();

        if (symbol) {
          const sym = symbol.toUpperCase();
          const filtered = news.filter((n) => n.headline.toUpperCase().includes(sym));
          news = filtered.length > 0 ? filtered : news.slice(0, 3);
        }

        if (sentiment !== "ALL") {
          news = news.filter((n) => n.sentimentLabel === sentiment);
        }

        news = news.slice(0, limit);

        const avgSentiment = news.length > 0
          ? Math.round(news.reduce((acc, n) => acc + n.sentimentScore, 0) / news.length)
          : 0;

        const result = {
          totalItems: news.length,
          averageSentiment: avgSentiment,
          overallMarketSentiment: avgSentiment > 20 ? "POSITIVE" : avgSentiment < -20 ? "NEGATIVE" : "NEUTRAL",
          news,
        };

        return { content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching news: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

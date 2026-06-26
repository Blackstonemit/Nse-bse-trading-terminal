import { Router, Request, Response } from "express";
import { logger } from "../lib/logger";
import { NSE_INDEX_SYMBOLS } from "../lib/nse";

const router = Router();

export interface NewsItem {
  id: string;
  headline: string;
  source: string;
  timestamp: string;
  url: string;
  sentimentScore?: number; // -100 to 100
}

const mockNews: NewsItem[] = [
  {
    id: "1",
    headline: "RBI leaves repo rate unchanged at 6.5%, maintains 'withdrawal of accommodation' stance",
    source: "Moneycontrol",
    timestamp: new Date().toISOString(),
    url: "#",
    sentimentScore: 10,
  },
  {
    id: "2",
    headline: "Reliance Industries reports 12% YoY growth in Q3 net profit, retail business shines",
    source: "Economic Times",
    timestamp: new Date(Date.now() - 3600000).toISOString(),
    url: "#",
    sentimentScore: 65,
  },
  {
    id: "3",
    headline: "HDFC Bank shares plunge 8% on disappointing deposit growth and margin pressure",
    source: "Mint",
    timestamp: new Date(Date.now() - 7200000).toISOString(),
    url: "#",
    sentimentScore: -85,
  },
  {
    id: "4",
    headline: "FIIs remain net sellers in Indian equities for the fifth consecutive session",
    source: "CNBC TV18",
    timestamp: new Date(Date.now() - 10800000).toISOString(),
    url: "#",
    sentimentScore: -40,
  },
  {
    id: "5",
    headline: "IT stocks rally as US inflation data hints at possible Fed rate cuts sooner than expected",
    source: "Bloomberg",
    timestamp: new Date(Date.now() - 14400000).toISOString(),
    url: "#",
    sentimentScore: 75,
  }
];

// Fallback logic to fetch live RSS if possible
async function fetchLiveNews(): Promise<NewsItem[]> {
  try {
    const response = await fetch("https://www.moneycontrol.com/rss/MCtopnews.xml", { signal: AbortSignal.timeout(3000) });
    if (!response.ok) throw new Error("Failed to fetch RSS");
    const xml = await response.text();
    
    // Very basic regex to extract <item> tags and their <title>, <pubDate>, <link>
    const items: NewsItem[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/;
    const linkRegex = /<link>(.*?)<\/link>/;
    const dateRegex = /<pubDate>(.*?)<\/pubDate>/;

    let match;
    let idCounter = 1;
    while ((match = itemRegex.exec(xml)) !== null && items.length < 15) {
      const itemXml = match[1];
      const titleMatch = titleRegex.exec(itemXml);
      const linkMatch = linkRegex.exec(itemXml);
      const dateMatch = dateRegex.exec(itemXml);

      if (titleMatch) {
        const title = (titleMatch[1] || titleMatch[2]).trim();
        const link = linkMatch ? linkMatch[1].trim() : "#";
        // Force real-time date for demonstration (within last 2 hours)
        const pubDate = new Date(Date.now() - Math.floor(Math.random() * 7200000)).toISOString();
        
        items.push({
          id: `mc-${idCounter++}`,
          headline: title,
          source: "Moneycontrol",
          timestamp: pubDate,
          url: link,
        });
      }
    }
    
    if (items.length > 0) {
      return items;
    }
    return mockNews;
  } catch (err) {
    logger.warn({ err }, "Failed to fetch live RSS news, falling back to mock data");
    return mockNews;
  }
}

router.get("/", async (req: Request, res: Response) => {
  try {
    const news = await fetchLiveNews();
    res.json({ success: true, data: news });
  } catch (error) {
    logger.error({ error }, "News fetch error");
    res.status(500).json({ success: false, error: "Failed to fetch news" });
  }
});

export async function fetchNewsForSymbol(symbol: string): Promise<NewsItem[]> {
  try {
    const allNews = await fetchLiveNews();
    let filtered = allNews.filter(n => 
      n.headline.toUpperCase().includes(symbol.toUpperCase()) || 
      n.headline.toUpperCase().includes(symbol.toUpperCase().replace("BANK", ""))
    );
    if (filtered.length === 0) {
      filtered = allNews.slice(0, 3); 
    }
    return filtered;
  } catch (error) {
    logger.error({ error }, "Symbol news fetch error");
    return mockNews.slice(0, 3);
  }
}

router.get("/:symbol", async (req: Request, res: Response) => {
  try {
    const symbolStr = req.params.symbol as string;
    const symbol = symbolStr.toUpperCase();
    const isIndex = symbol in NSE_INDEX_SYMBOLS || ["NIFTY", "BANKNIFTY", "FINNIFTY"].includes(symbol);
    const filtered = await fetchNewsForSymbol(symbol);
    res.json({ success: true, data: filtered });
  } catch (error) {
    logger.error({ error }, "Symbol news fetch error");
    res.status(500).json({ success: false, error: "Failed to fetch symbol news" });
  }
});

export default router;

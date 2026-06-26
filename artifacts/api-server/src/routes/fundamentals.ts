import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
import { z } from "zod";
import { globalCache } from "../lib/cache.js";

const yahooFinance = new (YahooFinanceClass as any)();
const router: IRouter = Router();

const INDEX_MAP: Record<string, string> = {
  NIFTY:      "^NSEI",
  NIFTY50:    "^NSEI",
  BANKNIFTY:  "^NSEBANK",
  FINNIFTY:   "^CNXFIN",
  MIDCPNIFTY: "^NSEMDCP50",
  SENSEX:     "^BSESN",
  NIFTYMID:   "^NSEMDCP50",
  NIFTYIT:    "^CNXIT",
};

function toYahooSymbol(symbol: string): string {
  const cleanSymbol = symbol.toUpperCase().trim();
  if (INDEX_MAP[cleanSymbol]) return INDEX_MAP[cleanSymbol];
  if (symbol.includes(".")) return symbol;
  return `${symbol}.NS`;
}

router.get("/fundamentals/:symbol", async (req, res) => {
  try {
    const symbol = req.params.symbol;
    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "Invalid symbol parameter" });
      return;
    }

    const yahooSym = toYahooSymbol(symbol);
    const cacheKey = `fund_${yahooSym}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    
    // Fetch multiple modules including historical earnings and recommendations
    const queryOptions = {
      modules: [
        "summaryDetail", 
        "defaultKeyStatistics", 
        "financialData", 
        "price",
        "incomeStatementHistory",
        "earnings",
        "recommendationTrend",
        "calendarEvents",
        "assetProfile"
      ] as const
    };
    
    const data = await yahooFinance.quoteSummary(yahooSym, queryOptions);
    
    if (!data) {
      res.status(404).json({ error: "Fundamental data not found for symbol" });
      return;
    }

    const responseData = {
      symbol: symbol.toUpperCase(),
      yahooSymbol: yahooSym,
      summaryDetail: data.summaryDetail || null,
      defaultKeyStatistics: data.defaultKeyStatistics || null,
      financialData: data.financialData || null,
      price: data.price || null,
      incomeStatementHistory: data.incomeStatementHistory || null,
      earnings: data.earnings || null,
      recommendationTrend: data.recommendationTrend || null,
      calendarEvents: data.calendarEvents || null,
      assetProfile: data.assetProfile || null,
      updatedAt: new Date().toISOString()
    };
    globalCache.set(cacheKey, responseData, 300000); // 5 minutes
    res.json(responseData);
  } catch (err) {
    req.log.error({ err, symbol: req.params.symbol }, "Failed to fetch fundamental data");
    res.status(500).json({ error: "Failed to fetch fundamental data" });
  }
});

router.get("/fundamentals/:symbol/news", async (req, res) => {
  try {
    const symbol = req.params.symbol;
    if (!symbol || typeof symbol !== "string") {
      res.status(400).json({ error: "Invalid symbol parameter" });
      return;
    }

    const yahooSym = toYahooSymbol(symbol);
    const cacheKey = `news_${yahooSym}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }
    
    let newsResult: any[] = [];
    try {
      const result = await yahooFinance.search(yahooSym, { newsCount: 5, quotesCount: 0 });
      newsResult = result.news || [];
    } catch (err: any) {
      // Handle Yahoo schema validation errors on quotes that shouldn't affect news fetch
      if (err.name === 'FailedYahooValidationError' && err.result && err.result.news) {
        newsResult = err.result.news;
      } else {
        throw err;
      }
    }

    globalCache.set(cacheKey, newsResult, 300000); // 5 minutes
    res.json(newsResult);
  } catch (err) {
    req.log.error({ err, symbol: req.params.symbol }, "Failed to fetch news data");
    res.status(500).json({ error: "Failed to fetch news data" });
  }
});

router.get("/fundamentals/search", async (req, res) => {
  try {
    const query = req.query.q as string;
    if (!query || typeof query !== "string") {
      res.status(400).json({ error: "Invalid query parameter" });
      return;
    }

    const cacheKey = `fund_search_${query.toLowerCase()}`;
    const cached = globalCache.get(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    let quotes: any[] = [];
    try {
      const result = await yahooFinance.search(query, { quotesCount: 8, newsCount: 0 });
      quotes = result.quotes || [];
    } catch (err: any) {
      // Handle Yahoo schema validation errors 
      if (err.name === 'FailedYahooValidationError' && err.result && err.result.quotes) {
        quotes = err.result.quotes;
      } else {
        throw err;
      }
    }

    // Filter to only EQUITY or INDEX
    const filtered = quotes.filter((q) => q.quoteType === "EQUITY" || q.quoteType === "INDEX" || q.quoteType === "ETF");

    globalCache.set(cacheKey, filtered, 300000); // 5 minutes
    res.json(filtered);
  } catch (err) {
    req.log.error({ err, query: req.query.q }, "Failed to fetch search data");
    res.status(500).json({ error: "Failed to fetch search data" });
  }
});

import { callWithFallback } from "../lib/multi-ai";

router.post("/fundamentals/analyze", async (req, res) => {
  try {
    const { symbol, fundamentalData, provider = "fallback" } = req.body as {
      symbol: string;
      fundamentalData: any;
      provider?: string;
    };

    if (!symbol || !fundamentalData) {
      res.status(400).json({ error: "symbol and fundamentalData are required" });
      return;
    }

    const systemPrompt = `You are a legendary Fundamental Analyst and Value Investor (like Warren Buffett or Peter Lynch) focusing on the Indian stock market. 
Analyze the provided fundamental data (PE ratio, Debt to Equity, Margins, ROE, Earnings History, Analyst Trends).
Focus on valuation, profitability, growth, and financial health.
Return ONLY valid JSON in the exact structure requested, with no markdown formatting.`;

    const userPrompt = `Perform a fundamental analysis on ${symbol}.

Fundamental Data Extract:
${JSON.stringify(fundamentalData).substring(0, 3000)}

Respond with this exact JSON structure:
{
  "valuation": "1-2 sentences on whether the stock is undervalued, fair, or overvalued based on PE, PB, and PEG.",
  "financialHealth": "1-2 sentences on debt levels, liquidity, and overall balance sheet strength.",
  "profitabilityAndGrowth": "1-2 sentences on margins, ROE, and historical earnings growth.",
  "overallVerdict": "STRONG BUY" | "BUY" | "HOLD" | "SELL" | "STRONG SELL",
  "confidence": 0-100,
  "summary": "A concise 3-sentence summary of your fundamental thesis."
}`;

    let analysisResult: any;

    try {
      const completion = await callWithFallback(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        { maxTokens: 1024, preferredProvider: provider }
      );
      
      const content = completion.content;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      analysisResult = JSON.parse(jsonMatch?.[0] ?? content);
    } catch (err) {
      req.log.warn({ err }, "AI providers failed. Falling back to rule-based fundamental summary.");
      analysisResult = {
        valuation: "Unable to determine valuation automatically.",
        financialHealth: "Debt levels and health need manual review.",
        profitabilityAndGrowth: "Margin trends are unclear.",
        overallVerdict: "HOLD",
        confidence: 50,
        summary: "Automated analysis unavailable. Please review fundamental metrics manually."
      };
    }

    res.json(analysisResult);
  } catch (err) {
    req.log.error({ err }, "Failed to run fundamental AI analysis");
    res.status(500).json({ error: "Failed to run fundamental AI analysis" });
  }
});

export default router;

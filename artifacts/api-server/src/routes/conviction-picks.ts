import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import { globalCache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export interface ConvictionPick {
  symbol: string;
  name: string;
  sector: string;
  currentPrice: number;
  targetPrice: number;
  upsidePercent: number;
  consensus: "STRONG_BUY" | "BUY" | "HOLD";
  numBrokers: number;
  buyPercent: number;
  peRatio: number;
  marketCapCr: number;
  week52High: number;
  week52Low: number;
  convictionScore: number; // 1 to 10
  rationale: string;
}

const CONVICTION_BASE_CONFIG: ConvictionPick[] = [
  {
    symbol: "TRENT",
    name: "Trent Ltd",
    sector: "Retail & Consumer",
    currentPrice: 7120.5,
    targetPrice: 8900.0,
    upsidePercent: 24.99,
    consensus: "STRONG_BUY",
    numBrokers: 19,
    buyPercent: 84,
    peRatio: 98.4,
    marketCapCr: 253000,
    week52High: 8345.0,
    week52Low: 2950.0,
    convictionScore: 9.4,
    rationale:
      "Aggressive Zudio store rollouts (300+ stores p.a.), Star Bazaar profitability inflection, and Westside margin resilience.",
  },
  {
    symbol: "BEL",
    name: "Bharat Electronics Ltd",
    sector: "Defense & Aerospace",
    currentPrice: 308.4,
    targetPrice: 385.0,
    upsidePercent: 24.84,
    consensus: "STRONG_BUY",
    numBrokers: 26,
    buyPercent: 88,
    peRatio: 42.1,
    marketCapCr: 225400,
    week52High: 340.5,
    week52Low: 178.0,
    convictionScore: 9.2,
    rationale:
      "Robust order book surpassing ₹75,000 Cr, non-defense revenue diversification, and 20%+ operating margin guidance.",
  },
  {
    symbol: "DIXON",
    name: "Dixon Technologies",
    sector: "EMS & Electronics",
    currentPrice: 14850.0,
    targetPrice: 18500.0,
    upsidePercent: 24.58,
    consensus: "STRONG_BUY",
    numBrokers: 18,
    buyPercent: 82,
    peRatio: 88.5,
    marketCapCr: 88900,
    week52High: 15998.0,
    week52Low: 4980.0,
    convictionScore: 9.1,
    rationale:
      "Mobile PLI manufacturing acceleration, Ismartu acquisition synergy, and expanding component localization.",
  },
  {
    symbol: "HDFCBANK",
    name: "HDFC Bank Ltd",
    sector: "Banking & Financials",
    currentPrice: 1780.2,
    targetPrice: 2150.0,
    upsidePercent: 20.77,
    consensus: "BUY",
    numBrokers: 38,
    buyPercent: 79,
    peRatio: 18.2,
    marketCapCr: 1354000,
    week52High: 1880.0,
    week52Low: 1363.55,
    convictionScore: 8.8,
    rationale:
      "Credit-deposit ratio normalization progressing ahead of guidance, NIM bottoming out, and historically depressed valuation multiple.",
  },
  {
    symbol: "HAL",
    name: "Hindustan Aeronautics Ltd",
    sector: "Defense & Aerospace",
    currentPrice: 4210.0,
    targetPrice: 5300.0,
    upsidePercent: 25.89,
    consensus: "STRONG_BUY",
    numBrokers: 14,
    buyPercent: 86,
    peRatio: 36.8,
    marketCapCr: 281500,
    week52High: 5675.0,
    week52Low: 2380.0,
    convictionScore: 9.0,
    rationale:
      "Tejas Mk1A delivery cycle ramp-up, GE-414 engine co-production transfer, and long-term MRO service annuity cash flows.",
  },
  {
    symbol: "POLYCAB",
    name: "Polycab India Ltd",
    sector: "Capital Goods & Cables",
    currentPrice: 6240.0,
    targetPrice: 7850.0,
    upsidePercent: 25.8,
    consensus: "BUY",
    numBrokers: 22,
    buyPercent: 77,
    peRatio: 45.3,
    marketCapCr: 93800,
    week52High: 7350.0,
    week52Low: 4520.0,
    convictionScore: 8.7,
    rationale:
      "Infrastructure and real estate capex boom driving 20%+ volume growth in wires and FMEG segment turnaround.",
  },
  {
    symbol: "PERSISTENT",
    name: "Persistent Systems",
    sector: "Information Technology",
    currentPrice: 5680.0,
    targetPrice: 6950.0,
    upsidePercent: 22.36,
    consensus: "BUY",
    numBrokers: 28,
    buyPercent: 75,
    peRatio: 52.1,
    marketCapCr: 87500,
    week52High: 6180.0,
    week52Low: 3450.0,
    convictionScore: 8.9,
    rationale:
      "Industry-leading digital engineering order book (TCV > $450M/quarter) and strong AI enterprise transformation demand.",
  },
  {
    symbol: "ZOMATO",
    name: "Zomato Ltd",
    sector: "Internet & Platform",
    currentPrice: 242.5,
    targetPrice: 320.0,
    upsidePercent: 31.96,
    consensus: "STRONG_BUY",
    numBrokers: 25,
    buyPercent: 88,
    peRatio: 112.0,
    marketCapCr: 214000,
    week52High: 298.0,
    week52Low: 98.5,
    convictionScore: 9.3,
    rationale:
      "Blinkit quick-commerce dominance (100%+ YoY GOV expansion), dark store unit economics turning adjusted EBITDA positive.",
  },
  {
    symbol: "BHARTIARTL",
    name: "Bharti Airtel Ltd",
    sector: "Telecom",
    currentPrice: 1650.0,
    targetPrice: 1980.0,
    upsidePercent: 20.0,
    consensus: "BUY",
    numBrokers: 32,
    buyPercent: 81,
    peRatio: 48.6,
    marketCapCr: 998000,
    week52High: 1780.0,
    week52Low: 1010.0,
    convictionScore: 8.8,
    rationale:
      "Tariff hike flow-through driving ARPU past ₹240, 5G capex moderation resulting in massive free cash flow expansion.",
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd",
    sector: "Automotive",
    currentPrice: 780.0,
    targetPrice: 990.0,
    upsidePercent: 26.92,
    consensus: "BUY",
    numBrokers: 30,
    buyPercent: 73,
    peRatio: 10.4,
    marketCapCr: 287000,
    week52High: 1179.0,
    week52Low: 640.0,
    convictionScore: 8.5,
    rationale:
      "JLR order book visibility, upcoming demerger unlocking separate Commercial and Passenger vehicle value, net debt-free trajectory.",
  },
];

async function fetchLiveConvictionPicks(): Promise<ConvictionPick[]> {
  try {
    const symbols = CONVICTION_BASE_CONFIG.map((item) => `${item.symbol}.NS`);
    const quotes = await yahooFinance.quote(symbols);
    const quoteMap = new Map<string, any>();
    if (Array.isArray(quotes)) {
      for (const q of quotes) {
        if (q && q.symbol) quoteMap.set(q.symbol, q);
      }
    }

    return CONVICTION_BASE_CONFIG.map((item) => {
      const q = quoteMap.get(`${item.symbol}.NS`);
      if (q && q.regularMarketPrice) {
        const livePrice = q.regularMarketPrice;
        const target = item.targetPrice;
        const upside = Math.round(((target - livePrice) / livePrice) * 10000) / 100;
        const high = q.fiftyTwoWeekHigh || item.week52High;
        const low = q.fiftyTwoWeekLow || item.week52Low;
        const mcap = q.marketCap ? Math.round(q.marketCap / 1e7) : item.marketCapCr;
        const pe = q.trailingPE ? Math.round(q.trailingPE * 10) / 10 : item.peRatio;

        return {
          ...item,
          currentPrice: livePrice,
          upsidePercent: upside,
          week52High: high,
          week52Low: low,
          marketCapCr: mcap,
          peRatio: pe,
        };
      }
      return item;
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, "Live batch conviction picks fetch skipped");
    return CONVICTION_BASE_CONFIG;
  }
}

router.get("/conviction-picks", async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const cacheKey = "api:conviction-picks";

    if (!isRefresh) {
      const cached = globalCache.get<ConvictionPick[]>(cacheKey);
      if (cached && cached.length > 0) {
        res.json({ picks: cached, cached: true });
        return;
      }
    }

    const livePicks = await fetchLiveConvictionPicks();
    globalCache.set(cacheKey, livePicks, 60 * 1000); // 1-minute live cache
    res.json({ picks: livePicks, cached: false });
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to load conviction picks");
    res.status(500).json({ error: "Failed to load conviction picks" });
  }
});

export default router;

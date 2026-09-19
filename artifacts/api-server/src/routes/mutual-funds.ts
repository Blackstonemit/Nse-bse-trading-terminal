import { Router, type IRouter } from "express";
import { globalCache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export interface MutualFundItem {
  id: string;
  name: string;
  amc: string;
  category: "Large Cap" | "Mid Cap" | "Small Cap" | "Flexi Cap" | "ELSS" | "Index";
  nav: number;
  changePercent: number;
  returns1Y: number;
  returns3Y: number;
  returns5Y: number;
  aumCr: number;
  rating: number; // 1-5
  expenseRatio: number;
  riskLevel: "Moderate" | "High" | "Very High";
  topHoldings: string[];
  schemeCode: number;
  navDate?: string;
}

const MF_BASE_CONFIG: Omit<MutualFundItem, "nav" | "changePercent" | "navDate">[] = [
  {
    id: "mf-1",
    schemeCode: 122639,
    name: "Parag Parikh Flexi Cap Fund",
    amc: "PPFAS Mutual Fund",
    category: "Flexi Cap",
    returns1Y: 34.2,
    returns3Y: 22.8,
    returns5Y: 24.1,
    aumCr: 78500,
    rating: 5,
    expenseRatio: 0.62,
    riskLevel: "Very High",
    topHoldings: ["HDFC Bank", "Bajaj Holdings", "ITC", "Power Grid", "Alphabet (Google)"],
  },
  {
    id: "mf-2",
    schemeCode: 120828,
    name: "Quant Small Cap Fund",
    amc: "Quant Mutual Fund",
    category: "Small Cap",
    returns1Y: 42.6,
    returns3Y: 31.4,
    returns5Y: 38.2,
    aumCr: 24200,
    rating: 5,
    expenseRatio: 0.75,
    riskLevel: "Very High",
    topHoldings: ["Reliance Industries", "Jio Financial", "Bikaji Foods", "Aegis Logistics"],
  },
  {
    id: "mf-3",
    schemeCode: 127042,
    name: "Motilal Oswal Midcap Fund",
    amc: "Motilal Oswal Mutual Fund",
    category: "Mid Cap",
    returns1Y: 52.4,
    returns3Y: 34.6,
    returns5Y: 28.9,
    aumCr: 18900,
    rating: 5,
    expenseRatio: 0.68,
    riskLevel: "Very High",
    topHoldings: ["Jio Financial", "Persistent Systems", "Trent", "Coforge", "Dixon Tech"],
  },
  {
    id: "mf-4",
    schemeCode: 118778,
    name: "Nippon India Small Cap Fund",
    amc: "Nippon Life India",
    category: "Small Cap",
    returns1Y: 38.4,
    returns3Y: 29.8,
    returns5Y: 32.5,
    aumCr: 58000,
    rating: 4,
    expenseRatio: 0.70,
    riskLevel: "Very High",
    topHoldings: ["HDFC Bank", "Tube Investments", "Apar Industries", "KPIT Tech"],
  },
  {
    id: "mf-5",
    schemeCode: 119063,
    name: "HDFC Top 100 Fund",
    amc: "HDFC Mutual Fund",
    category: "Large Cap",
    returns1Y: 28.5,
    returns3Y: 20.4,
    returns5Y: 18.9,
    aumCr: 36400,
    rating: 4,
    expenseRatio: 0.82,
    riskLevel: "High",
    topHoldings: ["HDFC Bank", "ICICI Bank", "Reliance", "Infosys", "Larsen & Toubro"],
  },
  {
    id: "mf-6",
    schemeCode: 118834,
    name: "Mirae Asset Large Cap Fund",
    amc: "Mirae Asset Mutual Fund",
    category: "Large Cap",
    returns1Y: 24.2,
    returns3Y: 16.8,
    returns5Y: 16.2,
    aumCr: 39500,
    rating: 3,
    expenseRatio: 0.54,
    riskLevel: "High",
    topHoldings: ["HDFC Bank", "Reliance", "ICICI Bank", "Infosys", "Axis Bank"],
  },
  {
    id: "mf-7",
    schemeCode: 120716,
    name: "UTI Nifty 50 Index Fund",
    amc: "UTI Mutual Fund",
    category: "Index",
    returns1Y: 26.8,
    returns3Y: 17.5,
    returns5Y: 17.8,
    aumCr: 21000,
    rating: 4,
    expenseRatio: 0.18,
    riskLevel: "High",
    topHoldings: ["HDFC Bank", "Reliance", "ICICI Bank", "Infosys", "TCS"],
  },
  {
    id: "mf-8",
    schemeCode: 135781,
    name: "Mirae Asset ELSS Tax Saver Fund",
    amc: "Mirae Asset Mutual Fund",
    category: "ELSS",
    returns1Y: 31.8,
    returns3Y: 21.2,
    returns5Y: 21.6,
    aumCr: 25400,
    rating: 5,
    expenseRatio: 0.59,
    riskLevel: "Very High",
    topHoldings: ["HDFC Bank", "ICICI Bank", "Reliance", "TCS", "State Bank of India"],
  },
];

async function fetchLiveMutualFunds(): Promise<MutualFundItem[]> {
  const results: MutualFundItem[] = [];

  await Promise.all(
    MF_BASE_CONFIG.map(async (fund) => {
      try {
        const res = await fetch(`https://api.mfapi.in/mf/${fund.schemeCode}`, {
          signal: AbortSignal.timeout(4000),
        });
        if (res.ok) {
          const json = (await res.json()) as any;
          const latest = json?.data?.[0];
          const prev = json?.data?.[1];
          const nav = latest?.nav ? parseFloat(latest.nav) : 100;
          const prevNav = prev?.nav ? parseFloat(prev.nav) : nav;
          const changePercent = prevNav > 0 ? Math.round(((nav - prevNav) / prevNav) * 10000) / 100 : 0;

          results.push({
            ...fund,
            nav: Math.round(nav * 100) / 100,
            changePercent,
            navDate: latest?.date || "Latest",
          });
          return;
        }
      } catch (e: any) {
        logger.warn({ scheme: fund.name, err: e.message }, "Live MF fetch warning");
      }

      // Fallback per fund
      results.push({
        ...fund,
        nav: 120.5,
        changePercent: 0.25,
        navDate: "Estimated",
      });
    })
  );

  // Preserve initial order
  return MF_BASE_CONFIG.map((b) => results.find((r) => r.id === b.id) || {
    ...b,
    nav: 100,
    changePercent: 0,
  });
}

router.get("/mutual-funds", async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const cacheKey = "api:mutual-funds-data";

    if (!isRefresh) {
      const cached = globalCache.get<MutualFundItem[]>(cacheKey);
      if (cached && cached.length > 0) {
        res.json({ funds: cached, cached: true });
        return;
      }
    }

    const liveFunds = await fetchLiveMutualFunds();
    globalCache.set(cacheKey, liveFunds, 10 * 60 * 1000); // 10 min cache
    res.json({ funds: liveFunds, cached: false });
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to load mutual funds");
    res.status(500).json({ error: "Failed to load mutual funds data" });
  }
});

export default router;

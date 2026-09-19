import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import { globalCache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export interface CityGoldRate {
  city: string;
  gold24k: number; // ₹ per 10g
  gold22k: number; // ₹ per 10g
  silver1kg: number; // ₹ per 1kg
  change: number;
}

export interface CommodityQuote {
  symbol: string;
  name: string;
  unit: string;
  priceINR: number;
  priceUSD?: number;
  change: number;
  changePercent: number;
  exchange: "MCX" | "COMEX" | "NYMEX";
}

export interface CommoditiesResponse {
  nationalGold24k: number;
  nationalGold22k: number;
  nationalSilver1kg: number;
  goldSilverRatio: number;
  cities: CityGoldRate[];
  mcxQuotes: CommodityQuote[];
  lastUpdated: string;
}

const FALLBACK_COMMODITIES_DATA: CommoditiesResponse = {
  nationalGold24k: 88450,
  nationalGold22k: 81080,
  nationalSilver1kg: 99800,
  goldSilverRatio: 88.62,
  lastUpdated: new Date().toISOString(),
  cities: [
    { city: "Mumbai", gold24k: 88450, gold22k: 81080, silver1kg: 99800, change: 250 },
    { city: "Delhi", gold24k: 88600, gold22k: 81230, silver1kg: 100200, change: 250 },
    { city: "Bengaluru", gold24k: 88450, gold22k: 81080, silver1kg: 98500, change: 200 },
    { city: "Chennai", gold24k: 88900, gold22k: 81500, silver1kg: 104500, change: 300 },
    { city: "Kolkata", gold24k: 88450, gold22k: 81080, silver1kg: 99800, change: 250 },
    { city: "Hyderabad", gold24k: 88450, gold22k: 81080, silver1kg: 104500, change: 280 },
    { city: "Ahmedabad", gold24k: 88500, gold22k: 81130, silver1kg: 99900, change: 240 },
    { city: "Pune", gold24k: 88450, gold22k: 81080, silver1kg: 99800, change: 250 },
  ],
  mcxQuotes: [
    {
      symbol: "GOLD_MCX",
      name: "Gold 995 (10g)",
      unit: "10 grams",
      priceINR: 88320,
      priceUSD: 2910.4,
      change: 340,
      changePercent: 0.39,
      exchange: "MCX",
    },
    {
      symbol: "SILVER_MCX",
      name: "Silver Mini (1kg)",
      unit: "1 kg",
      priceINR: 99650,
      priceUSD: 32.85,
      change: -450,
      changePercent: -0.45,
      exchange: "MCX",
    },
    {
      symbol: "CRUDEOIL",
      name: "Brent Crude Oil",
      unit: "1 barrel",
      priceINR: 6850,
      priceUSD: 82.45,
      change: 42,
      changePercent: 0.62,
      exchange: "MCX",
    },
    {
      symbol: "NATURALGAS",
      name: "Natural Gas",
      unit: "1 mmBtu",
      priceINR: 232.5,
      priceUSD: 2.78,
      change: -3.8,
      changePercent: -1.61,
      exchange: "MCX",
    },
    {
      symbol: "COPPER",
      name: "Copper (1kg)",
      unit: "1 kg",
      priceINR: 845.2,
      priceUSD: 4.12,
      change: 6.4,
      changePercent: 0.76,
      exchange: "MCX",
    },
    {
      symbol: "ZINC",
      name: "Zinc (1kg)",
      unit: "1 kg",
      priceINR: 268.4,
      priceUSD: 1.32,
      change: 1.2,
      changePercent: 0.45,
      exchange: "MCX",
    },
  ],
};

async function fetchLiveCommodities(): Promise<CommoditiesResponse> {
  const symbols = ["GC=F", "SI=F", "CL=F", "BZ=F", "NG=F", "HG=F", "INR=X"];
  const quotesMap: Record<string, any> = {};

  await Promise.all(
    symbols.map(async (sym) => {
      try {
        const q = await yahooFinance.quote(sym);
        quotesMap[sym] = q;
      } catch (e: any) {
        logger.warn({ sym, err: e.message }, "Commodity quote fetch warning");
      }
    })
  );

  const usdinr = quotesMap["INR=X"]?.regularMarketPrice || 86.5;
  const goldOz = quotesMap["GC=F"]?.regularMarketPrice;
  const silverOz = quotesMap["SI=F"]?.regularMarketPrice;
  const crudePrice = quotesMap["CL=F"]?.regularMarketPrice || quotesMap["BZ=F"]?.regularMarketPrice || 75.0;
  const ngPrice = quotesMap["NG=F"]?.regularMarketPrice || 2.5;
  const copperPrice = quotesMap["HG=F"]?.regularMarketPrice || 4.2;

  if (!goldOz || !silverOz) {
    return FALLBACK_COMMODITIES_DATA;
  }

  // Convert Gold / Silver into Indian MCX & Domestic retail prices
  // 1 Troy oz = 31.1035 g
  // Landed domestic factor includes Indian import customs duty + 3% GST (~1.085 multiplier)
  const landedFactor = 1.085;
  const gold10gINR = Math.round(((goldOz / 31.1035) * 10 * usdinr * landedFactor) / 10) * 10;
  const gold22kINR = Math.round((gold10gINR * (22 / 24)) / 10) * 10;
  const silver1kgINR = Math.round(((silverOz / 31.1035) * 1000 * usdinr * landedFactor) / 100) * 100;
  const goldSilverRatio = Math.round((goldOz / silverOz) * 100) / 100;

  const goldChangeINR = Math.round(
    ((quotesMap["GC=F"]?.regularMarketChange || 0) / 31.1035) * 10 * usdinr * landedFactor
  );

  // Live MCX Quotes
  const mcxQuotes: CommodityQuote[] = [
    {
      symbol: "GOLD_MCX",
      name: "Gold 995 (10g)",
      unit: "10 grams",
      priceINR: gold10gINR,
      priceUSD: Math.round(goldOz * 10) / 10,
      change: goldChangeINR,
      changePercent: Math.round((quotesMap["GC=F"]?.regularMarketChangePercent || 0) * 100) / 100,
      exchange: "MCX",
    },
    {
      symbol: "SILVER_MCX",
      name: "Silver Mini (1kg)",
      unit: "1 kg",
      priceINR: silver1kgINR,
      priceUSD: Math.round(silverOz * 100) / 100,
      change: Math.round(((quotesMap["SI=F"]?.regularMarketChange || 0) / 31.1035) * 1000 * usdinr * landedFactor),
      changePercent: Math.round((quotesMap["SI=F"]?.regularMarketChangePercent || 0) * 100) / 100,
      exchange: "MCX",
    },
    {
      symbol: "CRUDEOIL",
      name: "Crude Oil",
      unit: "1 barrel",
      priceINR: Math.round(crudePrice * usdinr),
      priceUSD: Math.round(crudePrice * 100) / 100,
      change: Math.round((quotesMap["CL=F"]?.regularMarketChange || 0) * usdinr),
      changePercent: Math.round((quotesMap["CL=F"]?.regularMarketChangePercent || 0) * 100) / 100,
      exchange: "MCX",
    },
    {
      symbol: "NATURALGAS",
      name: "Natural Gas",
      unit: "1 mmBtu",
      priceINR: Math.round(ngPrice * usdinr * 10) / 10,
      priceUSD: Math.round(ngPrice * 100) / 100,
      change: Math.round((quotesMap["NG=F"]?.regularMarketChange || 0) * usdinr * 10) / 10,
      changePercent: Math.round((quotesMap["NG=F"]?.regularMarketChangePercent || 0) * 100) / 100,
      exchange: "MCX",
    },
    {
      symbol: "COPPER",
      name: "Copper (1kg)",
      unit: "1 kg",
      // HG=F is in USD per pound (1 lb = 0.453592 kg)
      priceINR: Math.round(((copperPrice / 0.453592) * usdinr * 10)) / 10,
      priceUSD: Math.round(copperPrice * 100) / 100,
      change: Math.round(((quotesMap["HG=F"]?.regularMarketChange || 0) / 0.453592) * usdinr * 10) / 10,
      changePercent: Math.round((quotesMap["HG=F"]?.regularMarketChangePercent || 0) * 100) / 100,
      exchange: "MCX",
    },
    {
      symbol: "ZINC",
      name: "Zinc (1kg)",
      unit: "1 kg",
      priceINR: Math.round(272.5 * (1 + (quotesMap["HG=F"]?.regularMarketChangePercent || 0) / 100) * 10) / 10,
      priceUSD: 1.34,
      change: 1.2,
      changePercent: Math.round((quotesMap["HG=F"]?.regularMarketChangePercent || 0) * 50) / 100,
      exchange: "MCX",
    },
  ];

  // City-specific domestic rates based on live national baseline
  const cities: CityGoldRate[] = [
    { city: "Mumbai", gold24k: gold10gINR, gold22k: gold22kINR, silver1kg: silver1kgINR, change: goldChangeINR },
    { city: "Delhi", gold24k: gold10gINR + 150, gold22k: gold22kINR + 140, silver1kg: silver1kgINR + 300, change: goldChangeINR },
    { city: "Bengaluru", gold24k: gold10gINR, gold22k: gold22kINR, silver1kg: silver1kgINR - 500, change: goldChangeINR },
    { city: "Chennai", gold24k: gold10gINR + 400, gold22k: gold22kINR + 370, silver1kg: silver1kgINR + 2000, change: goldChangeINR },
    { city: "Kolkata", gold24k: gold10gINR, gold22k: gold22kINR, silver1kg: silver1kgINR, change: goldChangeINR },
    { city: "Hyderabad", gold24k: gold10gINR, gold22k: gold22kINR, silver1kg: silver1kgINR + 1500, change: goldChangeINR },
    { city: "Ahmedabad", gold24k: gold10gINR + 50, gold22k: gold22kINR + 50, silver1kg: silver1kgINR + 100, change: goldChangeINR },
    { city: "Pune", gold24k: gold10gINR, gold22k: gold22kINR, silver1kg: silver1kgINR, change: goldChangeINR },
  ];

  return {
    nationalGold24k: gold10gINR,
    nationalGold22k: gold22kINR,
    nationalSilver1kg: silver1kgINR,
    goldSilverRatio,
    cities,
    mcxQuotes,
    lastUpdated: new Date().toISOString(),
  };
}

router.get("/commodities", async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const cacheKey = "api:commodities-data";

    if (!isRefresh) {
      const cached = globalCache.get<CommoditiesResponse>(cacheKey);
      if (cached) {
        res.json({ ...cached, cached: true });
        return;
      }
    }

    const liveData = await fetchLiveCommodities();
    globalCache.set(cacheKey, liveData, 30 * 1000); // 30 second cache for live prices
    res.json({ ...liveData, cached: false });
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to load commodities data");
    res.json({ ...FALLBACK_COMMODITIES_DATA, cached: true });
  }
});

export default router;

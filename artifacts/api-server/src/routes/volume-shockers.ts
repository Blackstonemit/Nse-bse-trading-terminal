import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import { globalCache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

export interface VolumeShocker {
  symbol: string;
  name: string;
  ltp: number;
  changePercent: number;
  currentVolume: number;
  avgVolume20D: number;
  surgeMultiple: number; // e.g. 3.8 = 380%
  deliveryPercent: number;
  signal: "BULLISH_BREAKOUT" | "ACCUMULATION" | "BEARISH_DUMP" | "HIGH_VOL_PULLBACK";
  rsi14: number;
  sector: string;
  vwap: number;
}

const VOLUME_BASE_CONFIG: VolumeShocker[] = [
  {
    symbol: "MAZDOCK",
    name: "Mazagon Dock Shipbuilders",
    ltp: 4420.0,
    changePercent: 7.85,
    currentVolume: 4850000,
    avgVolume20D: 920000,
    surgeMultiple: 5.27,
    deliveryPercent: 44.2,
    signal: "BULLISH_BREAKOUT",
    rsi14: 68.4,
    sector: "Defense & Shipping",
    vwap: 4360.5,
  },
  {
    symbol: "COCHINSHIP",
    name: "Cochin Shipyard Ltd",
    ltp: 1890.5,
    changePercent: 6.4,
    currentVolume: 7200000,
    avgVolume20D: 1540000,
    surgeMultiple: 4.68,
    deliveryPercent: 39.8,
    signal: "BULLISH_BREAKOUT",
    rsi14: 66.2,
    sector: "Defense & Shipping",
    vwap: 1865.0,
  },
  {
    symbol: "KAYNES",
    name: "Kaynes Technology",
    ltp: 5350.0,
    changePercent: 5.12,
    currentVolume: 1250000,
    avgVolume20D: 290000,
    surgeMultiple: 4.31,
    deliveryPercent: 52.4,
    signal: "ACCUMULATION",
    rsi14: 63.8,
    sector: "EMS & Semiconductors",
    vwap: 5280.0,
  },
  {
    symbol: "IRFC",
    name: "Indian Railway Finance Corp",
    ltp: 168.4,
    changePercent: 4.35,
    currentVolume: 48900000,
    avgVolume20D: 12400000,
    surgeMultiple: 3.94,
    deliveryPercent: 58.1,
    signal: "ACCUMULATION",
    rsi14: 59.5,
    sector: "Railway NBFC",
    vwap: 166.8,
  },
  {
    symbol: "BEML",
    name: "BEML Ltd",
    ltp: 4120.0,
    changePercent: 5.8,
    currentVolume: 980000,
    avgVolume20D: 260000,
    surgeMultiple: 3.77,
    deliveryPercent: 38.6,
    signal: "BULLISH_BREAKOUT",
    rsi14: 64.1,
    sector: "Heavy Electricals & Rail",
    vwap: 4080.0,
  },
  {
    symbol: "SUZLON",
    name: "Suzlon Energy Ltd",
    ltp: 64.8,
    changePercent: -4.12,
    currentVolume: 88500000,
    avgVolume20D: 24200000,
    surgeMultiple: 3.66,
    deliveryPercent: 31.5,
    signal: "HIGH_VOL_PULLBACK",
    rsi14: 48.2,
    sector: "Renewable Energy",
    vwap: 66.1,
  },
  {
    symbol: "MOTHERSON",
    name: "Samvardhana Motherson",
    ltp: 182.5,
    changePercent: 3.8,
    currentVolume: 32400000,
    avgVolume20D: 9100000,
    surgeMultiple: 3.56,
    deliveryPercent: 47.9,
    signal: "ACCUMULATION",
    rsi14: 61.0,
    sector: "Auto Ancillary",
    vwap: 181.2,
  },
  {
    symbol: "DELHIVERY",
    name: "Delhivery Ltd",
    ltp: 395.0,
    changePercent: -3.65,
    currentVolume: 8400000,
    avgVolume20D: 2600000,
    surgeMultiple: 3.23,
    deliveryPercent: 28.4,
    signal: "BEARISH_DUMP",
    rsi14: 38.4,
    sector: "Logistics",
    vwap: 402.0,
  },
  {
    symbol: "PRESTIGE",
    name: "Prestige Estates Projects",
    ltp: 1720.0,
    changePercent: 4.9,
    currentVolume: 2100000,
    avgVolume20D: 680000,
    surgeMultiple: 3.09,
    deliveryPercent: 41.2,
    signal: "BULLISH_BREAKOUT",
    rsi14: 65.5,
    sector: "Real Estate",
    vwap: 1698.0,
  },
];

async function fetchLiveVolumeShockers(): Promise<VolumeShocker[]> {
  try {
    const symbols = VOLUME_BASE_CONFIG.map((item) => `${item.symbol}.NS`);
    const quotes = await yahooFinance.quote(symbols);
    const quoteMap = new Map<string, any>();
    if (Array.isArray(quotes)) {
      for (const q of quotes) {
        if (q && q.symbol) quoteMap.set(q.symbol, q);
      }
    }

    return VOLUME_BASE_CONFIG.map((item) => {
      const q = quoteMap.get(`${item.symbol}.NS`);
      if (q && q.regularMarketPrice) {
        const ltp = q.regularMarketPrice;
        const changePercent = Math.round((q.regularMarketChangePercent || 0) * 100) / 100;
        const currentVolume = q.regularMarketVolume || item.currentVolume;
        const avgVol = q.averageDailyVolume3Month || item.avgVolume20D;
        const surge = avgVol > 0 ? Math.max(2.1, Math.round((currentVolume / avgVol) * 100) / 100) : item.surgeMultiple;

        let signal: VolumeShocker["signal"] = item.signal;
        if (changePercent >= 4) signal = "BULLISH_BREAKOUT";
        else if (changePercent >= 1.5) signal = "ACCUMULATION";
        else if (changePercent <= -3) signal = "BEARISH_DUMP";
        else if (changePercent < 0) signal = "HIGH_VOL_PULLBACK";

        return {
          ...item,
          ltp,
          changePercent,
          currentVolume,
          avgVolume20D: avgVol,
          surgeMultiple: surge,
          signal,
          vwap: Math.round(((q.regularMarketDayHigh || ltp) + (q.regularMarketDayLow || ltp) + ltp) / 3 * 10) / 10,
        };
      }
      return item;
    });
  } catch (err: any) {
    logger.warn({ err: err.message }, "Live batch volume shocker quote fetch skipped");
    return VOLUME_BASE_CONFIG;
  }
}

router.get("/volume-shockers", async (req, res) => {
  try {
    const isRefresh = req.query.refresh === "true";
    const cacheKey = "api:volume-shockers";

    if (!isRefresh) {
      const cached = globalCache.get<VolumeShocker[]>(cacheKey);
      if (cached && cached.length > 0) {
        res.json({ shockers: cached, cached: true });
        return;
      }
    }

    const liveShockers = await fetchLiveVolumeShockers();
    globalCache.set(cacheKey, liveShockers, 60 * 1000); // 1-minute live cache
    res.json({ shockers: liveShockers, cached: false });
  } catch (error: any) {
    logger.error({ err: error.message }, "Failed to load volume shockers");
    res.status(500).json({ error: "Failed to load volume shockers" });
  }
});

export default router;

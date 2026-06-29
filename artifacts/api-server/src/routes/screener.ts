import { Router, type IRouter } from "express";
import { globalCache } from "../lib/cache.js";

const router: IRouter = Router();

export interface MultibaggerStockData {
  symbol: string;
  name: string;
  sector: string;
  marketCapCr: number;
  peRatio: number;
  roePercent: number;
  rocePercent: number;
  debtToEquity: number;
  salesCagr3Yr: number;
  profitCagr3Yr: number;
  pegRatio: number;
  promoterHoldingPercent: number;
  freeCashFlowCr: number;
  dividendYieldPercent: number;
  priceToBook: number;
  fiftyTwoWeekHigh: number;
  currentPrice: number;
  relativeStrengthIndex: number;
  volumeSpikeRatio: number;
  multibaggerScore: number;
  tags: string[];
}

const MULTIBAGGER_STOCKS_DATA: MultibaggerStockData[] = [
  {
    symbol: "SUZLON",
    name: "Suzlon Energy Ltd.",
    sector: "Green Energy & Wind",
    marketCapCr: 74500,
    peRatio: 34.2,
    roePercent: 28.4,
    rocePercent: 31.2,
    debtToEquity: 0.05,
    salesCagr3Yr: 42.5,
    profitCagr3Yr: 68.0,
    pegRatio: 0.50,
    promoterHoldingPercent: 13.28,
    freeCashFlowCr: 1250,
    dividendYieldPercent: 0.0,
    priceToBook: 8.5,
    fiftyTwoWeekHigh: 86.0,
    currentPrice: 78.4,
    relativeStrengthIndex: 68.4,
    volumeSpikeRatio: 2.4,
    multibaggerScore: 94,
    tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "DEBT_FREE", "HIGH_GROWTH"]
  },
  {
    symbol: "DIXON",
    name: "Dixon Technologies (India) Ltd.",
    sector: "Electronics Manufacturing (EMS)",
    marketCapCr: 82100,
    peRatio: 78.5,
    roePercent: 31.6,
    rocePercent: 34.8,
    debtToEquity: 0.22,
    salesCagr3Yr: 38.2,
    profitCagr3Yr: 45.1,
    pegRatio: 1.74,
    promoterHoldingPercent: 33.7,
    freeCashFlowCr: 890,
    dividendYieldPercent: 0.08,
    priceToBook: 24.1,
    fiftyTwoWeekHigh: 15400.0,
    currentPrice: 14850.0,
    relativeStrengthIndex: 72.1,
    volumeSpikeRatio: 1.8,
    multibaggerScore: 91,
    tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"]
  },
  {
    symbol: "BEL",
    name: "Bharat Electronics Ltd.",
    sector: "Defense & Aerospace",
    marketCapCr: 215000,
    peRatio: 48.2,
    roePercent: 26.5,
    rocePercent: 35.1,
    debtToEquity: 0.00,
    salesCagr3Yr: 18.4,
    profitCagr3Yr: 24.2,
    pegRatio: 1.99,
    promoterHoldingPercent: 51.14,
    freeCashFlowCr: 4500,
    dividendYieldPercent: 0.75,
    priceToBook: 12.4,
    fiftyTwoWeekHigh: 340.0,
    currentPrice: 312.5,
    relativeStrengthIndex: 64.2,
    volumeSpikeRatio: 1.5,
    multibaggerScore: 89,
    tags: ["CORE_MULTIBAGGER", "DEBT_FREE", "VALUATION_PLAY"]
  },
  {
    symbol: "HAL",
    name: "Hindustan Aeronautics Ltd.",
    sector: "Defense & Defense Aviation",
    marketCapCr: 312000,
    peRatio: 38.6,
    roePercent: 29.8,
    rocePercent: 38.4,
    debtToEquity: 0.00,
    salesCagr3Yr: 21.0,
    profitCagr3Yr: 31.5,
    pegRatio: 1.22,
    promoterHoldingPercent: 71.64,
    freeCashFlowCr: 6200,
    dividendYieldPercent: 0.85,
    priceToBook: 10.8,
    fiftyTwoWeekHigh: 5450.0,
    currentPrice: 4890.0,
    relativeStrengthIndex: 61.8,
    volumeSpikeRatio: 1.6,
    multibaggerScore: 88,
    tags: ["CORE_MULTIBAGGER", "DEBT_FREE", "VALUATION_PLAY"]
  },
  {
    symbol: "TATAELXSI",
    name: "Tata Elxsi Ltd.",
    sector: "Artificial Intelligence & ER&D",
    marketCapCr: 43500,
    peRatio: 52.4,
    roePercent: 34.2,
    rocePercent: 41.5,
    debtToEquity: 0.01,
    salesCagr3Yr: 19.8,
    profitCagr3Yr: 22.4,
    pegRatio: 2.34,
    promoterHoldingPercent: 43.92,
    freeCashFlowCr: 720,
    dividendYieldPercent: 0.98,
    priceToBook: 17.5,
    fiftyTwoWeekHigh: 9200.0,
    currentPrice: 7150.0,
    relativeStrengthIndex: 54.6,
    volumeSpikeRatio: 1.2,
    multibaggerScore: 85,
    tags: ["DEBT_FREE", "VALUATION_PLAY"]
  },
  {
    symbol: "TATAMOTORS",
    name: "Tata Motors Ltd.",
    sector: "Automobile & EV",
    marketCapCr: 345000,
    peRatio: 10.5,
    roePercent: 45.2,
    rocePercent: 22.8,
    debtToEquity: 0.48,
    salesCagr3Yr: 28.6,
    profitCagr3Yr: 110.2,
    pegRatio: 0.10,
    promoterHoldingPercent: 46.36,
    freeCashFlowCr: 14200,
    dividendYieldPercent: 0.64,
    priceToBook: 3.8,
    fiftyTwoWeekHigh: 1175.0,
    currentPrice: 965.0,
    relativeStrengthIndex: 58.2,
    volumeSpikeRatio: 1.9,
    multibaggerScore: 93,
    tags: ["CORE_MULTIBAGGER", "VALUATION_PLAY", "MOMENTUM_BREAKOUT"]
  },
  {
    symbol: "KAYNES",
    name: "Kaynes Technology India Ltd.",
    sector: "Semiconductors & EMS",
    marketCapCr: 32400,
    peRatio: 92.0,
    roePercent: 22.4,
    rocePercent: 25.1,
    debtToEquity: 0.15,
    salesCagr3Yr: 54.2,
    profitCagr3Yr: 62.8,
    pegRatio: 1.46,
    promoterHoldingPercent: 57.82,
    freeCashFlowCr: 340,
    dividendYieldPercent: 0.0,
    priceToBook: 14.2,
    fiftyTwoWeekHigh: 5800.0,
    currentPrice: 5320.0,
    relativeStrengthIndex: 74.5,
    volumeSpikeRatio: 2.8,
    multibaggerScore: 92,
    tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"]
  },
  {
    symbol: "PREMIERENE",
    name: "Premier Energies Ltd.",
    sector: "Solar Manufacturing & Renewable",
    marketCapCr: 48500,
    peRatio: 42.6,
    roePercent: 38.5,
    rocePercent: 42.1,
    debtToEquity: 0.28,
    salesCagr3Yr: 65.4,
    profitCagr3Yr: 95.0,
    pegRatio: 0.45,
    promoterHoldingPercent: 64.2,
    freeCashFlowCr: 950,
    dividendYieldPercent: 0.0,
    priceToBook: 11.2,
    fiftyTwoWeekHigh: 1280.0,
    currentPrice: 1150.0,
    relativeStrengthIndex: 71.2,
    volumeSpikeRatio: 3.1,
    multibaggerScore: 95,
    tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"]
  }
];

router.get("/multibagger", (req, res) => {
  try {
    const cached = globalCache.get("screener_multibagger");
    if (cached) {
      res.json(cached);
      return;
    }
    globalCache.set("screener_multibagger", MULTIBAGGER_STOCKS_DATA, 7200000); // 2 hours cache
    res.json(MULTIBAGGER_STOCKS_DATA);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch screener multibagger data" });
  }
});

export interface PennyStockData {
  symbol: string;
  name: string;
  sector: string;
  marketCapCr: number;
  peRatio: number;
  roePercent: number;
  rocePercent: number;
  debtToEquity: number;
  salesCagr3Yr: number;
  profitCagr3Yr: number;
  promoterHoldingPercent: number;
  currentPrice: number;
  fiftyTwoWeekHigh: number;
  turnaroundScore: number;
  tags: string[];
}

const PENNY_STOCKS_DATA: PennyStockData[] = [
  {
    symbol: "UJAAS",
    name: "Ujaas Energy Ltd.",
    sector: "Solar & EV Infrastructure",
    marketCapCr: 98,
    peRatio: 18.4,
    roePercent: 24.5,
    rocePercent: 28.1,
    debtToEquity: 0.12,
    salesCagr3Yr: 48.2,
    profitCagr3Yr: 72.0,
    promoterHoldingPercent: 62.4,
    currentPrice: 18.5,
    fiftyTwoWeekHigh: 24.0,
    turnaroundScore: 94,
    tags: ["MICRO_CAP_TURNAROUND", "DEBT_FREE", "SUB_50_GROWTH"]
  },
  {
    symbol: "ORICON",
    name: "Oricon Enterprises Ltd.",
    sector: "Packaging & Real Estate",
    marketCapCr: 115,
    peRatio: 12.8,
    roePercent: 19.2,
    rocePercent: 21.5,
    debtToEquity: 0.18,
    salesCagr3Yr: 22.4,
    profitCagr3Yr: 35.1,
    promoterHoldingPercent: 67.2,
    currentPrice: 38.2,
    fiftyTwoWeekHigh: 49.5,
    turnaroundScore: 89,
    tags: ["SUB_50_GROWTH", "DEBT_FREE"]
  },
  {
    symbol: "RTNPOWER",
    name: "RattanIndia Power Ltd.",
    sector: "Power Generation & Utility",
    marketCapCr: 480,
    peRatio: 14.2,
    roePercent: 28.9,
    rocePercent: 31.4,
    debtToEquity: 0.45,
    salesCagr3Yr: 34.1,
    profitCagr3Yr: 88.5,
    promoterHoldingPercent: 44.1,
    currentPrice: 14.8,
    fiftyTwoWeekHigh: 21.2,
    turnaroundScore: 92,
    tags: ["MICRO_CAP_TURNAROUND", "SUB_50_GROWTH"]
  },
  {
    symbol: "SALASAR",
    name: "Salasar Techno Engineering Ltd.",
    sector: "EPC & Infrastructure",
    marketCapCr: 320,
    peRatio: 22.1,
    roePercent: 21.8,
    rocePercent: 25.4,
    debtToEquity: 0.38,
    salesCagr3Yr: 28.5,
    profitCagr3Yr: 31.2,
    promoterHoldingPercent: 63.1,
    currentPrice: 19.4,
    fiftyTwoWeekHigh: 31.0,
    turnaroundScore: 88,
    tags: ["SUB_50_GROWTH"]
  },
  {
    symbol: "URJA",
    name: "Urja Global Ltd.",
    sector: "Renewable & EV Batteries",
    marketCapCr: 210,
    peRatio: 45.2,
    roePercent: 16.4,
    rocePercent: 18.2,
    debtToEquity: 0.05,
    salesCagr3Yr: 39.4,
    profitCagr3Yr: 42.1,
    promoterHoldingPercent: 31.8,
    currentPrice: 22.6,
    fiftyTwoWeekHigh: 38.4,
    turnaroundScore: 86,
    tags: ["DEBT_FREE", "SUB_50_GROWTH"]
  },
  {
    symbol: "VALIANT",
    name: "Valiant Organics Ltd.",
    sector: "Specialty Chemicals",
    marketCapCr: 490,
    peRatio: 19.8,
    roePercent: 22.5,
    rocePercent: 26.8,
    debtToEquity: 0.22,
    salesCagr3Yr: 18.9,
    profitCagr3Yr: 24.5,
    promoterHoldingPercent: 51.5,
    currentPrice: 84.5,
    fiftyTwoWeekHigh: 112.0,
    turnaroundScore: 91,
    tags: ["MICRO_CAP_TURNAROUND", "DEBT_FREE"]
  }
];

router.get("/penny", (req, res) => {
  try {
    const cached = globalCache.get("screener_penny");
    if (cached) {
      res.json(cached);
      return;
    }
    globalCache.set("screener_penny", PENNY_STOCKS_DATA, 7200000); // 2 hours cache
    res.json(PENNY_STOCKS_DATA);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch screener penny stock data" });
  }
});

export default router;

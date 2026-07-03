import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import { RSI } from "technicalindicators";
import { globalCache } from "../lib/cache.js";
import { logger } from "../lib/logger.js";

const router: IRouter = Router();

// ─── Yahoo symbol helper ────────────────────────────────────────────────────
function toYahooSymbol(symbol: string): string {
  return `${symbol.toUpperCase().trim()}.NS`;
}

// ─── Shared interfaces (unchanged API contract) ─────────────────────────────
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

// ─── Symbol Catalogs ────────────────────────────────────────────────────────
// Curated stock picks — sector, tags, and static fundamental estimates that
// Yahoo Finance does not provide (analyst research data).

interface MultibaggerCatalogEntry {
  symbol: string;
  name: string;
  sector: string;
  tags: string[];
  salesCagr3Yr: number;
  profitCagr3Yr: number;
  freeCashFlowCr: number;
}

const MULTIBAGGER_CATALOG: MultibaggerCatalogEntry[] = [
  { symbol: "SUZLON",     name: "Suzlon Energy Ltd.",                 sector: "Green Energy & Wind",             tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "DEBT_FREE", "HIGH_GROWTH"], salesCagr3Yr: 42.5, profitCagr3Yr: 68.0, freeCashFlowCr: 1250 },
  { symbol: "DIXON",      name: "Dixon Technologies (India) Ltd.",    sector: "Electronics Manufacturing (EMS)", tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"],               salesCagr3Yr: 38.2, profitCagr3Yr: 45.1, freeCashFlowCr: 890  },
  { symbol: "BEL",        name: "Bharat Electronics Ltd.",            sector: "Defense & Aerospace",             tags: ["CORE_MULTIBAGGER", "DEBT_FREE", "VALUATION_PLAY"],                    salesCagr3Yr: 18.4, profitCagr3Yr: 24.2, freeCashFlowCr: 4500 },
  { symbol: "HAL",        name: "Hindustan Aeronautics Ltd.",         sector: "Defense & Defense Aviation",      tags: ["CORE_MULTIBAGGER", "DEBT_FREE", "VALUATION_PLAY"],                    salesCagr3Yr: 21.0, profitCagr3Yr: 31.5, freeCashFlowCr: 6200 },
  { symbol: "TATAELXSI",  name: "Tata Elxsi Ltd.",                    sector: "Artificial Intelligence & ER&D",  tags: ["DEBT_FREE", "VALUATION_PLAY"],                                        salesCagr3Yr: 19.8, profitCagr3Yr: 22.4, freeCashFlowCr: 720  },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.",                   sector: "Automobile & EV",                 tags: ["CORE_MULTIBAGGER", "VALUATION_PLAY", "MOMENTUM_BREAKOUT"],            salesCagr3Yr: 28.6, profitCagr3Yr: 110.2, freeCashFlowCr: 14200 },
  { symbol: "KAYNES",     name: "Kaynes Technology India Ltd.",       sector: "Semiconductors & EMS",            tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"],               salesCagr3Yr: 54.2, profitCagr3Yr: 62.8, freeCashFlowCr: 340  },
  { symbol: "PREMIERENE", name: "Premier Energies Ltd.",              sector: "Solar Manufacturing & Renewable", tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"],               salesCagr3Yr: 65.4, profitCagr3Yr: 95.0, freeCashFlowCr: 950  },
];

interface PennyCatalogEntry {
  symbol: string;
  name: string;
  sector: string;
  tags: string[];
  salesCagr3Yr: number;
  profitCagr3Yr: number;
}

const PENNY_CATALOG: PennyCatalogEntry[] = [
  { symbol: "UJAAS",   name: "Ujaas Energy Ltd.",                  sector: "Solar & EV Infrastructure",     tags: ["MICRO_CAP_TURNAROUND", "DEBT_FREE", "SUB_50_GROWTH"], salesCagr3Yr: 48.2, profitCagr3Yr: 72.0 },
  { symbol: "ORICONENT", name: "Oricon Enterprises Ltd.",             sector: "Packaging & Real Estate",       tags: ["SUB_50_GROWTH", "DEBT_FREE"],                         salesCagr3Yr: 22.4, profitCagr3Yr: 35.1 },
  { symbol: "RTNPOWER", name: "RattanIndia Power Ltd.",             sector: "Power Generation & Utility",    tags: ["MICRO_CAP_TURNAROUND", "SUB_50_GROWTH"],              salesCagr3Yr: 34.1, profitCagr3Yr: 88.5 },
  { symbol: "SALASAR", name: "Salasar Techno Engineering Ltd.",     sector: "EPC & Infrastructure",          tags: ["SUB_50_GROWTH"],                                      salesCagr3Yr: 28.5, profitCagr3Yr: 31.2 },
  { symbol: "URJA",    name: "Urja Global Ltd.",                    sector: "Renewable & EV Batteries",      tags: ["DEBT_FREE", "SUB_50_GROWTH"],                         salesCagr3Yr: 39.4, profitCagr3Yr: 42.1 },
  { symbol: "VALIANTORG", name: "Valiant Organics Ltd.",               sector: "Specialty Chemicals",           tags: ["MICRO_CAP_TURNAROUND", "DEBT_FREE"],                  salesCagr3Yr: 18.9, profitCagr3Yr: 24.5 },
];

// ─── Hardcoded fallback data (used when Yahoo Finance is completely down) ──
// These are the original static values that were baked in before live enrichment.
const MULTIBAGGER_FALLBACK: MultibaggerStockData[] = [
  { symbol: "SUZLON",     name: "Suzlon Energy Ltd.",              sector: "Green Energy & Wind",             marketCapCr: 74500,  peRatio: 34.2, roePercent: 28.4, rocePercent: 31.2, debtToEquity: 0.05, salesCagr3Yr: 42.5, profitCagr3Yr: 68.0, pegRatio: 0.50, promoterHoldingPercent: 13.28, freeCashFlowCr: 1250,  dividendYieldPercent: 0.0,  priceToBook: 8.5,  fiftyTwoWeekHigh: 86.0,    currentPrice: 78.4,    relativeStrengthIndex: 68.4, volumeSpikeRatio: 2.4, multibaggerScore: 94, tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "DEBT_FREE", "HIGH_GROWTH"] },
  { symbol: "DIXON",      name: "Dixon Technologies (India) Ltd.", sector: "Electronics Manufacturing (EMS)", marketCapCr: 82100,  peRatio: 78.5, roePercent: 31.6, rocePercent: 34.8, debtToEquity: 0.22, salesCagr3Yr: 38.2, profitCagr3Yr: 45.1, pegRatio: 1.74, promoterHoldingPercent: 33.7,  freeCashFlowCr: 890,   dividendYieldPercent: 0.08, priceToBook: 24.1, fiftyTwoWeekHigh: 15400.0,  currentPrice: 14850.0, relativeStrengthIndex: 72.1, volumeSpikeRatio: 1.8, multibaggerScore: 91, tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"] },
  { symbol: "BEL",        name: "Bharat Electronics Ltd.",         sector: "Defense & Aerospace",             marketCapCr: 215000, peRatio: 48.2, roePercent: 26.5, rocePercent: 35.1, debtToEquity: 0.00, salesCagr3Yr: 18.4, profitCagr3Yr: 24.2, pegRatio: 1.99, promoterHoldingPercent: 51.14, freeCashFlowCr: 4500,  dividendYieldPercent: 0.75, priceToBook: 12.4, fiftyTwoWeekHigh: 340.0,    currentPrice: 312.5,   relativeStrengthIndex: 64.2, volumeSpikeRatio: 1.5, multibaggerScore: 89, tags: ["CORE_MULTIBAGGER", "DEBT_FREE", "VALUATION_PLAY"] },
  { symbol: "HAL",        name: "Hindustan Aeronautics Ltd.",      sector: "Defense & Defense Aviation",      marketCapCr: 312000, peRatio: 38.6, roePercent: 29.8, rocePercent: 38.4, debtToEquity: 0.00, salesCagr3Yr: 21.0, profitCagr3Yr: 31.5, pegRatio: 1.22, promoterHoldingPercent: 71.64, freeCashFlowCr: 6200,  dividendYieldPercent: 0.85, priceToBook: 10.8, fiftyTwoWeekHigh: 5450.0,   currentPrice: 4890.0,  relativeStrengthIndex: 61.8, volumeSpikeRatio: 1.6, multibaggerScore: 88, tags: ["CORE_MULTIBAGGER", "DEBT_FREE", "VALUATION_PLAY"] },
  { symbol: "TATAELXSI",  name: "Tata Elxsi Ltd.",                 sector: "Artificial Intelligence & ER&D",  marketCapCr: 43500,  peRatio: 52.4, roePercent: 34.2, rocePercent: 41.5, debtToEquity: 0.01, salesCagr3Yr: 19.8, profitCagr3Yr: 22.4, pegRatio: 2.34, promoterHoldingPercent: 43.92, freeCashFlowCr: 720,   dividendYieldPercent: 0.98, priceToBook: 17.5, fiftyTwoWeekHigh: 9200.0,   currentPrice: 7150.0,  relativeStrengthIndex: 54.6, volumeSpikeRatio: 1.2, multibaggerScore: 85, tags: ["DEBT_FREE", "VALUATION_PLAY"] },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.",                sector: "Automobile & EV",                 marketCapCr: 345000, peRatio: 10.5, roePercent: 45.2, rocePercent: 22.8, debtToEquity: 0.48, salesCagr3Yr: 28.6, profitCagr3Yr: 110.2, pegRatio: 0.10, promoterHoldingPercent: 46.36, freeCashFlowCr: 14200, dividendYieldPercent: 0.64, priceToBook: 3.8,  fiftyTwoWeekHigh: 1175.0,   currentPrice: 965.0,   relativeStrengthIndex: 58.2, volumeSpikeRatio: 1.9, multibaggerScore: 93, tags: ["CORE_MULTIBAGGER", "VALUATION_PLAY", "MOMENTUM_BREAKOUT"] },
  { symbol: "KAYNES",     name: "Kaynes Technology India Ltd.",    sector: "Semiconductors & EMS",            marketCapCr: 32400,  peRatio: 92.0, roePercent: 22.4, rocePercent: 25.1, debtToEquity: 0.15, salesCagr3Yr: 54.2, profitCagr3Yr: 62.8, pegRatio: 1.46, promoterHoldingPercent: 57.82, freeCashFlowCr: 340,   dividendYieldPercent: 0.0,  priceToBook: 14.2, fiftyTwoWeekHigh: 5800.0,   currentPrice: 5320.0,  relativeStrengthIndex: 74.5, volumeSpikeRatio: 2.8, multibaggerScore: 92, tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"] },
  { symbol: "PREMIERENE", name: "Premier Energies Ltd.",           sector: "Solar Manufacturing & Renewable", marketCapCr: 48500,  peRatio: 42.6, roePercent: 38.5, rocePercent: 42.1, debtToEquity: 0.28, salesCagr3Yr: 65.4, profitCagr3Yr: 95.0, pegRatio: 0.45, promoterHoldingPercent: 64.2,  freeCashFlowCr: 950,   dividendYieldPercent: 0.0,  priceToBook: 11.2, fiftyTwoWeekHigh: 1280.0,   currentPrice: 1150.0,  relativeStrengthIndex: 71.2, volumeSpikeRatio: 3.1, multibaggerScore: 95, tags: ["CORE_MULTIBAGGER", "MOMENTUM_BREAKOUT", "HIGH_GROWTH"] },
];

const PENNY_FALLBACK: PennyStockData[] = [
  { symbol: "UJAAS",    name: "Ujaas Energy Ltd.",                sector: "Solar & EV Infrastructure",  marketCapCr: 98,  peRatio: 18.4, roePercent: 24.5, rocePercent: 28.1, debtToEquity: 0.12, salesCagr3Yr: 48.2, profitCagr3Yr: 72.0, promoterHoldingPercent: 62.4, currentPrice: 18.5, fiftyTwoWeekHigh: 24.0, turnaroundScore: 94, tags: ["MICRO_CAP_TURNAROUND", "DEBT_FREE", "SUB_50_GROWTH"] },
  { symbol: "ORICONENT", name: "Oricon Enterprises Ltd.",           sector: "Packaging & Real Estate",    marketCapCr: 115, peRatio: 12.8, roePercent: 19.2, rocePercent: 21.5, debtToEquity: 0.18, salesCagr3Yr: 22.4, profitCagr3Yr: 35.1, promoterHoldingPercent: 67.2, currentPrice: 38.2, fiftyTwoWeekHigh: 49.5, turnaroundScore: 89, tags: ["SUB_50_GROWTH", "DEBT_FREE"] },
  { symbol: "RTNPOWER", name: "RattanIndia Power Ltd.",            sector: "Power Generation & Utility", marketCapCr: 480, peRatio: 14.2, roePercent: 28.9, rocePercent: 31.4, debtToEquity: 0.45, salesCagr3Yr: 34.1, profitCagr3Yr: 88.5, promoterHoldingPercent: 44.1, currentPrice: 14.8, fiftyTwoWeekHigh: 21.2, turnaroundScore: 92, tags: ["MICRO_CAP_TURNAROUND", "SUB_50_GROWTH"] },
  { symbol: "SALASAR",  name: "Salasar Techno Engineering Ltd.",   sector: "EPC & Infrastructure",       marketCapCr: 320, peRatio: 22.1, roePercent: 21.8, rocePercent: 25.4, debtToEquity: 0.38, salesCagr3Yr: 28.5, profitCagr3Yr: 31.2, promoterHoldingPercent: 63.1, currentPrice: 19.4, fiftyTwoWeekHigh: 31.0, turnaroundScore: 88, tags: ["SUB_50_GROWTH"] },
  { symbol: "URJA",     name: "Urja Global Ltd.",                  sector: "Renewable & EV Batteries",   marketCapCr: 210, peRatio: 45.2, roePercent: 16.4, rocePercent: 18.2, debtToEquity: 0.05, salesCagr3Yr: 39.4, profitCagr3Yr: 42.1, promoterHoldingPercent: 31.8, currentPrice: 22.6, fiftyTwoWeekHigh: 38.4, turnaroundScore: 86, tags: ["DEBT_FREE", "SUB_50_GROWTH"] },
  { symbol: "VALIANTORG", name: "Valiant Organics Ltd.",             sector: "Specialty Chemicals",         marketCapCr: 490, peRatio: 19.8, roePercent: 22.5, rocePercent: 26.8, debtToEquity: 0.22, salesCagr3Yr: 18.9, profitCagr3Yr: 24.5, promoterHoldingPercent: 51.5, currentPrice: 84.5, fiftyTwoWeekHigh: 112.0, turnaroundScore: 91, tags: ["MICRO_CAP_TURNAROUND", "DEBT_FREE"] },
];

// ─── RSI Computation Helper ─────────────────────────────────────────────────
async function computeRSI(yahooSym: string): Promise<number> {
  try {
    const chart = await yahooFinance.chart(yahooSym, {
      period1: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days back
      period2: new Date(),
      interval: "1d",
    });
    const closes = (chart.quotes || [])
      .map((q: any) => q.close)
      .filter((v: any) => v != null && !isNaN(v));

    if (closes.length < 15) return 50; // Not enough data

    const rsiValues = RSI.calculate({ values: closes, period: 14 });
    return rsiValues.length > 0
      ? Math.round(rsiValues[rsiValues.length - 1] * 10) / 10
      : 50;
  } catch {
    return 50; // Neutral default on failure
  }
}

// ─── Multibagger Score Calculation ──────────────────────────────────────────
// Weighted composite: ROE (25%), low debt (20%), growth CAGRs (20%),
// valuation (15%), momentum/RSI (10%), volume spike (10%)
function calculateMultibaggerScore(data: {
  roePercent: number;
  debtToEquity: number;
  salesCagr3Yr: number;
  profitCagr3Yr: number;
  peRatio: number;
  pegRatio: number;
  relativeStrengthIndex: number;
  volumeSpikeRatio: number;
}): number {
  const roeScore = Math.min(data.roePercent / 40 * 100, 100);                     // 40% ROE → 100
  const debtScore = Math.max(100 - (data.debtToEquity * 200), 0);                  // 0 debt → 100
  const growthScore = Math.min(((data.salesCagr3Yr + data.profitCagr3Yr) / 2) / 50 * 100, 100);
  const valScore = data.pegRatio > 0 ? Math.min(100 - (data.pegRatio * 30), 100) : 50;
  const rsiScore = data.relativeStrengthIndex >= 50 && data.relativeStrengthIndex <= 75
    ? 80 + (data.relativeStrengthIndex - 50)  // Sweet spot
    : data.relativeStrengthIndex > 75 ? 70 : data.relativeStrengthIndex; // Overbought or weak
  const volScore = Math.min(data.volumeSpikeRatio * 40, 100);

  const weighted = (roeScore * 0.25) + (debtScore * 0.20) + (growthScore * 0.20) +
                   (valScore * 0.15) + (rsiScore * 0.10) + (volScore * 0.10);
  return Math.round(Math.min(Math.max(weighted, 0), 100));
}

// ─── Turnaround Score Calculation (for penny stocks) ────────────────────────
// Emphasizes: low debt (25%), profit growth (25%), sales growth (20%),
// ROE recovery (15%), valuation (15%)
function calculateTurnaroundScore(data: {
  roePercent: number;
  debtToEquity: number;
  salesCagr3Yr: number;
  profitCagr3Yr: number;
  peRatio: number;
}): number {
  const debtScore = Math.max(100 - (data.debtToEquity * 200), 0);
  const profitGrowthScore = Math.min(data.profitCagr3Yr / 60 * 100, 100);
  const salesGrowthScore = Math.min(data.salesCagr3Yr / 40 * 100, 100);
  const roeScore = Math.min(data.roePercent / 30 * 100, 100);
  const valScore = data.peRatio > 0 && data.peRatio < 50 ? (100 - data.peRatio * 2) : 10;

  const weighted = (debtScore * 0.25) + (profitGrowthScore * 0.25) + (salesGrowthScore * 0.20) +
                   (roeScore * 0.15) + (Math.max(valScore, 0) * 0.15);
  return Math.round(Math.min(Math.max(weighted, 0), 100));
}

// ─── Live Data Enrichment: Multibagger ──────────────────────────────────────
async function fetchLiveMultibaggerData(): Promise<MultibaggerStockData[]> {
  const results = await Promise.allSettled(
    MULTIBAGGER_CATALOG.map(async (entry): Promise<MultibaggerStockData> => {
      const yahooSym = toYahooSymbol(entry.symbol);

      // Fetch quoteSummary for fundamental metrics + quote for live price/volume
      const [summaryResult, quoteResult, rsi] = await Promise.all([
        yahooFinance.quoteSummary(yahooSym, {
          modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "price"] as const,
        }).catch(() => null),
        yahooFinance.quote(yahooSym).catch(() => null),
        computeRSI(yahooSym),
      ]);

      const summary = summaryResult;
      const quote = quoteResult;

      // Extract live values with safe defaults
      const currentPrice = summary?.price?.regularMarketPrice ?? quote?.regularMarketPrice ?? 0;
      const marketCapRaw = summary?.price?.marketCap ?? quote?.marketCap ?? 0;
      const marketCapCr = Math.round(marketCapRaw / 10000000); // Convert to Crores

      const peRatio = Math.round((summary?.summaryDetail?.trailingPE ?? quote?.trailingPE ?? 0) * 10) / 10;
      const roeRaw = summary?.financialData?.returnOnEquity ?? 0;
      const roePercent = Math.round(roeRaw * 1000) / 10; // Convert decimal to %
      const roceRaw = summary?.financialData?.returnOnAssets ?? 0; // ROA as ROCE proxy
      const rocePercent = Math.round(roceRaw * 1000) / 10;
      const debtToEquityRaw = summary?.financialData?.debtToEquity ?? 0;
      const debtToEquity = Math.round(debtToEquityRaw) / 100; // Yahoo returns as whole number (e.g. 48 = 0.48)

      const pegRatio = Math.round((summary?.defaultKeyStatistics?.pegRatio ?? 0) * 100) / 100;
      const promoterRaw = summary?.defaultKeyStatistics?.heldPercentInsiders ?? 0;
      const promoterHoldingPercent = Math.round(promoterRaw * 1000) / 10;
      const divYieldRaw = summary?.summaryDetail?.dividendYield ?? 0;
      const dividendYieldPercent = Math.round(divYieldRaw * 10000) / 100;
      const priceToBook = Math.round((summary?.defaultKeyStatistics?.priceToBook ?? 0) * 10) / 10;
      const fiftyTwoWeekHigh = summary?.summaryDetail?.fiftyTwoWeekHigh ?? quote?.fiftyTwoWeekHigh ?? 0;

      const vol = quote?.regularMarketVolume ?? 0;
      const avgVol = quote?.averageDailyVolume3Month ?? 1;
      const volumeSpikeRatio = Math.round((vol / Math.max(avgVol, 1)) * 10) / 10;

      const score = calculateMultibaggerScore({
        roePercent,
        debtToEquity,
        salesCagr3Yr: entry.salesCagr3Yr,
        profitCagr3Yr: entry.profitCagr3Yr,
        peRatio,
        pegRatio,
        relativeStrengthIndex: rsi,
        volumeSpikeRatio,
      });

      return {
        symbol: entry.symbol,
        name: entry.name,
        sector: entry.sector,
        marketCapCr,
        peRatio,
        roePercent,
        rocePercent,
        debtToEquity,
        salesCagr3Yr: entry.salesCagr3Yr,
        profitCagr3Yr: entry.profitCagr3Yr,
        pegRatio,
        promoterHoldingPercent,
        freeCashFlowCr: entry.freeCashFlowCr,
        dividendYieldPercent,
        priceToBook,
        fiftyTwoWeekHigh,
        currentPrice,
        relativeStrengthIndex: rsi,
        volumeSpikeRatio,
        multibaggerScore: score,
        tags: entry.tags,
      };
    })
  );

  const live = results
    .filter((r): r is PromiseFulfilledResult<MultibaggerStockData> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((s) => s.currentPrice > 0); // Drop symbols that returned no price

  return live.length > 0 ? live : MULTIBAGGER_FALLBACK;
}

// ─── Live Data Enrichment: Penny Stocks ─────────────────────────────────────
async function fetchLivePennyData(): Promise<PennyStockData[]> {
  const results = await Promise.allSettled(
    PENNY_CATALOG.map(async (entry): Promise<PennyStockData> => {
      const yahooSym = toYahooSymbol(entry.symbol);

      const [summaryResult, quoteResult] = await Promise.all([
        yahooFinance.quoteSummary(yahooSym, {
          modules: ["summaryDetail", "defaultKeyStatistics", "financialData", "price"] as const,
        }).catch(() => null),
        yahooFinance.quote(yahooSym).catch(() => null),
      ]);

      const summary = summaryResult;
      const quote = quoteResult;

      const currentPrice = summary?.price?.regularMarketPrice ?? quote?.regularMarketPrice ?? 0;
      const marketCapRaw = summary?.price?.marketCap ?? quote?.marketCap ?? 0;
      const marketCapCr = Math.round(marketCapRaw / 10000000);

      const peRatio = Math.round((summary?.summaryDetail?.trailingPE ?? quote?.trailingPE ?? 0) * 10) / 10;
      const roeRaw = summary?.financialData?.returnOnEquity ?? 0;
      const roePercent = Math.round(roeRaw * 1000) / 10;
      const roceRaw = summary?.financialData?.returnOnAssets ?? 0;
      const rocePercent = Math.round(roceRaw * 1000) / 10;
      const debtToEquityRaw = summary?.financialData?.debtToEquity ?? 0;
      const debtToEquity = Math.round(debtToEquityRaw) / 100;

      const promoterRaw = summary?.defaultKeyStatistics?.heldPercentInsiders ?? 0;
      const promoterHoldingPercent = Math.round(promoterRaw * 1000) / 10;
      const fiftyTwoWeekHigh = summary?.summaryDetail?.fiftyTwoWeekHigh ?? quote?.fiftyTwoWeekHigh ?? 0;

      const score = calculateTurnaroundScore({
        roePercent,
        debtToEquity,
        salesCagr3Yr: entry.salesCagr3Yr,
        profitCagr3Yr: entry.profitCagr3Yr,
        peRatio,
      });

      return {
        symbol: entry.symbol,
        name: entry.name,
        sector: entry.sector,
        marketCapCr,
        peRatio,
        roePercent,
        rocePercent,
        debtToEquity,
        salesCagr3Yr: entry.salesCagr3Yr,
        profitCagr3Yr: entry.profitCagr3Yr,
        promoterHoldingPercent,
        currentPrice,
        fiftyTwoWeekHigh,
        turnaroundScore: score,
        tags: entry.tags,
      };
    })
  );

  const live = results
    .filter((r): r is PromiseFulfilledResult<PennyStockData> => r.status === "fulfilled")
    .map((r) => r.value)
    .filter((s) => s.currentPrice > 0);

  return live.length > 0 ? live : PENNY_FALLBACK;
}

// ─── Route Handlers ─────────────────────────────────────────────────────────

router.get("/multibagger", async (req, res) => {
  try {
    const cacheKey = "screener_multibagger_live";
    const cached = globalCache.get<MultibaggerStockData[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    logger.info("Fetching live multibagger screener data from Yahoo Finance...");
    const data = await fetchLiveMultibaggerData();
    globalCache.set(cacheKey, data, 300000); // 5 minutes cache
    res.json(data);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch live multibagger data, returning fallback");
    res.json(MULTIBAGGER_FALLBACK);
  }
});

router.get("/penny", async (req, res) => {
  try {
    const cacheKey = "screener_penny_live";
    const cached = globalCache.get<PennyStockData[]>(cacheKey);
    if (cached) {
      res.json(cached);
      return;
    }

    logger.info("Fetching live penny stock screener data from Yahoo Finance...");
    const data = await fetchLivePennyData();
    globalCache.set(cacheKey, data, 300000); // 5 minutes cache
    res.json(data);
  } catch (error) {
    logger.error({ err: error }, "Failed to fetch live penny data, returning fallback");
    res.json(PENNY_FALLBACK);
  }
});

export default router;

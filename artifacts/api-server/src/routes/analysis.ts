import { Router, type IRouter } from "express";
import YahooFinanceClass from "yahoo-finance2";
const yahooFinance = new (YahooFinanceClass as any)();
import {
  RSI,
  MACD,
  BollingerBands,
  SMA,
  EMA,
  ATR,
  Stochastic,
  ADX,
  CCI,
  OBV,
  ROC,
} from "technicalindicators";
import { GetTechnicalAnalysisQueryParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { watchlist } from "@workspace/db";
import { eq } from "drizzle-orm";

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

function computeTrend(
  signalCount: number,
  total: number
): "STRONG_BULLISH" | "BULLISH" | "NEUTRAL" | "BEARISH" | "STRONG_BEARISH" {
  const ratio = signalCount / total;
  if (ratio >= 0.75) return "STRONG_BULLISH";
  if (ratio >= 0.55) return "BULLISH";
  if (ratio <= 0.25) return "STRONG_BEARISH";
  if (ratio <= 0.45) return "BEARISH";
  return "NEUTRAL";
}

// Yahoo Finance data availability limits per interval
const INTERVAL_LOOKBACK_MS: Record<string, number> = {
  "1m":  7   * 86400000,
  "5m":  55  * 86400000,  // keep under 60-day limit
  "15m": 55  * 86400000,
  "1h":  180 * 86400000,
  "1d":  365 * 86400000,
};

function calculateSupertrend(high: number[], low: number[], close: number[], period: number = 7, multiplier: number = 3) {
  const atrValues = ATR.calculate({ high, low, close, period });
  const size = close.length;
  if (size === 0) return null;
  const alignedAtr = new Array(period).fill(0).concat(atrValues);
  
  const supertrend = new Array(size).fill(0);
  const direction = new Array(size).fill("BULLISH");
  
  supertrend[0] = (high[0] + low[0]) / 2;
  
  let prevFinalUpper = (high[0] + low[0]) / 2;
  let prevFinalLower = (high[0] + low[0]) / 2;
  let prevSuper = supertrend[0];
  let prevDir = "BULLISH";
  
  for (let i = 1; i < size; i++) {
    const hl2 = (high[i] + low[i]) / 2;
    const atr = alignedAtr[i] || 0;
    
    const basicUpper = hl2 + multiplier * atr;
    const basicLower = hl2 - multiplier * atr;
    
    const finalUpper = (basicUpper < prevFinalUpper || close[i - 1] > prevFinalUpper)
      ? basicUpper
      : prevFinalUpper;
      
    const finalLower = (basicLower > prevFinalLower || close[i - 1] < prevFinalLower)
      ? basicLower
      : prevFinalLower;
      
    let currDir = prevDir;
    let currSuper = 0;
    
    if (prevDir === "BULLISH") {
      if (close[i] < finalLower) {
        currDir = "BEARISH";
        currSuper = finalUpper;
      } else {
        currDir = "BULLISH";
        currSuper = Math.max(finalLower, prevSuper);
      }
    } else {
      if (close[i] > finalUpper) {
        currDir = "BULLISH";
        currSuper = finalLower;
      } else {
        currDir = "BEARISH";
        currSuper = Math.min(finalUpper, prevSuper);
      }
    }
    
    supertrend[i] = currSuper;
    direction[i] = currDir;
    
    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevSuper = currSuper;
    prevDir = currDir;
  }
  
  return {
    value: Math.round(supertrend[size - 1] * 100) / 100,
    direction: direction[size - 1] as "BULLISH" | "BEARISH",
  };
}

function calculateEMA(values: number[], period: number): number[] {
  const ema: number[] = [];
  if (values.length === 0) return ema;
  const k = 2 / (period + 1);
  let val = values[0];
  ema.push(val);
  for (let i = 1; i < values.length; i++) {
    val = values[i] * k + val * (1 - k);
    ema.push(val);
  }
  return ema;
}

function calculateStochK(values: number[], period: number): number[] {
  const stoch: number[] = [];
  for (let i = 0; i < values.length; i++) {
    if (i < period - 1) {
      stoch.push(50);
      continue;
    }
    const slice = values.slice(i - period + 1, i + 1);
    const max = Math.max(...slice);
    const min = Math.min(...slice);
    const diff = max - min;
    const k = diff > 0 ? ((values[i] - min) / diff) * 100 : 50;
    stoch.push(k);
  }
  return stoch;
}

function calculateSTC(closes: number[], shortPeriod: number = 23, longPeriod: number = 50, cyclePeriod: number = 10): number {
  const emaShort = calculateEMA(closes, shortPeriod);
  const emaLong = calculateEMA(closes, longPeriod);
  const macd: number[] = [];
  const minLength = Math.min(emaShort.length, emaLong.length);
  for (let i = 0; i < minLength; i++) {
    macd.push(emaShort[i] - emaLong[i]);
  }
  
  const stoch1 = calculateStochK(macd, cyclePeriod);
  const smoothed1 = calculateEMA(stoch1, 3);
  const stoch2 = calculateStochK(smoothed1, cyclePeriod);
  const smoothed2 = calculateEMA(stoch2, 3);
  
  return smoothed2.length ? Math.round(smoothed2[smoothed2.length - 1] * 10) / 10 : 50;
}

function calculateKlinger(highs: number[], lows: number[], closes: number[], volumes: number[]) {
  const size = closes.length;
  const tp = new Array(size);
  const vf = new Array(size).fill(0);
  for (let i = 0; i < size; i++) {
    tp[i] = (highs[i] + lows[i] + closes[i]) / 3;
  }
  for (let i = 1; i < size; i++) {
    const range = highs[i] - lows[i];
    let tempVF = 0;
    if (range > 0) {
      const trend = tp[i] > tp[i - 1] ? 1 : -1;
      const mfm = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
      tempVF = volumes[i] * mfm * trend;
    }
    vf[i] = tempVF;
  }
  const ema34 = calculateEMA(vf, 34);
  const ema55 = calculateEMA(vf, 55);
  const kvo = new Array(size);
  for (let i = 0; i < size; i++) {
    kvo[i] = ema34[i] - ema55[i];
  }
  const signal = calculateEMA(kvo, 13);
  
  return {
    kvo: Math.round(kvo[size - 1]),
    signal: Math.round(signal[size - 1]),
  };
}

async function computeTechnicals(symbol: string, interval: string = "1d") {
  const yahooSym = toYahooSymbol(symbol);
  const lookback = INTERVAL_LOOKBACK_MS[interval] ?? INTERVAL_LOOKBACK_MS["1d"];

  const [chart, vixQuote] = await Promise.all([
    yahooFinance.chart(yahooSym, {
      period1: new Date(Date.now() - lookback),
      interval: interval as any,
    }),
    yahooFinance.quote("^INDIAVIX").catch(() => null)
  ]);

  const indiaVix = vixQuote?.regularMarketPrice ?? 15.00;

  const quotes = chart.quotes ?? [];
  if (quotes.length < 20) {
    throw new Error("Insufficient data for analysis");
  }

  const validQuotes = quotes.filter(
    (q: any) => (q.close ?? 0) > 0 && (q.high ?? 0) > 0 && (q.low ?? 0) > 0
  );
  const closes = validQuotes.map((q: any) => q.close as number);
  const highs = validQuotes.map((q: any) => q.high as number);
  const lows = validQuotes.map((q: any) => q.low as number);
  const volumes = validQuotes.map((q: any) => q.volume as number);

  // RSI (14)
  const rsiValues = RSI.calculate({ values: closes, period: 14 });
  const rsi = rsiValues[rsiValues.length - 1] ?? null;

  // MACD
  const macdResult = MACD.calculate({
    values: closes,
    fastPeriod: 12,
    slowPeriod: 26,
    signalPeriod: 9,
    SimpleMAOscillator: false,
    SimpleMASignal: false,
  });
  const lastMacd = macdResult[macdResult.length - 1];
  const macd = lastMacd
    ? {
        macd: Math.round((lastMacd.MACD ?? 0) * 100) / 100,
        signal: Math.round((lastMacd.signal ?? 0) * 100) / 100,
        histogram: Math.round((lastMacd.histogram ?? 0) * 100) / 100,
      }
    : null;

  // Bollinger Bands (20, 2)
  const bbResult = BollingerBands.calculate({
    period: 20,
    values: closes,
    stdDev: 2,
  });
  const lastBB = bbResult[bbResult.length - 1];
  const bollingerBands = lastBB
    ? {
        upper: Math.round(lastBB.upper * 100) / 100,
        middle: Math.round(lastBB.middle * 100) / 100,
        lower: Math.round(lastBB.lower * 100) / 100,
      }
    : null;

  // SMAs
  const sma20Values = SMA.calculate({ period: 20, values: closes });
  const sma50Values = SMA.calculate({ period: 50, values: closes });
  const sma200Values = SMA.calculate({ period: 200, values: closes });
  const sma20 = sma20Values[sma20Values.length - 1] ?? null;
  const sma50 = sma50Values.length ? sma50Values[sma50Values.length - 1] : null;
  const sma200 = sma200Values.length
    ? sma200Values[sma200Values.length - 1]
    : null;

  // EMAs
  const ema9Values = EMA.calculate({ period: 9, values: closes });
  const ema21Values = EMA.calculate({ period: 21, values: closes });
  const ema9 = ema9Values[ema9Values.length - 1] ?? null;
  const ema21 = ema21Values[ema21Values.length - 1] ?? null;

  // ATR (14)
  let atr: number | null = null;
  if (highs.length >= 15 && lows.length >= 15) {
    const atrValues = ATR.calculate({
      period: 14,
      high: highs,
      low: lows,
      close: closes,
    });
    atr = atrValues[atrValues.length - 1] ?? null;
  }

  // Stochastic
  let stochastic: { k: number; d: number } | null = null;
  if (highs.length >= 14) {
    const stochValues = Stochastic.calculate({
      period: 14,
      signalPeriod: 3,
      high: highs,
      low: lows,
      close: closes,
    });
    const lastStoch = stochValues[stochValues.length - 1];
    if (lastStoch) {
      stochastic = {
        k: Math.round(lastStoch.k * 10) / 10,
        d: Math.round(lastStoch.d * 10) / 10,
      };
    }
  }

  // ──── Advanced Technical Indicators Calculations ────

  // Supertrend (7, 3)
  const supertrend = calculateSupertrend(highs, lows, closes, 7, 3);

  // ADX (14)
  let adx: { adx: number; pdi: number; mdi: number } | null = null;
  if (highs.length >= 28) {
    const adxResult = ADX.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 14
    });
    const lastAdx = adxResult[adxResult.length - 1];
    if (lastAdx) {
      adx = {
        adx: Math.round(lastAdx.adx * 100) / 100,
        pdi: Math.round(lastAdx.pdi * 100) / 100,
        mdi: Math.round(lastAdx.mdi * 100) / 100,
      };
    }
  }

  // CCI (20)
  let cci: number | null = null;
  if (closes.length >= 20) {
    const cciResult = CCI.calculate({
      high: highs,
      low: lows,
      close: closes,
      period: 20
    });
    cci = cciResult.length ? Math.round(cciResult[cciResult.length - 1] * 100) / 100 : null;
  }

  // ROC (12)
  let roc: number | null = null;
  if (closes.length >= 12) {
    const rocResult = ROC.calculate({
      values: closes,
      period: 12
    });
    roc = rocResult.length ? Math.round(rocResult[rocResult.length - 1] * 100) / 100 : null;
  }

  // OBV
  let obv: number | null = null;
  if (closes.length >= 2) {
    const obvResult = OBV.calculate({
      close: closes,
      volume: volumes
    });
    obv = obvResult.length ? obvResult[obvResult.length - 1] : null;
  }

  // CMF (20)
  let cmf: number | null = null;
  if (closes.length >= 20) {
    let mfVolumeSum = 0;
    let volumeSum = 0;
    for (let i = closes.length - 20; i < closes.length; i++) {
      const range = highs[i] - lows[i];
      let mfm = 0;
      if (range > 0) {
        mfm = ((closes[i] - lows[i]) - (highs[i] - closes[i])) / range;
      }
      mfVolumeSum += mfm * volumes[i];
      volumeSum += volumes[i];
    }
    cmf = volumeSum > 0 ? Math.round((mfVolumeSum / volumeSum) * 100) / 100 : 0;
  }

  // VWAP
  let vwap: number | null = null;
  let sumTypicalVolume = 0;
  let sumVolume = 0;
  for (let i = 0; i < closes.length; i++) {
    const typicalPrice = (highs[i] + lows[i] + closes[i]) / 3;
    sumTypicalVolume += typicalPrice * volumes[i];
    sumVolume += volumes[i];
  }
  vwap = sumVolume > 0 ? Math.round((sumTypicalVolume / sumVolume) * 100) / 100 : null;

  // Fibonacci Levels (50 bar range)
  let fibonacci: { h100: number; h786: number; h618: number; h50: number; h382: number; h236: number; h0: number } | null = null;
  if (highs.length >= 10) {
    const limit = Math.min(highs.length, 50);
    const lastHighs = highs.slice(-limit);
    const lastLows = lows.slice(-limit);
    const maxHigh = Math.max(...lastHighs);
    const minLow = Math.min(...lastLows);
    const diff = maxHigh - minLow;
    fibonacci = {
      h100: Math.round(maxHigh * 100) / 100,
      h786: Math.round((maxHigh - 0.214 * diff) * 100) / 100,
      h618: Math.round((maxHigh - 0.382 * diff) * 100) / 100,
      h50: Math.round((maxHigh - 0.500 * diff) * 100) / 100,
      h382: Math.round((maxHigh - 0.618 * diff) * 100) / 100,
      h236: Math.round((maxHigh - 0.764 * diff) * 100) / 100,
      h0: Math.round(minLow * 100) / 100,
    };
  }

  // Aroon (14)
  let aroon = { up: 50, down: 50 };
  if (highs.length >= 15) {
    const last15Highs = highs.slice(-15);
    const last15Lows = lows.slice(-15);
    let maxIdx = 0;
    let maxValue = last15Highs[0];
    for (let i = 1; i < 15; i++) {
      if (last15Highs[i] >= maxValue) {
        maxValue = last15Highs[i];
        maxIdx = i;
      }
    }
    const daysSinceHigh = 14 - maxIdx;
    const aroonUp = ((14 - daysSinceHigh) / 14) * 100;

    let minIdx = 0;
    let minValue = last15Lows[0];
    for (let i = 1; i < 15; i++) {
      if (last15Lows[i] <= minValue) {
        minValue = last15Lows[i];
        minIdx = i;
      }
    }
    const daysSinceLow = 14 - minIdx;
    const aroonDown = ((14 - daysSinceLow) / 14) * 100;

    aroon = {
      up: Math.round(aroonUp),
      down: Math.round(aroonDown),
    };
  }

  // STC (Schaff Trend Cycle - 23, 50, 10)
  const stc = calculateSTC(closes, 23, 50, 10);

  // Klinger Oscillator (34, 55, 13)
  const klinger = calculateKlinger(highs, lows, closes, volumes);

  // Session POC (Point of Control) over last 50 bars
  let sessionPoc: number | null = null;
  if (closes.length >= 20) {
    const lastCloses = closes.slice(-50);
    const lastVolumes = volumes.slice(-50);
    const max = Math.max(...lastCloses);
    const min = Math.min(...lastCloses);
    const bucketCount = 10;
    const range = max - min;
    if (range > 0) {
      const bucketSize = range / bucketCount;
      const buckets = new Array(bucketCount).fill(0);
      for (let i = 0; i < lastCloses.length; i++) {
        const bIdx = Math.min(Math.floor((lastCloses[i] - min) / bucketSize), bucketCount - 1);
        buckets[bIdx] += lastVolumes[i];
      }
      let maxVolume = -1;
      let maxBucketIdx = 0;
      for (let i = 0; i < bucketCount; i++) {
        if (buckets[i] > maxVolume) {
          maxVolume = buckets[i];
          maxBucketIdx = i;
        }
      }
      sessionPoc = min + (maxBucketIdx + 0.5) * bucketSize;
      sessionPoc = Math.round(sessionPoc * 100) / 100;
    } else {
      sessionPoc = closes[closes.length - 1];
    }
  }

  // Compute overall signal
  const currentPrice = closes[closes.length - 1];
  let bullishSignals = 0;
  let totalSignals = 0;

  if (rsi !== null) {
    totalSignals++;
    if (rsi < 30) bullishSignals++; // Oversold = bullish
    else if (rsi > 70) {} // Overbought = bearish
    else if (rsi > 50) bullishSignals++;
  }

  if (macd) {
    totalSignals += 2;
    if (macd.histogram > 0) bullishSignals++;
    if (macd.macd > macd.signal) bullishSignals++;
  }

  if (sma20 && sma50) {
    totalSignals++;
    if (sma20 > sma50) bullishSignals++;
  }

  if (currentPrice && sma200) {
    totalSignals++;
    if (currentPrice > sma200) bullishSignals++;
  }

  if (ema9 && ema21) {
    totalSignals++;
    if (ema9 > ema21) bullishSignals++;
  }

  if (stochastic) {
    totalSignals++;
    if (stochastic.k < 20) bullishSignals++;
    else if (stochastic.k > 80) {} // Overbought
    else if (stochastic.k > stochastic.d) bullishSignals++;
  }

  const trend = computeTrend(bullishSignals, Math.max(totalSignals, 1));
  const signalStrength =
    Math.round((bullishSignals / Math.max(totalSignals, 1)) * 100);

  let overallSignal: "BUY" | "SELL" | "HOLD" = "HOLD";
  if (signalStrength >= 60) overallSignal = "BUY";
  else if (signalStrength <= 40) overallSignal = "SELL";

  return {
    symbol,
    interval,
    timestamp: new Date().toISOString(),
    rsi: rsi !== null ? Math.round(rsi * 10) / 10 : null,
    macd,
    bollingerBands,
    sma20: sma20 ? Math.round(sma20 * 100) / 100 : null,
    sma50: sma50 ? Math.round(sma50 * 100) / 100 : null,
    sma200: sma200 ? Math.round(sma200 * 100) / 100 : null,
    ema9: ema9 ? Math.round(ema9 * 100) / 100 : null,
    ema21: ema21 ? Math.round(ema21 * 100) / 100 : null,
    atr: atr ? Math.round(atr * 100) / 100 : null,
    stochastic,
    trend,
    overallSignal,
    signalStrength,
    supertrend,
    adx,
    cci,
    roc,
    obv,
    cmf,
    vwap,
    fibonacci,
    indiaVix,
    aroon,
    stc,
    klinger,
    sessionPoc,
    currentPrice,
  };
}

router.get("/analysis/technical", async (req, res) => {
  try {
    const query = GetTechnicalAnalysisQueryParams.parse(req.query);
    const result = await computeTechnicals(query.symbol, query.interval || "1d");
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to compute technical analysis");
    res.status(500).json({ error: "Failed to compute technical analysis" });
  }
});

router.get("/analysis/summary", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const items = await db.select().from(watchlist).where(eq(watchlist.userId, userId));
    const symbols =
      items.length > 0
        ? items.map((w) => w.symbol)
        : ["NIFTY", "BANKNIFTY", "RELIANCE", "TCS", "INFY", "HDFCBANK"];

    const analyzedSymbols = symbols.slice(0, 10);
    const results = await Promise.allSettled(
      analyzedSymbols.map((s) => computeTechnicals(s))
    );

    let bullish = 0,
      bearish = 0,
      neutral = 0,
      strongBuy = 0,
      strongSell = 0;
    const topBuySignals: string[] = [];
    const topSellSignals: string[] = [];

    results.forEach((r, i) => {
      if (r.status === "fulfilled") {
        const t = r.value;
        if (t.trend.includes("BULLISH")) bullish++;
        else if (t.trend.includes("BEARISH")) bearish++;
        else neutral++;

        if (t.trend === "STRONG_BULLISH") {
          strongBuy++;
          topBuySignals.push(analyzedSymbols[i]);
        }
        if (t.trend === "STRONG_BEARISH") {
          strongSell++;
          topSellSignals.push(analyzedSymbols[i]);
        }
        if (t.overallSignal === "BUY" && topBuySignals.length < 5) {
          if (!topBuySignals.includes(analyzedSymbols[i]))
            topBuySignals.push(analyzedSymbols[i]);
        }
        if (t.overallSignal === "SELL" && topSellSignals.length < 5) {
          if (!topSellSignals.includes(analyzedSymbols[i]))
            topSellSignals.push(analyzedSymbols[i]);
        }
      }
    });

    res.json({
      totalSymbols: analyzedSymbols.length,
      bullish,
      bearish,
      neutral,
      strongBuy,
      strongSell,
      topBuySignals: topBuySignals.slice(0, 5),
      topSellSignals: topSellSignals.slice(0, 5),
      updatedAt: new Date().toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to compute analysis summary");
    res.status(500).json({ error: "Failed to compute analysis summary" });
  }
});

export { computeTechnicals };
export default router;

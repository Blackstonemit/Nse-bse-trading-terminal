import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const INDEX_MAP: Record<string, string> = {
  NIFTY: "^NSEI", NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK",
  FINNIFTY: "^CNXFIN", MIDCPNIFTY: "^NSEMDCP50", SENSEX: "^BSESN",
};

function toYahooSymbol(symbol: string): string {
  const clean = symbol.toUpperCase().trim();
  if (INDEX_MAP[clean]) return INDEX_MAP[clean];
  if (symbol.includes(".")) return symbol;
  return `${clean}.NS`;
}

function sma(values: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = period - 1; i < values.length; i++) {
    const slice = values.slice(i - period + 1, i + 1);
    result.push(slice.reduce((a, b) => a + b, 0) / period);
  }
  return result;
}

function rsi(closes: number[], period = 14): number {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff >= 0) gains += diff; else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  for (let i = period + 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(diff, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-diff, 0)) / period;
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Math.round((100 - 100 / (1 + rs)) * 10) / 10;
}

export function registerAnalysisTools(server: McpServer) {
  server.tool(
    "get_technical_analysis",
    "Get technical analysis for any NSE/BSE stock or index. Returns RSI, MACD, moving averages, Bollinger Bands, trend, support/resistance levels, and overall signal (BUY/SELL/NEUTRAL).",
    {
      symbol: z
        .string()
        .describe("NSE/BSE symbol, e.g. RELIANCE, TCS, NIFTY, BANKNIFTY"),
      interval: z
        .enum(["1d", "1h", "5m", "15m"])
        .default("1d")
        .describe("Candlestick interval for analysis"),
      period: z
        .number()
        .int()
        .min(20)
        .max(200)
        .default(100)
        .describe("Number of candles to analyse (default 100)"),
    },
    async ({ symbol, interval, period }) => {
      try {
        const yahooSym = toYahooSymbol(symbol);
        const lookbackDays =
          interval === "1d" ? period :
          interval === "1h" ? Math.ceil(period / 8) :
          Math.ceil(period / 78);

        const startDate = new Date(Date.now() - lookbackDays * 24 * 3600 * 1000);
        const history = await yahooFinance.chart(yahooSym, {
          period1: startDate,
          interval: interval as any,
        });

        const quotes = history?.quotes ?? [];
        if (quotes.length < 20) {
          return {
            content: [{ type: "text", text: `Insufficient data for ${symbol}. Need at least 20 candles.` }],
            isError: true,
          };
        }

        const closes = quotes.map((q: any) => q.close ?? 0).filter((c: number) => c > 0);
        const highs  = quotes.map((q: any) => q.high  ?? 0);
        const lows   = quotes.map((q: any) => q.low   ?? 0);
        const currentPrice = closes[closes.length - 1];

        // RSI
        const rsiValue = rsi(closes);

        // SMA
        const sma20arr = sma(closes, 20);
        const sma50arr = sma(closes, Math.min(50, closes.length));
        const sma20 = sma20arr[sma20arr.length - 1] ?? currentPrice;
        const sma50 = sma50arr[sma50arr.length - 1] ?? currentPrice;

        // Bollinger Bands (20-period, 2 SD)
        const bbSlice = closes.slice(-20);
        const bbMid = bbSlice.reduce((a: number, b: number) => a + b, 0) / 20;
        const bbStd = Math.sqrt(bbSlice.reduce((a: number, b: number) => a + Math.pow(b - bbMid, 2), 0) / 20);
        const bbUpper = Math.round((bbMid + 2 * bbStd) * 100) / 100;
        const bbLower = Math.round((bbMid - 2 * bbStd) * 100) / 100;

        // Support / Resistance (simple 20-period high/low)
        const recent20H = Math.max(...highs.slice(-20));
        const recent20L = Math.min(...lows.slice(-20));

        // Trend
        const bullishSignals = [
          rsiValue > 50,
          currentPrice > sma20,
          currentPrice > sma50,
          sma20 > sma50,
        ].filter(Boolean).length;

        const trend =
          bullishSignals >= 4 ? "STRONG_BULLISH" :
          bullishSignals === 3 ? "BULLISH" :
          bullishSignals === 1 ? "BEARISH" :
          bullishSignals === 0 ? "STRONG_BEARISH" : "NEUTRAL";

        const overallSignal =
          trend === "STRONG_BULLISH" || trend === "BULLISH" ? "BUY" :
          trend === "STRONG_BEARISH" || trend === "BEARISH" ? "SELL" : "NEUTRAL";

        const result = {
          symbol: symbol.toUpperCase(),
          interval,
          currentPrice,
          rsi: rsiValue,
          sma20: Math.round(sma20 * 100) / 100,
          sma50: Math.round(sma50 * 100) / 100,
          bollingerBands: { upper: bbUpper, middle: Math.round(bbMid * 100) / 100, lower: bbLower },
          support: Math.round(recent20L * 100) / 100,
          resistance: Math.round(recent20H * 100) / 100,
          trend,
          overallSignal,
          signalStrength: Math.round((bullishSignals / 4) * 100),
          analysis: {
            rsiNote: rsiValue > 70 ? "Overbought" : rsiValue < 30 ? "Oversold" : "Normal",
            priceVsSma20: currentPrice > sma20 ? "Above SMA20 (Bullish)" : "Below SMA20 (Bearish)",
            priceVsSma50: currentPrice > sma50 ? "Above SMA50 (Bullish)" : "Below SMA50 (Bearish)",
            bollingerNote:
              currentPrice > bbUpper ? "Near upper band — potential reversal" :
              currentPrice < bbLower ? "Near lower band — potential bounce" : "Inside bands",
          },
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error computing technical analysis: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

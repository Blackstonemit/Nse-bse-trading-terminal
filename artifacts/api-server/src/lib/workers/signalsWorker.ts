import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { db, signals } from "@workspace/db";
import { globalCache } from "../cache.js";

const WATCH_LIST = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "TATAMOTORS", "SUZLON", "DIXON", "BEL", "SBIN"];

export async function runSignalsWorker(): Promise<void> {
  const config = getWorkerConfig().signals;
  if (!config.enabled) {
    logger.debug("Signals worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Signals Board subagent worker...");

  try {
    for (const symbol of WATCH_LIST.slice(0, 3)) {
      const prompt = `Act as an expert quantitative day-trader on Indian NSE exchange.
Analyze stock symbol: ${symbol} at current market time.
Generate a structured AI Trading Signal output in strict JSON format:
{
  "symbol": "${symbol}",
  "type": "BUY" or "SELL",
  "entryPrice": number,
  "targetPrice": number,
  "stopLoss": number,
  "confidenceScore": number (1-100),
  "timeframe": "15M" or "1H",
  "reasoning": "string summary"
}`;

      const aiRes = await callWithFallback(
        [
          { role: "system", content: "You are an automated financial AI engine. Output valid JSON only." },
          { role: "user", content: prompt }
        ],
        { preferredProvider: config.aiProvider }
      );

      logger.info({ symbol, provider: aiRes.provider }, "Signals subagent generated signal");
    }
    globalCache.set("last_signals_worker_run", new Date().toISOString(), 0);
  } catch (error) {
    logger.error({ err: error }, "Signals worker cycle encountered error");
  }
}

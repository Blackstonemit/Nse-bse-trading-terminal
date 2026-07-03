import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { globalCache } from "../cache.js";

export async function runTechnicalWorker(): Promise<void> {
  const config = getWorkerConfig().technicals;
  if (!config.enabled) {
    logger.debug("Technical analysis worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Technical Analysis subagent worker...");

  try {
    const prompt = `Perform multi-timeframe technical indicator scanning across Nifty 50 constituents.
Evaluate RSI divergence, MACD histogram momentum, ADX trend strength, and Supertrend directional confluence.`;

    const aiRes = await callWithFallback(
      [
        { role: "system", content: "You are a chartered market technician analyzing technical candlestick charts and indicator confluences." },
        { role: "user", content: prompt }
      ],
      { preferredProvider: config.aiProvider }
    );

    logger.info({ provider: aiRes.provider }, "Technical analysis worker cycle complete");
    globalCache.set("last_technical_worker_run", new Date().toISOString(), 0);
  } catch (error) {
    logger.error({ err: error }, "Technical analysis worker encountered error");
  }
}

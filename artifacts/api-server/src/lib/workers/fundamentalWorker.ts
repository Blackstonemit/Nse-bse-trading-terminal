import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { globalCache } from "../cache.js";

export async function runFundamentalWorker(): Promise<void> {
  const config = getWorkerConfig().fundamentals;
  if (!config.enabled) {
    logger.debug("Fundamental analysis worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Fundamental Analysis subagent worker...");

  try {
    const prompt = `Perform fundamental evaluation of core blue-chip and high-momentum stocks.
Assess balance sheet leverage, operating profit margins, free cash flow conversion, and promoter holding stability.`;

    const aiRes = await callWithFallback(
      [
        { role: "system", content: "You are a chartered financial analyst conducting deep fundamental research." },
        { role: "user", content: prompt }
      ],
      { preferredProvider: config.aiProvider }
    );

    logger.info({ provider: aiRes.provider }, "Fundamental analysis worker cycle complete");
    globalCache.set("last_fundamental_worker_run", new Date().toISOString(), 0);
  } catch (error) {
    logger.error({ err: error }, "Fundamental analysis worker encountered error");
  }
}

import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { globalCache } from "../cache.js";

export async function runGlobalMarketWorker(): Promise<void> {
  const config = getWorkerConfig().globalMarket;
  if (!config.enabled) {
    logger.debug("Global market worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Global Exchange subagent worker...");

  try {
    const prompt = `Analyze global macroeconomic indicators including GIFT Nifty (+0.45%), S&P 500 (+0.32%), Nikkei (+0.85%), and Brent Crude ($82.4/bbl).
Provide a concise macroeconomic momentum assessment for Indian market open.`;

    const aiRes = await callWithFallback(
      [
        { role: "system", content: "You are a global macro strategist evaluating inter-market correlations for Indian equity markets." },
        { role: "user", content: prompt }
      ],
      { preferredProvider: config.aiProvider }
    );

    logger.info({ provider: aiRes.provider }, "Global market worker cycle complete");
    globalCache.set("last_global_market_worker_run", new Date().toISOString(), 0);
  } catch (error) {
    logger.error({ err: error }, "Global market worker encountered error");
  }
}

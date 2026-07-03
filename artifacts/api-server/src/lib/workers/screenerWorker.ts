import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { globalCache } from "../cache.js";

export async function runScreenerWorker(): Promise<void> {
  const config = getWorkerConfig().multibagger;
  if (!config.enabled) {
    logger.debug("Multibagger screener worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Multibagger Screener subagent worker...");

  try {
    const prompt = `Perform a high-growth fundamental scan for Indian NSE multibagger stocks.
Filter for companies with >20% ROE, <0.5 Debt/Equity, and strong 3-Yr sales CAGR.
Evaluate top candidates and assign a multibagger confidence rating.`;

    const aiRes = await callWithFallback(
      [
        { role: "system", content: "You are a senior equity analyst specializing in Indian high-compounding growth stocks." },
        { role: "user", content: prompt }
      ],
      { preferredProvider: config.aiProvider }
    );

    logger.info({ provider: aiRes.provider }, "Multibagger screener worker cycle complete");
    globalCache.set("last_multibagger_worker_run", new Date().toISOString(), 0);
  } catch (error) {
    logger.error({ err: error }, "Multibagger screener worker encountered error");
  }
}

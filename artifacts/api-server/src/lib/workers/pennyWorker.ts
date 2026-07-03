import { logger } from "../logger.js";
import { callWithFallback } from "../multi-ai.js";
import { getWorkerConfig } from "./workerConfig.js";
import { globalCache } from "../cache.js";

export async function runPennyWorker(): Promise<void> {
  const config = getWorkerConfig().penny;
  if (!config.enabled) {
    logger.debug("Penny screener worker disabled, skipping cycle");
    return;
  }

  logger.info({ provider: config.aiProvider }, "Running autonomous Penny Stock Screener subagent worker...");

  try {
    const prompt = `Perform a micro-cap turnaround scan for Indian NSE penny stocks under ₹100 price and ₹500 Cr market cap.
Evaluate debt reduction, operational turnaround signs, and positive cash flows.`;

    const aiRes = await callWithFallback(
      [
        { role: "system", content: "You are a micro-cap research analyst specializing in Indian turnaround penny stocks." },
        { role: "user", content: prompt }
      ],
      { preferredProvider: config.aiProvider }
    );

    logger.info({ provider: aiRes.provider }, "Penny stock screener worker cycle complete");
    globalCache.set("last_penny_worker_run", new Date().toISOString(), 0);
  } catch (error) {
    logger.error({ err: error }, "Penny stock screener worker encountered error");
  }
}

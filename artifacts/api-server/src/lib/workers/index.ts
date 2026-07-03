import { logger } from "../logger.js";
import { getWorkerConfig } from "./workerConfig.js";
import { runSignalsWorker } from "./signalsWorker.js";
import { runScreenerWorker } from "./screenerWorker.js";
import { runPennyWorker } from "./pennyWorker.js";
import { runGlobalMarketWorker } from "./globalMarketWorker.js";
import { runFundamentalWorker } from "./fundamentalWorker.js";
import { runTechnicalWorker } from "./technicalWorker.js";

const activeTimers: Map<string, ReturnType<typeof setInterval>> = new Map();

export function initializeAutonomousWorkers(): void {
  logger.info("Initializing Autonomous Background Subagent Workers for Trading Terminal...");

  const config = getWorkerConfig();

  // Helper to schedule periodic worker executions
  const scheduleWorker = (name: string, fn: () => Promise<void>, intervalMs: number) => {
    // Initial run on startup after slight stagger
    setTimeout(() => {
      fn().catch((err) => logger.error({ err, worker: name }, "Worker initial run failed"));
    }, 2000);

    const timer = setInterval(() => {
      fn().catch((err) => logger.error({ err, worker: name }, "Worker periodic cycle failed"));
    }, intervalMs);

    activeTimers.set(name, timer);
  };

  scheduleWorker("signals", runSignalsWorker, config.signals.frequencyMs);
  scheduleWorker("multibagger", runScreenerWorker, config.multibagger.frequencyMs);
  scheduleWorker("penny", runPennyWorker, config.penny.frequencyMs);
  scheduleWorker("globalMarket", runGlobalMarketWorker, config.globalMarket.frequencyMs);
  scheduleWorker("fundamentals", runFundamentalWorker, config.fundamentals.frequencyMs);
  scheduleWorker("technicals", runTechnicalWorker, config.technicals.frequencyMs);

  logger.info("All 6 autonomous background subagents successfully initialized.");
}

export function stopAutonomousWorkers(): void {
  for (const [name, timer] of activeTimers.entries()) {
    clearInterval(timer);
    logger.info({ worker: name }, "Stopped autonomous worker timer");
  }
  activeTimers.clear();
}

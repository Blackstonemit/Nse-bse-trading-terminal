import { globalCache } from "../cache.js";
import { type AIProvider } from "../multi-ai.js";

export type WorkerModule = "signals" | "multibagger" | "penny" | "globalMarket" | "fundamentals" | "technicals";

export type WorkerConfig = {
  aiProvider: AIProvider;
  frequencyMs: number;
  enabled: boolean;
};

export type WorkerConfigMap = Record<WorkerModule, WorkerConfig>;

export const DEFAULT_WORKER_CONFIG: WorkerConfigMap = {
  signals: { aiProvider: "nvidia", frequencyMs: 15 * 60 * 1000, enabled: true },
  multibagger: { aiProvider: "nvidia", frequencyMs: 2 * 60 * 60 * 1000, enabled: true },
  penny: { aiProvider: "nvidia", frequencyMs: 2 * 60 * 60 * 1000, enabled: true },
  globalMarket: { aiProvider: "gemini", frequencyMs: 5 * 60 * 1000, enabled: true },
  fundamentals: { aiProvider: "gemini", frequencyMs: 1 * 60 * 60 * 1000, enabled: true },
  technicals: { aiProvider: "nvidia", frequencyMs: 15 * 60 * 1000, enabled: true },
};

export function getWorkerConfig(): WorkerConfigMap {
  const cached = globalCache.get("worker_config_map");
  if (cached) return cached as WorkerConfigMap;
  return DEFAULT_WORKER_CONFIG;
}

export function updateWorkerConfig(newConfig: Partial<WorkerConfigMap>): WorkerConfigMap {
  const current = getWorkerConfig();
  const updated = { ...current, ...newConfig };
  globalCache.set("worker_config_map", updated, 0); // persistent memory
  return updated;
}

import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { db, providerSettings } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { logger } from "./logger";
import { NIM_REASONING_PARAMS } from "./nvidia";

export type AIProvider = "inference" | "nvidia" | "openai" | "gemini" | "claude" | "ollama" | "deepseek" | "gemma" | "openmodel";

export type AIMessage = { role: "system" | "user" | "assistant"; content: string };

export type AICompletionResult = {
  content: string;
  provider: AIProvider;
};

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";
const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com/v1";

const PROVIDER_MODELS: Record<Exclude<AIProvider, "ollama">, string> = {
  inference: "openrouter/claude-3-7-sonnet",
  nvidia: process.env["NVIDIA_MODEL"] ?? "nvidia/nemotron-3-ultra-550b-a55b",
  openai: "gpt-4o",
  gemini: "gemini-2.5-pro",
  claude: "claude-3-7-sonnet-latest",
  deepseek: "deepseek-reasoner",
  gemma: "gemma-4-31b-it",
  openmodel: "deepseek-v4-flash",
};

function makeOpenAIClient(provider: Exclude<AIProvider, "claude" | "ollama">, apiKey: string, customBaseUrl?: string | null): OpenAI {
  const baseURL = customBaseUrl || (
    provider === "nvidia" ? NVIDIA_BASE_URL :
    provider === "gemini" || provider === "gemma" ? GEMINI_BASE_URL :
    provider === "deepseek" ? DEEPSEEK_BASE_URL :
    provider === "openmodel" ? "https://api.openmodel.ai/v1" :
    undefined
  );
  return new OpenAI({ apiKey, baseURL });
}

export type ProviderConfig = {
  apiKey: string | null;
  enabled: boolean;
  customBaseUrl: string | null;
  customModel: string | null;
};

export async function getProviderConfig(provider: AIProvider, userId?: string): Promise<ProviderConfig> {
  try {
    let query;
    if (userId) {
      query = db
        .select()
        .from(providerSettings)
        .where(and(eq(providerSettings.provider, provider), eq(providerSettings.userId, userId)));
    } else {
      query = db
        .select()
        .from(providerSettings)
        .where(eq(providerSettings.provider, provider));
    }
    const [row] = await query;
    if (row) {
      return {
        apiKey: row.apiKey ?? null,
        enabled: row.enabled ?? true,
        customBaseUrl: row.customBaseUrl ?? null,
        customModel: row.customModel ?? null,
      };
    }
  } catch {}

  let apiKey: string | null = null;
  if (provider === "nvidia") {
    apiKey = process.env["NVIDIA_API_KEY"] ?? null;
  } else if (provider === "gemini") {
    apiKey = process.env["GEMINI_API_KEY"] ?? null;
  } else if (provider === "gemma") {
    apiKey = process.env["GEMMA_API_KEY"] ?? process.env["GEMINI_API_KEY"] ?? null;
  } else if (provider === "openmodel") {
    apiKey = process.env["OPENMODEL_API_KEY"] ?? null;
  }
  return {
    apiKey,
    enabled: !!apiKey,
    customBaseUrl: null,
    customModel: null,
  };
}

export async function getProviderKey(provider: AIProvider, userId?: string): Promise<string | null> {
  try {
    let query;
    if (userId) {
      query = db
        .select()
        .from(providerSettings)
        .where(and(eq(providerSettings.provider, provider), eq(providerSettings.userId, userId)));
    } else {
      query = db
        .select()
        .from(providerSettings)
        .where(eq(providerSettings.provider, provider));
    }
    const [row] = await query;
    if (row?.apiKey) {
      if (row.enabled) return row.apiKey;
      return null;
    }
  } catch {}

  if (provider === "nvidia") {
    return process.env["NVIDIA_API_KEY"] ?? null;
  }
  if (provider === "gemini") {
    return process.env["GEMINI_API_KEY"] ?? null;
  }
  if (provider === "gemma") {
    return process.env["GEMMA_API_KEY"] ?? process.env["GEMINI_API_KEY"] ?? null;
  }
  if (provider === "openmodel") {
    return process.env["OPENMODEL_API_KEY"] ?? null;
  }
  return null;
}

async function callClaude(
  apiKey: string,
  messages: AIMessage[],
  maxTokens: number,
  customBaseUrl?: string | null,
  customModel?: string | null
): Promise<string> {
  const client = new Anthropic({ apiKey, baseURL: customBaseUrl || undefined });

  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const response = await client.messages.create({
    model: customModel || PROVIDER_MODELS.claude,
    max_tokens: maxTokens,
    system: systemMsg || undefined,
    messages: chatMessages,
  });

  const block = response.content[0];
  if (!block || block.type !== "text") throw new Error("Empty Claude response");
  return block.text.trim();
}

async function callOllama(
  configStr: string,
  messages: AIMessage[],
  maxTokens: number
): Promise<string> {
  let host = "http://localhost:11434";
  let model = "qwen2.5";

  try {
    const config = JSON.parse(configStr);
    if (config.host) host = config.host;
    if (config.model) model = config.model;
  } catch {
    if (configStr.includes("|")) {
      const [h, m] = configStr.split("|");
      if (h) host = h;
      if (m) model = m;
    } else if (configStr.startsWith("http")) {
      host = configStr;
    }
  }

  const cleanHost = host.replace(/\/$/, "");
  const response = await fetch(`${cleanHost}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        num_predict: maxTokens,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = (await response.json()) as { message?: { content?: string } };
  const content = data.message?.content?.trim();
  if (!content) throw new Error("Empty response from Ollama");
  return content;
}

import { exec } from "child_process";
import { promisify } from "util";
const execAsync = promisify(exec);

async function callInferenceSh(model: string, messages: AIMessage[]): Promise<string> {
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n\n');
  const inputStr = JSON.stringify({ prompt });
  // Escape single quotes for bash string
  const bashSafeInput = inputStr.replace(/'/g, "'\\''");

  try {
    const { stdout } = await execAsync(`belt app run ${model} --input '${bashSafeInput}' --raw`);
    return stdout.trim();
  } catch (error) {
    throw new Error(`inference.sh failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function callOpenModel(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  maxTokens: number,
  customBaseUrl?: string | null,
  customModel?: string | null
): Promise<string> {
  const url = customBaseUrl || "https://api.openmodel.ai/v1/responses";
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: customModel || model,
      input: messages.map(m => ({ role: m.role, content: m.content })),
      max_output_tokens: maxTokens,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenModel API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as any;
  const content = data.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error("Empty response from OpenModel");
  return content;
}

async function callNvidiaNim(
  apiKey: string,
  model: string,
  messages: AIMessage[],
  customBaseUrl?: string | null,
  customModel?: string | null
): Promise<string> {
  const client = new OpenAI({ apiKey, baseURL: customBaseUrl || NVIDIA_BASE_URL });
  // Cast to any to pass NIM-specific extra params not in the OpenAI SDK types
  const response = await (client.chat.completions.create as any)({
    model: customModel || model,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
    temperature: NIM_REASONING_PARAMS.temperature,
    top_p: NIM_REASONING_PARAMS.top_p,
    max_tokens: NIM_REASONING_PARAMS.max_tokens,
    stream: false,
  });
  const choice = response.choices?.[0];
  // Concatenate CoT reasoning_content (thinking) with final content
  const reasoning: string = choice?.message?.reasoning_content ?? "";
  const final: string = choice?.message?.content?.trim() ?? "";
  const combined = reasoning ? `${reasoning}\n\n${final}` : final;
  if (!combined) throw new Error("Empty response from NVIDIA NIM");
  return combined;
}

export async function callWithFallback(
  messages: AIMessage[],
  options: { maxTokens?: number; preferredProvider?: string; userId?: string } = {}
): Promise<AICompletionResult> {
  const defaultOrder: AIProvider[] = ["nvidia", "openmodel", "gemini", "gemma", "openai", "claude", "deepseek", "inference", "ollama"];
  let order = [...defaultOrder];

  if (options.preferredProvider && options.preferredProvider !== "fallback") {
    const pref = options.preferredProvider as AIProvider;
    order = [pref, ...defaultOrder.filter((p) => p !== pref)];
  }

  const maxTokens = options.maxTokens ?? 2048;

  for (const provider of order) {
    const config = await getProviderConfig(provider, options.userId);
    if (!config.enabled || (!config.apiKey && provider !== "ollama")) {
      logger.debug({ provider }, "AI provider not configured or disabled, skipping");
      continue;
    }

    try {
      let content: string;
      const apiKey = config.apiKey || "";
      const model = config.customModel || PROVIDER_MODELS[provider as Exclude<AIProvider, "ollama">];

      if (provider === "claude") {
        content = await callClaude(apiKey, messages, maxTokens, config.customBaseUrl, config.customModel);
      } else if (provider === "ollama") {
        content = await callOllama(apiKey, messages, maxTokens);
      } else if (provider === "inference") {
        content = await callInferenceSh(model, messages);
      } else if (provider === "openmodel") {
        content = await callOpenModel(apiKey, model, messages, maxTokens, config.customBaseUrl, config.customModel);
      } else if (provider === "nvidia") {
        content = await callNvidiaNim(apiKey, model, messages, config.customBaseUrl, config.customModel);
      } else {
        const client = makeOpenAIClient(provider, apiKey, config.customBaseUrl);
        const response = await client.chat.completions.create({
          model,
          max_tokens: maxTokens,
          messages: messages as Parameters<typeof client.chat.completions.create>[0]["messages"],
        });
        content = response.choices[0]?.message?.content?.trim() ?? "";
        if (!content) throw new Error("Empty response");
      }

      logger.info({ provider, model: provider === "ollama" ? "local" : model }, "AI call succeeded");
      return { content, provider };
    } catch (err) {
      logger.warn({ err, provider }, "AI provider failed, trying next");
    }
  }

  throw new Error("All AI providers failed or are not configured");
}

export async function testProvider(provider: AIProvider, userId?: string): Promise<string> {
  const config = await getProviderConfig(provider, userId);
  if (!config.apiKey && provider !== "ollama") {
    throw new Error(`Provider ${provider} is not configured or missing an API key.`);
  }

  const messages: AIMessage[] = [
    { role: "user", content: "Reply with strictly 'Connection successful' if you receive this message." }
  ];

  try {
    let content: string;
    const apiKey = config.apiKey || "";
    const model = config.customModel || PROVIDER_MODELS[provider as Exclude<AIProvider, "ollama">];

    if (provider === "claude") {
      content = await callClaude(apiKey, messages, 50, config.customBaseUrl, config.customModel);
    } else if (provider === "ollama") {
      content = await callOllama(apiKey, messages, 50);
    } else if (provider === "inference") {
      content = await callInferenceSh(model, messages);
    } else if (provider === "openmodel") {
      content = await callOpenModel(apiKey, model, messages, 50, config.customBaseUrl, config.customModel);
    } else if (provider === "nvidia") {
      content = await callNvidiaNim(apiKey, model, messages, config.customBaseUrl, config.customModel);
    } else {
      const client = makeOpenAIClient(provider, apiKey, config.customBaseUrl);
      const response = await client.chat.completions.create({
        model,
        max_tokens: 50,
        messages: messages as any,
      });
      content = response.choices[0]?.message?.content?.trim() ?? "";
      if (!content) throw new Error("Empty response");
    }
    return "Connection successful.";
  } catch (error: any) {
    logger.error({ err: error, provider }, "testProvider failed");
    throw new Error(`Connection failed: ${error.message || String(error)}`);
  }
}

export async function getProvidersStatus(userId: string): Promise<
  Array<{
    provider: AIProvider;
    configured: boolean;
    enabled: boolean;
    isDefault: boolean;
    value?: string;
    customBaseUrl?: string;
    customModel?: string;
  }>
> {
  const dbRows = await db
    .select()
    .from(providerSettings)
    .where(eq(providerSettings.userId, userId))
    .catch(() => []);
  const dbMap = new Map(dbRows.map((r) => [r.provider, r]));

  const nvidiaKey = process.env["NVIDIA_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];
  const gemmaKey = process.env["GEMMA_API_KEY"] ?? process.env["GEMINI_API_KEY"];
  const providers: AIProvider[] = ["nvidia", "openai", "claude", "gemini", "gemma", "deepseek", "openmodel", "ollama"];

  return providers.map((p, idx) => {
    const row = dbMap.get(p);
    const customBaseUrl = row?.customBaseUrl || "";
    const customModel = row?.customModel || "";

    if (p === "nvidia") {
      const hasDbKey = !!row?.apiKey;
      const configured = hasDbKey || !!nvidiaKey;
      const enabled = hasDbKey ? (row?.enabled ?? true) : true;
      return { provider: p, configured, enabled, isDefault: idx === 0, value: row?.apiKey || "", customBaseUrl, customModel };
    }
    if (p === "gemini") {
      const hasDbKey = !!row?.apiKey;
      const configured = hasDbKey || !!geminiKey;
      const enabled = hasDbKey ? (row?.enabled ?? true) : false;
      return { provider: p, configured, enabled, isDefault: false, value: row?.apiKey || "", customBaseUrl, customModel };
    }
    if (p === "gemma") {
      const hasDbKey = !!row?.apiKey;
      const configured = hasDbKey || !!gemmaKey;
      const enabled = hasDbKey ? (row?.enabled ?? true) : false;
      return { provider: p, configured, enabled, isDefault: false, value: row?.apiKey || "", customBaseUrl, customModel };
    }
    if (p === "openmodel") {
      const hasDbKey = !!row?.apiKey;
      const configured = hasDbKey || !!process.env["OPENMODEL_API_KEY"];
      const enabled = hasDbKey ? (row?.enabled ?? true) : false;
      return { provider: p, configured, enabled, isDefault: false, value: row?.apiKey || "", customBaseUrl, customModel };
    }
    if (p === "ollama") {
      const configured = !!row?.apiKey;
      const enabled = row?.enabled ?? false;
      return { provider: p, configured, enabled, isDefault: false, value: row?.apiKey || "", customBaseUrl, customModel };
    }
    const hasDbKey = !!row?.apiKey;
    return {
      provider: p,
      configured: hasDbKey,
      enabled: row?.enabled ?? false,
      isDefault: false,
      value: row?.apiKey || "",
      customBaseUrl,
      customModel,
    };
  });
}

export async function saveProviderKey(
  provider: AIProvider,
  apiKey: string,
  userId: string,
  customBaseUrl?: string | null,
  customModel?: string | null
): Promise<void> {
  await db
    .insert(providerSettings)
    .values({ userId, provider, apiKey, enabled: true, customBaseUrl, customModel })
    .onConflictDoUpdate({
      target: [providerSettings.userId, providerSettings.provider],
      set: { apiKey, enabled: true, customBaseUrl, customModel, updatedAt: new Date() },
    });
}

export async function toggleProvider(
  provider: AIProvider,
  enabled: boolean,
  userId: string
): Promise<void> {
  await db
    .insert(providerSettings)
    .values({ userId, provider, enabled, apiKey: null })
    .onConflictDoUpdate({
      target: [providerSettings.userId, providerSettings.provider],
      set: { enabled, updatedAt: new Date() },
    });
}

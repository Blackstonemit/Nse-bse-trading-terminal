import { Router, type IRouter } from "express";
import { getProvidersStatus, saveProviderKey, toggleProvider, testProvider } from "../lib/multi-ai";

const router: IRouter = Router();

const DB_PROVIDERS = ["openai", "claude", "gemini", "nvidia", "ollama", "gemma", "deepseek", "openmodel"] as const;
type DbProvider = (typeof DB_PROVIDERS)[number];

function isDbProvider(p: string): p is DbProvider {
  return (DB_PROVIDERS as readonly string[]).includes(p);
}

router.get("/ai-providers/status", async (req: any, res) => {
  try {
    const status = await getProvidersStatus(req.user!.id);
    res.json(status);
  } catch (err) {
    req.log.error({ err }, "Failed to get provider status");
    res.status(500).json({ error: "Failed to get provider status" });
  }
});

router.post("/ai-providers/:provider/key", async (req: any, res) => {
  try {
    const { provider } = req.params;
    if (!isDbProvider(provider)) {
      res.status(400).json({ error: "Invalid provider. Must be openai, claude, gemini, nvidia, ollama, or gemma." });
      return;
    }
    const { apiKey, customBaseUrl, customModel } = req.body as {
      apiKey?: string;
      customBaseUrl?: string;
      customModel?: string;
    };

    const { providerSettings } = await import("@workspace/db");
    const { db } = await import("@workspace/db");
    const { and, eq } = await import("drizzle-orm");

    const [existingRow] = await db
      .select()
      .from(providerSettings)
      .where(and(eq(providerSettings.provider, provider), eq(providerSettings.userId, req.user!.id)))
      .catch(() => []);

    const hasApiKey = apiKey && typeof apiKey === "string" && apiKey.trim().length >= 8;
    
    if (provider !== "ollama" && !hasApiKey && !existingRow?.apiKey) {
      res.status(400).json({ error: "API Key is required" });
      return;
    }

    const finalKey = hasApiKey ? apiKey!.trim() : (existingRow?.apiKey || "");

    await saveProviderKey(
      provider,
      finalKey,
      req.user!.id,
      customBaseUrl !== undefined ? (customBaseUrl?.trim() || null) : (existingRow?.customBaseUrl ?? null),
      customModel !== undefined ? (customModel?.trim() || null) : (existingRow?.customModel ?? null)
    );
    res.json({ success: true, provider });
  } catch (err) {
    req.log.error({ err }, "Failed to save provider key");
    res.status(500).json({ error: "Failed to save provider key" });
  }
});

router.patch("/ai-providers/:provider/toggle", async (req: any, res) => {
  try {
    const { provider } = req.params;
    if (!isDbProvider(provider)) {
      res.status(400).json({ error: "Invalid provider" });
      return;
    }
    const { enabled } = req.body as { enabled?: boolean };
    if (typeof enabled !== "boolean") {
      res.status(400).json({ error: "enabled must be boolean" });
      return;
    }
    await toggleProvider(provider, enabled, req.user!.id);
    res.json({ success: true, provider, enabled });
  } catch (err) {
    req.log.error({ err }, "Failed to toggle provider");
    res.status(500).json({ error: "Failed to toggle provider" });
  }
});

router.post("/ai-providers/:provider/test", async (req: any, res) => {
  try {
    const { provider } = req.params;
    if (!isDbProvider(provider)) {
      res.status(400).json({ error: "Invalid provider" });
      return;
    }
    const response = await testProvider(provider as any, req.user!.id);
    res.json({ success: true, response });
  } catch (err: any) {
    req.log.error({ err }, "Failed to test provider");
    res.status(500).json({ error: err.message || "Failed to test provider" });
  }
});

export default router;

import OpenAI from "openai";

const apiKey = process.env.NVIDIA_API_KEY || "dummy-key-for-compilation";

export const nvidia = new OpenAI({
  apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const NVIDIA_MODEL = "nvidia/nemotron-3-ultra-550b-a55b";

/**
 * Extra parameters required by NVIDIA NIM's Nemotron reasoning model.
 * Pass these in the chat.completions.create() body alongside standard params.
 */
export const NIM_REASONING_PARAMS = {
  temperature: 1,
  top_p: 0.95,
  max_tokens: 16384,
  reasoning_budget: 16384,
  chat_template_kwargs: { enable_thinking: true },
} as const;


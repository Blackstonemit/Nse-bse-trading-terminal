import OpenAI from "openai";

const apiKey = process.env.NVIDIA_API_KEY || "dummy-key-for-compilation";

export const nvidia = new OpenAI({
  apiKey,
  baseURL: "https://integrate.api.nvidia.com/v1",
});

export const NVIDIA_MODEL = "qwen/qwen3.5-122b-a10b";


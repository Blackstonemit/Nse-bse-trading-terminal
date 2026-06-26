import { OpenAI } from "openai";

const client = new OpenAI({
  apiKey: "test", // fake key
  baseURL: "https://integrate.api.nvidia.com/v1"
});

async function main() {
  try {
    await client.chat.completions.create({
      model: "meta/llama-3.1-405b-instruct",
      messages: [{ role: "user", content: "hello" }]
    });
  } catch (err: any) {
    console.log("Error Name:", err.name);
    console.log("Error Message:", err.message);
  }
}

main();

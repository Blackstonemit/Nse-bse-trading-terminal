import "dotenv/config";
import { testProvider } from "../artifacts/api-server/src/lib/multi-ai";
import { db, providerSettings } from "@workspace/db";

async function main() {
  console.log("Testing NVIDIA...");
  try {
    const res1 = await testProvider("nvidia");
    console.log("NVIDIA SUCCESS:", res1);
  } catch (err: any) {
    console.error("NVIDIA ERROR:", err.message);
  }

  console.log("\nTesting Ollama...");
  try {
    const res2 = await testProvider("ollama");
    console.log("OLLAMA SUCCESS:", res2);
  } catch (err: any) {
    console.error("OLLAMA ERROR:", err.message);
  }
}

main().catch(console.error).then(() => process.exit(0));

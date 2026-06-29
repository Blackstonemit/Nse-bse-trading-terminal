import "dotenv/config";
import { saveProviderKey, toggleProvider, testProvider } from "../artifacts/api-server/src/lib/multi-ai";
import { initDb, db, users } from "../lib/db/src/index";

async function setupAIKeys() {
  console.log("=================================================");
  console.log("⚡ AI PROVIDER SETUP & DIAGNOSTIC VERIFICATION");
  console.log("=================================================\n");

  await initDb();

  // Fetch or create user
  let userList = await db.select().from(users);
  let userId = userList[0]?.id;

  if (!userId) {
    console.log("👤 Creating default user in SQLite database...");
    const [inserted] = await db.insert(users).values({
      id: "local-user-1",
      email: "trader@terminal.local",
      name: "Pro Trader",
    }).returning();
    userId = inserted.id;
  }

  console.log(`👤 Active User ID: ${userId}`);

  // 1. Setup Ollama
  const ollamaConfig = JSON.stringify({ host: "http://localhost:11434", model: "gemma4:32b" });
  console.log("\n📦 Configuring Ollama endpoint (http://localhost:11434 with gemma4:32b)...");
  await saveProviderKey("ollama", ollamaConfig, userId);
  await toggleProvider("ollama", true, userId);
  console.log("✅ Ollama saved & enabled in database.");

  // 2. Check Environment Keys
  const nvidiaKey = process.env["NVIDIA_API_KEY"];
  const geminiKey = process.env["GEMINI_API_KEY"];

  if (nvidiaKey) {
    console.log("\n🔑 Saving NVIDIA API Key from environment to database...");
    await saveProviderKey("nvidia", nvidiaKey, userId);
    await toggleProvider("nvidia", true, userId);
    console.log("✅ NVIDIA API Key saved & enabled.");
  } else {
    console.log("\n⚠️ NVIDIA_API_KEY not found in process.env. (Note: Environment keys are also read directly by the server).");
  }

  if (geminiKey) {
    console.log("\n🔑 Saving Gemini API Key from environment to database...");
    await saveProviderKey("gemini", geminiKey, userId);
    await toggleProvider("gemini", true, userId);
    console.log("✅ Gemini API Key saved & enabled.");
  } else {
    console.log("\n⚠️ GEMINI_API_KEY not found in process.env. (Note: Environment keys are also read directly by the server).");
  }

  console.log("\n-------------------------------------------------");
  console.log("🔍 Running Diagnostic Connection Tests...");
  console.log("-------------------------------------------------");

  // Test NVIDIA
  try {
    console.log("Testing NVIDIA NIM connection...");
    const res = await testProvider("nvidia", userId);
    console.log("🟢 NVIDIA Status:", res);
  } catch (err: any) {
    console.log("🔴 NVIDIA Status:", err.message);
  }

  // Test Gemini
  try {
    console.log("Testing Gemini AI Studio connection...");
    const res = await testProvider("gemini", userId);
    console.log("🟢 Gemini Status:", res);
  } catch (err: any) {
    console.log("🔴 Gemini Status:", err.message);
  }

  // Test Ollama
  try {
    console.log("Testing Ollama connection...");
    const res = await testProvider("ollama", userId);
    console.log("🟢 Ollama Status:", res);
  } catch (err: any) {
    console.log("🟡 Ollama Status:", err.message, "(Verify local Ollama service is running if testing local connection)");
  }

  console.log("\n=================================================");
  console.log("🎉 Setup script completed cleanly!");
  console.log("=================================================");
}

setupAIKeys().catch(console.error).then(() => process.exit(0));

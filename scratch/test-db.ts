import { db, initDb, users, watchlist, signals, conversations, messages, providerSettings } from "../lib/db/src";
import { eq, desc } from "drizzle-orm";

async function runTest() {
  console.log("Starting DB Integration Test...");
  
  // Set temporary database path
  process.env.DATABASE_URL = "file:test-db-run.db";
  
  try {
    console.log("Initializing database schema...");
    await initDb();
    console.log("Schema initialized successfully.");

    // Clear previous test records
    await db.delete(watchlist);
    await db.delete(signals);
    await db.delete(conversations);
    await db.delete(providerSettings);
    await db.delete(users);
    
    // Create a mock user
    const mockUserId = "test-user-123";
    await db.insert(users).values({
      id: mockUserId,
      email: "test@example.com",
      name: "Test User"
    });

    // 1. Test Watchlist CRUD...
    console.log("Testing Watchlist CRUD...");
    const [insertedWatchlist] = await db.insert(watchlist).values({
      userId: mockUserId,
      symbol: "RELIANCE",
      name: "Reliance Industries",
      exchange: "NSE",
      instrumentType: "STOCK"
    }).returning();
    console.log("Inserted Watchlist Item:", insertedWatchlist);

    // Verify retrieval
    const retrievedWatchlist = await db.select().from(watchlist).where(eq(watchlist.symbol, "RELIANCE"));
    console.log("Retrieved Watchlist Item:", retrievedWatchlist);
    if (retrievedWatchlist.length !== 1 || retrievedWatchlist[0].name !== "Reliance Industries") {
      throw new Error("Watchlist CRUD test failed.");
    }

    // 2. Test Conversations and Cascading Messages
    console.log("Testing Chat conversations and cascading messages...");
    const [conversation] = await db.insert(conversations).values({
      userId: mockUserId,
      title: "Test AI Analysis"
    }).returning();
    console.log("Inserted Conversation:", conversation);

    const [message] = await db.insert(messages).values({
      conversationId: conversation.id,
      role: "user",
      content: "Explain market state"
    }).returning();
    console.log("Inserted Message:", message);

    // Check cascade deletion
    await db.delete(conversations).where(eq(conversations.id, conversation.id));
    const orphanedMessages = await db.select().from(messages).where(eq(messages.conversationId, conversation.id));
    console.log("Orphaned Messages after conversation deletion:", orphanedMessages);
    if (orphanedMessages.length !== 0) {
      throw new Error("Cascading delete failed on messages.");
    }

    // 3. Test Provider Settings upsert (onConflictDoUpdate)
    console.log("Testing Provider Settings upsert...");
    await db.insert(providerSettings).values({
      userId: mockUserId,
      provider: "ollama",
      apiKey: "http://localhost:11434|qwen2.5",
      enabled: true
    }).onConflictDoUpdate({
      target: [providerSettings.userId, providerSettings.provider],
      set: { apiKey: "http://localhost:11434|llama3", enabled: true }
    });

    // Run conflict update again to verify it updates
    await db.insert(providerSettings).values({
      userId: mockUserId,
      provider: "ollama",
      apiKey: "http://localhost:11434|qwen2.5",
      enabled: true
    }).onConflictDoUpdate({
      target: [providerSettings.userId, providerSettings.provider],
      set: { apiKey: "http://localhost:11434|llama3.1", enabled: true }
    });

    const ollamaSetting = await db.select().from(providerSettings).where(eq(providerSettings.provider, "ollama"));
    console.log("Ollama Setting after upserts:", ollamaSetting);
    if (ollamaSetting.length !== 1 || ollamaSetting[0].apiKey !== "http://localhost:11434|llama3.1") {
      throw new Error("Provider settings upsert test failed.");
    }

    console.log("All DB CRUD tests passed successfully!");
  } catch (err) {
    console.error("Test failed with error:", err);
    process.exit(1);
  } finally {
    // Cleanup test database file
    const fs = require("fs");
    try {
      fs.unlinkSync("test-db-run.db");
    } catch {}
  }
}

runTest();

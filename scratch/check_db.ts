import { createClient } from "@libsql/client";
import path from "path";

async function runDiagnostics() {
  const dbPath = path.resolve(process.cwd(), "database.db");
  console.log(`Connecting to SQLite database at: ${dbPath}`);
  const client = createClient({ url: `file:${dbPath}` });

  try {
    // 1. Table list
    const tables = await client.execute("SELECT name FROM sqlite_master WHERE type='table';");
    console.log("\n--- Tables found in SQLite DB ---");
    tables.rows.forEach(r => console.log(`- ${r.name}`));

    // 2. Query Watchlist
    const watchlist = await client.execute("SELECT * FROM watchlist LIMIT 3;");
    console.log("\n--- Sample Watchlist ---");
    console.log(watchlist.rows);

    // 3. Query Signals
    const signals = await client.execute("SELECT * FROM signals ORDER BY created_at DESC LIMIT 3;");
    console.log("\n--- Recent Signals ---");
    console.log(signals.rows);

    // 4. Query AI Provider Settings
    const providers = await client.execute("SELECT * FROM provider_settings;");
    console.log("\n--- AI Provider Settings ---");
    console.log(providers.rows);

    console.log("\n✅ SQLite database connection diagnostics completed successfully!");
  } catch (err) {
    console.error("❌ Diagnostic error:", err);
  }
}

runDiagnostics();

import { createClient } from "@libsql/client";
import path from "path";

async function seedMockData() {
  const dbPath = path.resolve(process.cwd(), "database.db");
  console.log(`Connecting to SQLite database at: ${dbPath}`);
  const client = createClient({ url: `file:${dbPath}` });

  try {
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + 86400; // 24h from now

    // 1. Seed Signals
    console.log("Seeding mock AI Signals...");
    await client.execute({
      sql: `INSERT INTO signals (symbol, instrument_type, action, display_text, entry_price, target_price, stop_loss, confidence, rationale, status, timeframe, created_at, expires_at)
            VALUES 
            ('NIFTY', 'INDEX', 'BUY', 'NIFTY Bullish Breakout above 24,500', 24520.5, 24750.0, 24380.0, 88, 'Strong institutional buying near support with heavy call unwinding.', 'ACTIVE', 'INTRADAY', ?, ?),
            ('RELIANCE', 'STOCK', 'BUY', 'RELIANCE Swing Accumulation', 1280.0, 1350.0, 1240.0, 92, 'Solid fundamental quarterly growth and bullish MACD crossover on 1D chart.', 'ACTIVE', 'SWING', ?, ?),
            ('BANKNIFTY', 'INDEX', 'SELL', 'BANKNIFTY Short Opportunity', 52100.0, 51400.0, 52450.0, 81, 'Rejection near key resistance zone with rising put activity.', 'ACTIVE', 'INTRADAY', ?, ?);`,
      args: [now, expiresAt, now, expiresAt, now, expiresAt]
    });

    // 2. Seed Trades
    console.log("Seeding mock Paper Trades...");
    await client.execute({
      sql: `INSERT INTO trades (user_id, symbol, action, price, quantity, type, status, entry_time, exit_price, pnl)
            VALUES 
            ('test-user-123', 'RELIANCE', 'BUY', 1260.0, 100, 'MARKET', 'CLOSED', ?, 1295.0, 3500.0),
            ('test-user-123', 'NIFTY', 'BUY', 24480.0, 75, 'SIGNAL', 'OPEN', ?, NULL, NULL),
            ('test-user-123', 'BANKNIFTY', 'SELL', 52200.0, 30, 'LIMIT', 'OPEN', ?, NULL, NULL);`,
      args: [now - 3600, now - 1800, now - 900]
    });

    console.log("✅ Mock Signals and Trades successfully seeded into SQLite database!");
  } catch (err) {
    console.error("❌ Seeding error:", err);
  }
}

seedMockData();

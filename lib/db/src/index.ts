import { drizzle } from "drizzle-orm/libsql";
import { createClient } from "@libsql/client";
import * as schema from "./schema";

import path from "path";
import fs from "fs";

function resolveDbUrl(rawUrl?: string): string {
  const urlStr = rawUrl || process.env.DATABASE_URL || "file:database.db";
  if (urlStr.startsWith("file:")) {
    const rawPath = urlStr.slice(5);
    if (path.isAbsolute(rawPath)) {
      return urlStr;
    }
    
    // Check if directly relative to cwd exists
    const inCwd = path.resolve(process.cwd(), rawPath);
    if (fs.existsSync(inCwd)) {
      return `file:${inCwd}`;
    }

    // Find database.db in current or ancestor workspace root
    let curr = process.cwd();
    for (let i = 0; i < 5; i++) {
      const candidate = path.join(curr, "database.db");
      if (fs.existsSync(candidate)) {
        return `file:${candidate}`;
      }
      const parent = path.dirname(curr);
      if (parent === curr) break;
      curr = parent;
    }

    return `file:${inCwd}`;
  }
  return urlStr;
}

const url = resolveDbUrl();

export const client = createClient({ url });
export const db = drizzle(client, { schema });

export async function initDb() {
  try {
    await client.execute("PRAGMA journal_mode = WAL;");
    await client.execute("PRAGMA busy_timeout = 5000;");
  } catch {}

  // 1. Create users table
  await client.execute(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      name TEXT NOT NULL,
      picture TEXT,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Recreate provider_settings if it doesn't have user_id (old schema migration)
  try {
    const tableInfo = await client.execute("PRAGMA table_info(provider_settings);");
    const hasUserId = tableInfo.rows.some((row: any) => row.name === "user_id");
    if (tableInfo.rows.length > 0 && !hasUserId) {
      await client.execute("DROP TABLE IF EXISTS provider_settings;");
    }
  } catch (e) {}

  await client.execute(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      title TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS watchlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      symbol TEXT NOT NULL,
      name TEXT NOT NULL,
      exchange TEXT NOT NULL DEFAULT 'NSE',
      instrument_type TEXT NOT NULL DEFAULT 'STOCK',
      added_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS signals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      instrument_type TEXT NOT NULL,
      action TEXT NOT NULL,
      display_text TEXT NOT NULL,
      entry_price REAL,
      target_price REAL,
      stop_loss REAL,
      confidence INTEGER NOT NULL,
      rationale TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      timeframe TEXT NOT NULL DEFAULT 'INTRADAY',
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      expires_at INTEGER
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS provider_settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      provider TEXT NOT NULL,
      api_key TEXT,
      enabled INTEGER NOT NULL DEFAULT 1,
      custom_base_url TEXT,
      custom_model TEXT,
      updated_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      UNIQUE(user_id, provider),
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS trades (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT,
      symbol TEXT NOT NULL,
      action TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      type TEXT NOT NULL DEFAULT 'MARKET',
      signal_id INTEGER,
      status TEXT NOT NULL DEFAULT 'OPEN',
      entry_time INTEGER NOT NULL DEFAULT (strftime('%s', 'now')),
      exit_price REAL,
      exit_time INTEGER,
      pnl REAL,
      stop_loss REAL,
      take_profit REAL,
      trailing_stop REAL,
      max_price REAL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);

  await client.execute(`
    CREATE TABLE IF NOT EXISTS bhavcopy_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      symbol TEXT NOT NULL,
      series TEXT NOT NULL,
      date TEXT NOT NULL,
      prev_close REAL NOT NULL,
      open REAL NOT NULL,
      high REAL NOT NULL,
      low REAL NOT NULL,
      close REAL NOT NULL,
      avg_price REAL NOT NULL,
      volume INTEGER NOT NULL,
      turnover_lacs REAL NOT NULL,
      trades INTEGER NOT NULL,
      deliv_qty INTEGER NOT NULL,
      deliv_per REAL NOT NULL,
      change_abs REAL NOT NULL,
      change_pct REAL NOT NULL,
      created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
    );
  `);

  // Run dynamic migrations for existing tables (adding user_id)
  const tables = ["watchlist", "trades", "conversations"];
  for (const table of tables) {
    try {
      await client.execute(`ALTER TABLE ${table} ADD COLUMN user_id TEXT REFERENCES users(id) ON DELETE CASCADE;`);
    } catch (e) {
      // Column probably already exists
    }
  }

  // Run dynamic migrations for new trades columns
  const tradesColumns = ["stop_loss", "take_profit", "trailing_stop", "max_price"];
  for (const col of tradesColumns) {
    try {
      await client.execute(`ALTER TABLE trades ADD COLUMN ${col} REAL;`);
    } catch (e) {
      // Column probably already exists
    }
  }

  // Run dynamic migrations for provider_settings custom columns
  const providerColumns = ["custom_base_url", "custom_model"];
  for (const col of providerColumns) {
    try {
      await client.execute(`ALTER TABLE provider_settings ADD COLUMN ${col} TEXT;`);
    } catch (e) {
      // Column probably already exists
    }
  }
}

export * from "./schema";

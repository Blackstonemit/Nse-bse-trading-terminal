import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";

export const signals = sqliteTable("signals", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  instrumentType: text("instrument_type").notNull(),
  action: text("action").notNull(),
  displayText: text("display_text").notNull(),
  entryPrice: real("entry_price"),
  targetPrice: real("target_price"),
  stopLoss: real("stop_loss"),
  confidence: integer("confidence").notNull(),
  rationale: text("rationale").notNull(),
  status: text("status").notNull().default("ACTIVE"),
  timeframe: text("timeframe").notNull().default("INTRADAY"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`).notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }),
});

export const insertSignalSchema = createInsertSchema(signals).omit({ id: true, createdAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signals.$inferSelect;

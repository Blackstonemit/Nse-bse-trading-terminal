import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const trades = sqliteTable("trades", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  symbol: text("symbol").notNull(),
  action: text("action").notNull(), // 'BUY' or 'SELL'
  price: real("price").notNull(), // entry execution price
  quantity: integer("quantity").notNull(),
  type: text("type").notNull().default("MARKET"), // 'MARKET', 'LIMIT', 'SIGNAL'
  signalId: integer("signal_id"), // link to signals table if executed from AI signal
  status: text("status").notNull().default("OPEN"), // 'OPEN' or 'CLOSED'
  entryTime: integer("entry_time", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`).notNull(),
  exitPrice: real("exit_price"),
  exitTime: integer("exit_time", { mode: "timestamp" }),
  pnl: real("pnl"),
  stopLoss: real("stop_loss"),
  takeProfit: real("take_profit"),
  trailingStop: real("trailing_stop"),
  maxPrice: real("max_price"),
});

export const insertTradeSchema = createInsertSchema(trades).omit({ id: true, entryTime: true });
export type InsertTrade = z.infer<typeof insertTradeSchema>;
export type Trade = typeof trades.$inferSelect;


import { sqliteTable, integer, text, real } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const bhavcopyRecords = sqliteTable("bhavcopy_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  symbol: text("symbol").notNull(),
  series: text("series").notNull(),
  date: text("date").notNull(), // 'YYYY-MM-DD' or date string from Bhavcopy
  prevClose: real("prev_close").notNull(),
  open: real("open").notNull(),
  high: real("high").notNull(),
  low: real("low").notNull(),
  close: real("close").notNull(),
  avgPrice: real("avg_price").notNull(),
  volume: integer("volume").notNull(),
  turnoverLacs: real("turnover_lacs").notNull(),
  trades: integer("trades").notNull(),
  delivQty: integer("deliv_qty").notNull(),
  delivPer: real("deliv_per").notNull(),
  changeAbs: real("change_abs").notNull(),
  changePct: real("change_pct").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type BhavcopyRecord = typeof bhavcopyRecords.$inferSelect;
export type InsertBhavcopyRecord = typeof bhavcopyRecords.$inferInsert;

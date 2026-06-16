import { sqliteTable, integer, text, unique } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { sql } from "drizzle-orm";
import { users } from "./users";

export const providerSettings = sqliteTable("provider_settings", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  apiKey: text("api_key"),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  updatedAt: integer("updated_at", { mode: "timestamp" }).default(sql`(strftime('%s', 'now'))`).notNull(),
}, (t) => ({
  unq: unique().on(t.userId, t.provider)
}));

export const insertProviderSettingsSchema = createInsertSchema(providerSettings).omit({ id: true, updatedAt: true });
export type ProviderSetting = typeof providerSettings.$inferSelect;
export type InsertProviderSetting = z.infer<typeof insertProviderSettingsSchema>;

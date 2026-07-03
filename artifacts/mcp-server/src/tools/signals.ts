import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@workspace/db";
import { signals } from "@workspace/db";
import { desc, eq, and } from "drizzle-orm";

export function registerSignalsTools(server: McpServer) {
  server.tool(
    "get_signals",
    "Get AI generated trading signals for the market.",
    {
      action: z.enum(["BUY", "SELL", "HOLD", "ALL"]).default("ALL"),
      symbol: z.string().optional(),
      limit: z.number().int().min(1).max(50).default(20),
    },
    async ({ action, symbol, limit }) => {
      try {
        let conditions = [];
        if (action !== "ALL") conditions.push(eq(signals.action, action));
        if (symbol) conditions.push(eq(signals.symbol, symbol.toUpperCase()));

        const results = await db
          .select()
          .from(signals)
          .where(conditions.length > 0 ? and(...conditions) : undefined)
          .orderBy(desc(signals.createdAt))
          .limit(limit);

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching signals: ${String(err)}` }], isError: true };
      }
    }
  );
}

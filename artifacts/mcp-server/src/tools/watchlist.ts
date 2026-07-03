import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@workspace/db";
import { watchlist } from "@workspace/db";
import { eq } from "drizzle-orm";

// Default MCP user ID — since MCP has no OAuth, we use the first user in DB
const MCP_USER_ID = "mcp-agent";

export function registerWatchlistTools(server: McpServer) {
  // ── 1. get_watchlist ─────────────────────────────────────────────────────
  server.tool(
    "get_watchlist",
    "Get all stocks in the trading terminal watchlist. Returns symbol, name, exchange, and date added.",
    {},
    async () => {
      try {
        // Get all watchlist items (MCP agent has read access to all)
        const items = await db
          .select()
          .from(watchlist)
          .orderBy(watchlist.addedAt);

        const result = items.map((item) => ({
          id: item.id,
          symbol: item.symbol,
          name: item.name,
          exchange: item.exchange,
          instrumentType: item.instrumentType,
          addedAt: item.addedAt.toISOString(),
        }));

        return {
          content: [
            {
              type: "text" as const,
              text:
                result.length > 0
                  ? JSON.stringify(result, null, 2)
                  : "Watchlist is empty. Add stocks using the add_to_watchlist tool.",
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching watchlist: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── 2. add_to_watchlist ──────────────────────────────────────────────────
  server.tool(
    "add_to_watchlist",
    "Add a stock or index to the trading terminal watchlist.",
    {
      symbol: z.string().describe("NSE/BSE symbol to add, e.g. RELIANCE, TCS, NIFTY"),
      name: z.string().describe("Company or instrument name, e.g. 'Reliance Industries Ltd.'"),
      exchange: z.enum(["NSE", "BSE"]).default("NSE").describe("Exchange"),
      instrumentType: z
        .enum(["STOCK", "INDEX", "ETF", "OPTIONS", "FUTURES"])
        .default("STOCK")
        .describe("Instrument type"),
    },
    async ({ symbol, name, exchange, instrumentType }) => {
      try {
        // Check if already exists
        const existing = await db
          .select()
          .from(watchlist)
          .where(eq(watchlist.symbol, symbol.toUpperCase()));

        if (existing.length > 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `${symbol.toUpperCase()} is already in the watchlist (added ${existing[0].addedAt.toISOString()}).`,
              },
            ],
          };
        }

        const [item] = await db
          .insert(watchlist)
          .values({
            userId: MCP_USER_ID,
            symbol: symbol.toUpperCase(),
            name,
            exchange,
            instrumentType,
          })
          .returning();

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Added ${symbol.toUpperCase()} to watchlist.\n${JSON.stringify({ ...item, addedAt: item.addedAt.toISOString() }, null, 2)}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error adding to watchlist: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── 3. remove_from_watchlist ─────────────────────────────────────────────
  server.tool(
    "remove_from_watchlist",
    "Remove a stock from the trading terminal watchlist by its symbol.",
    {
      symbol: z.string().describe("NSE/BSE symbol to remove, e.g. RELIANCE"),
    },
    async ({ symbol }) => {
      try {
        const existing = await db
          .select()
          .from(watchlist)
          .where(eq(watchlist.symbol, symbol.toUpperCase()));

        if (existing.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `${symbol.toUpperCase()} is not in the watchlist.`,
              },
            ],
          };
        }

        await db
          .delete(watchlist)
          .where(eq(watchlist.symbol, symbol.toUpperCase()));

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Removed ${symbol.toUpperCase()} from watchlist.`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error removing from watchlist: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

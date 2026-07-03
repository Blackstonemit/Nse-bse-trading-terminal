import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { db } from "@workspace/db";
import { trades } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const MCP_USER_ID = "mcp-agent";

const INDEX_MAP: Record<string, string> = {
  NIFTY: "^NSEI", NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK",
  FINNIFTY: "^CNXFIN", MIDCPNIFTY: "^NSEMDCP50", SENSEX: "^BSESN",
};

async function getLivePrice(symbol: string): Promise<number> {
  try {
    const clean = symbol.toUpperCase().trim();
    const yahooSym = INDEX_MAP[clean] ?? (symbol.includes(".") ? symbol : `${clean}.NS`);
    const q = await yahooFinance.quote(yahooSym);
    return q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
  } catch {
    return 0;
  }
}

export function registerPaperTradingTools(server: McpServer) {
  // ── 1. place_paper_trade ─────────────────────────────────────────────────
  server.tool(
    "place_paper_trade",
    "Place a paper (simulated) BUY or SELL trade in the trading terminal. The trade is recorded in the database with live entry price. P&L is tracked automatically.",
    {
      symbol: z.string().describe("NSE/BSE symbol, e.g. RELIANCE, TCS, NIFTY"),
      action: z.enum(["BUY", "SELL"]).describe("Trade direction: BUY (long) or SELL (short)"),
      quantity: z.number().int().min(1).describe("Number of shares/lots to trade"),
      stopLoss: z
        .number()
        .optional()
        .describe("Stop-loss price (optional). Auto-close if price hits this level."),
      takeProfit: z
        .number()
        .optional()
        .describe("Take-profit price (optional). Auto-close if price hits this level."),
      notes: z.string().optional().describe("Optional notes or rationale for this trade"),
    },
    async ({ symbol, action, quantity, stopLoss, takeProfit, notes }) => {
      try {
        const livePrice = await getLivePrice(symbol);
        if (livePrice === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Could not get live price for ${symbol}. Check the symbol and try again.`,
              },
            ],
            isError: true,
          };
        }

        const [trade] = await db
          .insert(trades)
          .values({
            userId: MCP_USER_ID,
            symbol: symbol.toUpperCase(),
            action,
            quantity,
            price: livePrice,
            stopLoss: stopLoss ?? null,
            takeProfit: takeProfit ?? null,
            status: "OPEN",
            entryTime: new Date(),
            notes: notes ?? `Paper trade placed via MCP agent`,
          } as any)
          .returning();

        return {
          content: [
            {
              type: "text" as const,
              text: `✅ Paper trade placed successfully!\n\n${JSON.stringify(
                {
                  id: trade.id,
                  symbol: trade.symbol,
                  action: trade.action,
                  quantity: trade.quantity,
                  entryPrice: trade.price,
                  stopLoss: trade.stopLoss,
                  takeProfit: trade.takeProfit,
                  status: trade.status,
                  entryTime: trade.entryTime.toISOString(),
                  estimatedValue: `₹${Math.round(livePrice * quantity).toLocaleString("en-IN")}`,
                },
                null,
                2
              )}`,
            },
          ],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error placing paper trade: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── 2. get_paper_portfolio ───────────────────────────────────────────────
  server.tool(
    "get_paper_portfolio",
    "Get current paper trading portfolio: all open and closed positions, live P&L, total returns, and portfolio summary.",
    {
      status: z
        .enum(["OPEN", "CLOSED", "ALL"])
        .default("ALL")
        .describe("Filter trades by status"),
    },
    async ({ status }) => {
      try {
        let allTrades: any[];
        if (status === "ALL") {
          allTrades = await db.select().from(trades).orderBy(desc(trades.entryTime));
        } else {
          allTrades = await db
            .select()
            .from(trades)
            .where(eq(trades.status, status))
            .orderBy(desc(trades.entryTime));
        }

        // Fetch live prices for open positions
        const openSymbols = [...new Set(allTrades.filter((t) => t.status === "OPEN").map((t) => t.symbol))];
        const livePrices: Record<string, number> = {};
        await Promise.all(
          openSymbols.map(async (sym) => {
            livePrices[sym] = await getLivePrice(sym);
          })
        );

        const formattedTrades = allTrades.map((t) => {
          const livePrice = t.status === "OPEN" ? (livePrices[t.symbol] ?? null) : null;
          const exitPrice = t.status === "OPEN" ? livePrice : t.exitPrice;
          let unrealizedPnl: number | null = null;
          if (t.status === "OPEN" && livePrice) {
            unrealizedPnl =
              t.action === "BUY"
                ? Math.round((livePrice - t.price) * t.quantity * 100) / 100
                : Math.round((t.price - livePrice) * t.quantity * 100) / 100;
          }
          return {
            id: t.id,
            symbol: t.symbol,
            action: t.action,
            quantity: t.quantity,
            entryPrice: t.price,
            exitPrice,
            currentPrice: livePrice,
            stopLoss: t.stopLoss,
            takeProfit: t.takeProfit,
            status: t.status,
            realizedPnl: t.pnl ?? null,
            unrealizedPnl,
            entryTime: t.entryTime.toISOString(),
            exitTime: t.exitTime?.toISOString() ?? null,
          };
        });

        const totalRealizedPnl = formattedTrades
          .filter((t) => t.realizedPnl !== null)
          .reduce((acc, t) => acc + t.realizedPnl!, 0);
        const totalUnrealizedPnl = formattedTrades
          .filter((t) => t.unrealizedPnl !== null)
          .reduce((acc, t) => acc + t.unrealizedPnl!, 0);

        const summary = {
          totalTrades: formattedTrades.length,
          openPositions: formattedTrades.filter((t) => t.status === "OPEN").length,
          closedPositions: formattedTrades.filter((t) => t.status === "CLOSED").length,
          totalRealizedPnl: Math.round(totalRealizedPnl * 100) / 100,
          totalUnrealizedPnl: Math.round(totalUnrealizedPnl * 100) / 100,
          totalPnl: Math.round((totalRealizedPnl + totalUnrealizedPnl) * 100) / 100,
          winRate:
            formattedTrades.filter((t) => t.status === "CLOSED").length > 0
              ? Math.round(
                  (formattedTrades.filter((t) => t.status === "CLOSED" && (t.realizedPnl ?? 0) > 0).length /
                    formattedTrades.filter((t) => t.status === "CLOSED").length) *
                    100
                ) + "%"
              : "N/A",
          trades: formattedTrades,
        };

        return {
          content: [{ type: "text" as const, text: JSON.stringify(summary, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching portfolio: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

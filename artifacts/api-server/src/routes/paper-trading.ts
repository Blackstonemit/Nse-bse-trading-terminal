import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { trades } from "@workspace/db";
import { eq, desc, and } from "drizzle-orm";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();
const router: IRouter = Router();

const INDEX_MAP: Record<string, string> = {
  NIFTY: "^NSEI",
  NIFTY50: "^NSEI",
  BANKNIFTY: "^NSEBANK",
  FINNIFTY: "^CNXFIN",
  MIDCPNIFTY: "^NSEMDCP50",
  SENSEX: "^BSESN",
  NIFTYMID: "^NSEMDCP50",
  NIFTYIT: "^CNXIT",
};

export function toYahooSymbol(symbol: string): string {
  const cleanSymbol = symbol.toUpperCase().trim();
  if (INDEX_MAP[cleanSymbol]) return INDEX_MAP[cleanSymbol];
  if (symbol.includes(".")) return symbol;
  return `${symbol}.NS`;
}

export async function getLivePrice(symbol: string): Promise<number> {
  try {
    const yahooSym = toYahooSymbol(symbol);
    const q = await yahooFinance.quote(yahooSym);
    return q.regularMarketPrice ?? q.regularMarketPreviousClose ?? 0;
  } catch {
    return 0;
  }
}

export async function syncOpenTrades(userId: string): Promise<Record<string, number>> {
  try {
    const openTrades = await db
      .select()
      .from(trades)
      .where(and(eq(trades.status, "OPEN"), eq(trades.userId, userId)));

    const openSymbols = Array.from(new Set(openTrades.map((t) => t.symbol)));
    const symbolPrices: Record<string, number> = {};

    if (openSymbols.length > 0) {
      await Promise.all(
        openSymbols.map(async (sym) => {
          const price = await getLivePrice(sym);
          if (price > 0) {
            symbolPrices[sym] = price;
          }
        })
      );

      for (const t of openTrades) {
        const livePrice = symbolPrices[t.symbol] || null;
        if (livePrice && livePrice > 0) {
          let shouldClose = false;
          let exitPrice = livePrice;
          let currentMaxPrice = t.maxPrice ?? t.price;

          if (t.action === "BUY") {
            if (livePrice > currentMaxPrice) {
              currentMaxPrice = livePrice;
              await db.update(trades).set({ maxPrice: currentMaxPrice }).where(eq(trades.id, t.id));
            }

            if (t.stopLoss && livePrice <= t.stopLoss) {
              shouldClose = true;
              exitPrice = t.stopLoss;
            } else if (t.takeProfit && livePrice >= t.takeProfit) {
              shouldClose = true;
              exitPrice = t.takeProfit;
            } else if (t.trailingStop && livePrice <= (currentMaxPrice - t.trailingStop)) {
              shouldClose = true;
              exitPrice = currentMaxPrice - t.trailingStop;
            }
          } else if (t.action === "SELL") {
            // For shorts, maxPrice acts as minPrice (trough)
            if (livePrice < currentMaxPrice) {
              currentMaxPrice = livePrice;
              await db.update(trades).set({ maxPrice: currentMaxPrice }).where(eq(trades.id, t.id));
            }

            if (t.stopLoss && livePrice >= t.stopLoss) {
              shouldClose = true;
              exitPrice = t.stopLoss;
            } else if (t.takeProfit && livePrice <= t.takeProfit) {
              shouldClose = true;
              exitPrice = t.takeProfit;
            } else if (t.trailingStop && livePrice >= (currentMaxPrice + t.trailingStop)) {
              shouldClose = true;
              exitPrice = currentMaxPrice + t.trailingStop;
            }
          }

          if (shouldClose) {
            const qty = t.quantity;
            let pnl = 0;
            if (t.action === "BUY") {
              pnl = (exitPrice - t.price) * qty;
            } else {
              pnl = (t.price - exitPrice) * qty;
            }

            await db
              .update(trades)
              .set({
                status: "CLOSED",
                exitPrice: exitPrice,
                exitTime: new Date(),
                pnl: Math.round(pnl * 100) / 100,
              })
              .where(eq(trades.id, t.id));
          }
        }
      }
    }

    return symbolPrices;
  } catch {
    return {};
  }
}

router.get("/paper/trades", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const status = req.query.status as string;

    // First sync the open trades with their latest prices & run triggers
    const symbolPrices = await syncOpenTrades(userId);

    let query;
    if (status === "OPEN" || status === "CLOSED") {
      query = db
        .select()
        .from(trades)
        .where(and(eq(trades.status, status), eq(trades.userId, userId)))
        .orderBy(desc(trades.entryTime));
    } else {
      query = db
        .select()
        .from(trades)
        .where(eq(trades.userId, userId))
        .orderBy(desc(trades.entryTime));
    }
    const results = await query;

    res.json(
      results.map((t) => {
        const livePrice = t.status === "OPEN" ? (symbolPrices[t.symbol] || null) : null;
        return {
          ...t,
          exitPrice: t.status === "OPEN" ? livePrice : t.exitPrice,
          entryTime: t.entryTime.toISOString(),
          exitTime: t.exitTime ? t.exitTime.toISOString() : null,
        };
      })
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch paper trades");
    res.status(500).json({ error: "Failed to fetch paper trades" });
  }
});

router.post("/paper/trade", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const {
      symbol,
      action,
      price,
      quantity,
      type = "MARKET",
      signalId = null,
      stopLoss = null,
      takeProfit = null,
      trailingStop = null,
    } = req.body;

    if (!symbol || !action || !price || !quantity) {
      res.status(400).json({ error: "symbol, action, price, and quantity are required" });
      return;
    }

    const [trade] = await db
      .insert(trades)
      .values({
        userId,
        symbol: symbol.toUpperCase(),
        action: action.toUpperCase() as "BUY" | "SELL",
        price: Number(price),
        quantity: Number(quantity),
        type,
        signalId: signalId ? Number(signalId) : null,
        status: "OPEN",
        stopLoss: stopLoss ? Number(stopLoss) : null,
        takeProfit: takeProfit ? Number(takeProfit) : null,
        trailingStop: trailingStop ? Number(trailingStop) : null,
        maxPrice: Number(price),
      })
      .returning();

    res.status(201).json({
      ...trade,
      entryTime: trade.entryTime.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to execute paper trade");
    res.status(500).json({ error: "Failed to execute paper trade" });
  }
});

router.post("/paper/trade/:id/close", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const id = Number(req.params.id);
    const { exitPrice } = req.body;

    if (!exitPrice) {
      res.status(400).json({ error: "exitPrice is required" });
      return;
    }

    const [existing] = await db
      .select()
      .from(trades)
      .where(and(eq(trades.id, id), eq(trades.userId, userId)));

    if (!existing) {
      res.status(404).json({ error: "Trade not found" });
      return;
    }

    if (existing.status === "CLOSED") {
      res.status(400).json({ error: "Trade is already closed" });
      return;
    }

    const price = Number(exitPrice);
    const qty = existing.quantity;
    const action = existing.action;

    let pnl = 0;
    if (action === "BUY") {
      pnl = (price - existing.price) * qty;
    } else {
      pnl = (existing.price - price) * qty;
    }

    const [updated] = await db
      .update(trades)
      .set({
        status: "CLOSED",
        exitPrice: price,
        exitTime: new Date(),
        pnl: Math.round(pnl * 100) / 100,
      })
      .where(and(eq(trades.id, id), eq(trades.userId, userId)))
      .returning();

    res.json({
      ...updated,
      entryTime: updated.entryTime.toISOString(),
      exitTime: updated.exitTime?.toISOString() ?? null,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to close paper trade");
    res.status(500).json({ error: "Failed to close paper trade" });
  }
});

router.get("/paper/performance", async (req: any, res) => {
  try {
    const userId = req.user!.id;

    // Sync first to close any stop-losses or trailing stops hit
    const symbolPrices = await syncOpenTrades(userId);

    const allTrades = await db
      .select()
      .from(trades)
      .where(eq(trades.userId, userId));

    const openTrades = allTrades.filter((t) => t.status === "OPEN");
    const closedTrades = allTrades.filter((t) => t.status === "CLOSED");

    let openPnL = 0;
    openTrades.forEach((t) => {
      const currentPrice = symbolPrices[t.symbol] || t.price;
      if (t.action === "BUY") {
        openPnL += (currentPrice - t.price) * t.quantity;
      } else {
        openPnL += (t.price - currentPrice) * t.quantity;
      }
    });

    const realizedPnL = closedTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const winTrades = closedTrades.filter((t) => (t.pnl || 0) > 0).length;
    const winRate = closedTrades.length > 0 ? (winTrades / closedTrades.length) * 100 : 0;

    const startBalance = 1000000;
    const accountBalance = startBalance + realizedPnL;
    const totalEquity = accountBalance + openPnL;

    res.json({
      startBalance,
      accountBalance: Math.round(accountBalance * 100) / 100,
      totalEquity: Math.round(totalEquity * 100) / 100,
      openPnL: Math.round(openPnL * 100) / 100,
      realizedPnL: Math.round(realizedPnL * 100) / 100,
      totalTrades: allTrades.length,
      openTradesCount: openTrades.length,
      closedTradesCount: closedTrades.length,
      winRate: Math.round(winRate * 10) / 10,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get paper trading performance");
    res.status(500).json({ error: "Failed to get performance metrics" });
  }
});

export default router;

import { Router, type IRouter } from "express";
import { AddToWatchlistBody, RemoveFromWatchlistParams } from "@workspace/api-zod";
import { db } from "@workspace/db";
import { watchlist } from "@workspace/db";
import { eq, and } from "drizzle-orm";

const router: IRouter = Router();

router.get("/watchlist", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const items = await db
      .select()
      .from(watchlist)
      .where(eq(watchlist.userId, userId))
      .orderBy(watchlist.addedAt);
      
    res.json(
      items.map((item) => ({
        ...item,
        addedAt: item.addedAt.toISOString(),
      }))
    );
  } catch (err) {
    req.log.error({ err }, "Failed to fetch watchlist");
    res.status(500).json({ error: "Failed to fetch watchlist" });
  }
});

router.post("/watchlist", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const body = AddToWatchlistBody.parse(req.body);
    const [item] = await db
      .insert(watchlist)
      .values({
        userId,
        symbol: body.symbol.toUpperCase(),
        name: body.name,
        exchange: body.exchange ?? "NSE",
        instrumentType: body.instrumentType ?? "STOCK",
      })
      .returning();

    res.status(201).json({
      ...item,
      addedAt: item.addedAt.toISOString(),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to add to watchlist");
    res.status(500).json({ error: "Failed to add to watchlist" });
  }
});

router.delete("/watchlist/:id", async (req: any, res) => {
  try {
    const userId = req.user!.id;
    const params = RemoveFromWatchlistParams.parse({ id: req.params.id });
    await db
      .delete(watchlist)
      .where(and(eq(watchlist.id, params.id), eq(watchlist.userId, userId)));
      
    res.status(204).end();
  } catch (err) {
    req.log.error({ err }, "Failed to remove from watchlist");
    res.status(500).json({ error: "Failed to remove from watchlist" });
  }
});

export default router;

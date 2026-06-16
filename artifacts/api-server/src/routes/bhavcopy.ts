import { Router, type IRouter } from "express";
import { db, bhavcopyRecords } from "@workspace/db";
import { eq, desc, inArray, sql } from "drizzle-orm";

const router: IRouter = Router();

router.post("/bhavcopy/upload", async (req: any, res) => {
  try {
    const { date, rows } = req.body;
    if (!date || !Array.isArray(rows) || rows.length === 0) {
      res.status(400).json({ error: "date and rows are required" });
      return;
    }

    // Clean up any existing records for this date first
    await db.delete(bhavcopyRecords).where(eq(bhavcopyRecords.date, date));

    // Batch insert rows in chunks of 200 to prevent SQLite variable limits
    const chunkSize = 200;
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize).map((r: any) => ({
        symbol: r.symbol,
        series: r.series,
        date: r.date || date,
        prevClose: Number(r.prevClose),
        open: Number(r.open),
        high: Number(r.high),
        low: Number(r.low),
        close: Number(r.close),
        avgPrice: Number(r.avgPrice || 0),
        volume: Number(r.volume),
        turnoverLacs: Number(r.turnoverLacs),
        trades: Number(r.trades || 0),
        delivQty: Number(r.delivQty || 0),
        delivPer: Number(r.delivPer || 0),
        changeAbs: Number(r.changeAbs),
        changePct: Number(r.changePct),
      }));
      await db.insert(bhavcopyRecords).values(chunk);
    }

    res.status(201).json({ success: true, count: rows.length });
  } catch (err) {
    req.log.error({ err }, "Failed to upload bhavcopy data");
    res.status(500).json({ error: "Failed to store bhavcopy data" });
  }
});

router.get("/bhavcopy/screener", async (req: any, res) => {
  try {
    // Get last 5 uploaded dates
    const datesResult = await db
      .select({ date: bhavcopyRecords.date })
      .from(bhavcopyRecords)
      .groupBy(bhavcopyRecords.date)
      .orderBy(desc(bhavcopyRecords.date))
      .limit(5);

    if (datesResult.length === 0) {
      res.json({
        date: null,
        datesCount: 0,
        volumeSurges: [],
        deliveryBreakouts: [],
      });
      return;
    }

    const latestDate = datesResult[0].date;
    const latestRecords = await db
      .select()
      .from(bhavcopyRecords)
      .where(eq(bhavcopyRecords.date, latestDate));

    const avgMap: Record<string, { avgVolume: number; avgDeliv: number }> = {};
    
    if (datesResult.length > 1) {
      const pastDates = datesResult.slice(1).map((d) => d.date);
      const history = await db
        .select({
          symbol: bhavcopyRecords.symbol,
          avgVolume: sql<number>`AVG(volume)`,
          avgDeliv: sql<number>`AVG(deliv_per)`,
        })
        .from(bhavcopyRecords)
        .where(inArray(bhavcopyRecords.date, pastDates))
        .groupBy(bhavcopyRecords.symbol);

      for (const h of history) {
        avgMap[h.symbol] = {
          avgVolume: h.avgVolume || 0,
          avgDeliv: h.avgDeliv || 0,
        };
      }
    }

    const volumeSurges = latestRecords
      .map((r) => {
        const avg = avgMap[r.symbol];
        const ratio = avg && avg.avgVolume > 0 ? r.volume / avg.avgVolume : 1.0;
        return {
          symbol: r.symbol,
          series: r.series,
          close: r.close,
          changePct: r.changePct,
          volume: r.volume,
          avgVolume: avg ? Math.round(avg.avgVolume) : r.volume,
          volumeRatio: Math.round(ratio * 100) / 100,
          delivPer: r.delivPer,
        };
      })
      .filter((r) => r.volumeRatio > 1.0 && r.volume > 10000 && r.series === "EQ")
      .sort((a, b) => b.volumeRatio - a.volumeRatio)
      .slice(0, 50);

    const deliveryBreakouts = latestRecords
      .filter((r) => r.delivPer >= 45 && r.changePct > 0.5 && r.volume > 10000 && r.series === "EQ")
      .sort((a, b) => b.delivPer - a.delivPer)
      .slice(0, 50);

    res.json({
      date: latestDate,
      datesCount: datesResult.length,
      volumeSurges,
      deliveryBreakouts,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to execute bhavcopy screener");
    res.status(500).json({ error: "Failed to run screener analysis" });
  }
});

export default router;

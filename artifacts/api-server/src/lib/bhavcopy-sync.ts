import { db, bhavcopyRecords } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { logger } from "./logger.js";

interface BhavRow {
  symbol: string;
  series: string;
  date: string;
  prevClose: number;
  open: number;
  high: number;
  low: number;
  close: number;
  avgPrice: number;
  volume: number;
  turnoverLacs: number;
  trades: number;
  delivQty: number;
  delivPer: number;
  changeAbs: number;
  changePct: number;
}

export async function syncLatestBhavcopy(daysToSync: number = 3): Promise<{ success: boolean; datesSynced: string[]; totalRecords: number }> {
  logger.info("Checking NSE official Bhavcopy archive sync status...");

  const datesSynced: string[] = [];
  let totalRecords = 0;

  const today = new Date();

  for (let offset = 0; offset <= 7 && datesSynced.length < daysToSync; offset++) {
    const target = new Date(today);
    target.setDate(target.getDate() - offset);

    // Skip Saturday (6) and Sunday (0)
    if (target.getDay() === 0 || target.getDay() === 6) continue;

    // If target is today and current time is before 18:00 IST (market close + reporting time), skip today's EOD
    const targetIsToday = target.toDateString() === today.toDateString();
    if (targetIsToday && (today.getHours() < 18)) {
      continue;
    }

    const dd = String(target.getDate()).padStart(2, "0");
    const mm = String(target.getMonth() + 1).padStart(2, "0");
    const yyyy = target.getFullYear();
    const dateFileStr = `${dd}${mm}${yyyy}`;
    const isoDate = `${yyyy}-${mm}-${dd}`;

    // Check if we already have records for this date
    const existing = await db
      .select({ id: bhavcopyRecords.id })
      .from(bhavcopyRecords)
      .where(eq(bhavcopyRecords.date, isoDate))
      .limit(1);

    if (existing.length > 0) {
      logger.debug({ isoDate }, "Bhavcopy already cached for date, skipping download");
      datesSynced.push(isoDate);
      continue;
    }

    const url = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${dateFileStr}.csv`;
    logger.info({ url, isoDate }, "Downloading official NSE Bhavcopy archive...");

    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept": "text/csv,text/plain,*/*",
        },
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (!res.ok) {
        logger.debug({ status: res.status, url }, "Bhavcopy not available for date yet (holiday or pending)");
        continue;
      }

      const csvText = await res.text();
      const lines = csvText.split("\n");
      if (lines.length < 2) continue;

      const headers = lines[0].split(",").map((h) => h.trim().toUpperCase());
      const symIdx = headers.indexOf("SYMBOL");
      const serIdx = headers.indexOf("SERIES");
      const prevCloseIdx = headers.indexOf("PREV_CLOSE");
      const openIdx = headers.indexOf("OPEN_PRICE");
      const highIdx = headers.indexOf("HIGH_PRICE");
      const lowIdx = headers.indexOf("LOW_PRICE");
      const closeIdx = headers.indexOf("CLOSE_PRICE");
      const avgIdx = headers.indexOf("AVG_PRICE");
      const volIdx = headers.indexOf("TTL_TRD_QNTY");
      const turnIdx = headers.indexOf("TURNOVER_LACS");
      const tradesIdx = headers.indexOf("NO_OF_TRADES");
      const delivQtyIdx = headers.indexOf("DELIV_QTY");
      const delivPerIdx = headers.indexOf("DELIV_PER");

      const parsedRows: BhavRow[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const cols = line.split(",").map((c) => c.trim());
        const series = cols[serIdx] || "";

        // Only store standard equity ('EQ') and SME equities
        if (series !== "EQ" && series !== "SM" && series !== "BE") continue;

        const symbol = cols[symIdx];
        if (!symbol) continue;

        const prevClose = parseFloat(cols[prevCloseIdx]) || 0;
        const open = parseFloat(cols[openIdx]) || prevClose;
        const high = parseFloat(cols[highIdx]) || open;
        const low = parseFloat(cols[lowIdx]) || open;
        const close = parseFloat(cols[closeIdx]) || prevClose;
        const avgPrice = parseFloat(cols[avgIdx]) || close;
        const volume = parseInt(cols[volIdx], 10) || 0;
        const turnoverLacs = parseFloat(cols[turnIdx]) || 0;
        const trades = parseInt(cols[tradesIdx], 10) || 0;
        const delivQty = parseInt(cols[delivQtyIdx], 10) || 0;
        const delivPer = parseFloat(cols[delivPerIdx]) || 0;

        const changeAbs = close - prevClose;
        const changePct = prevClose > 0 ? (changeAbs / prevClose) * 100 : 0;

        parsedRows.push({
          symbol,
          series,
          date: isoDate,
          prevClose,
          open,
          high,
          low,
          close,
          avgPrice,
          volume,
          turnoverLacs,
          trades,
          delivQty,
          delivPer,
          changeAbs,
          changePct,
        });
      }

      if (parsedRows.length > 0) {
        // Delete any partial records for this date
        await db.delete(bhavcopyRecords).where(eq(bhavcopyRecords.date, isoDate));

        // Insert in batches of 200
        const chunkSize = 200;
        for (let i = 0; i < parsedRows.length; i += chunkSize) {
          const chunk = parsedRows.slice(i, i + chunkSize);
          await db.insert(bhavcopyRecords).values(chunk);
        }

        totalRecords += parsedRows.length;
        datesSynced.push(isoDate);
        logger.info({ isoDate, count: parsedRows.length }, "Bhavcopy successfully synced and saved to database");
      }
    } catch (err: any) {
      logger.warn({ url, err: err.message }, "Error during Bhavcopy download");
    }
  }

  return {
    success: datesSynced.length > 0,
    datesSynced,
    totalRecords,
  };
}

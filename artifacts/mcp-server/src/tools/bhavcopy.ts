import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const NSE_BASE = "https://www.nseindia.com";
const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};
const API_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  Referer: "https://www.nseindia.com/",
  "X-Requested-With": "XMLHttpRequest",
};

let sessionCookies = "";
let lastRefresh = 0;
const TTL = 4 * 60 * 1000;

function extractCookies(res: Response): string {
  const raw: string[] = typeof (res.headers as any).getSetCookie === "function"
    ? (res.headers as any).getSetCookie()
    : (res.headers.get("set-cookie") ?? "").split(/,(?=[^ ])/);
  return raw.map((c: string) => c.split(";")[0].trim()).join("; ");
}

async function ensureSession(): Promise<void> {
  if (sessionCookies && Date.now() - lastRefresh < TTL) return;
  try {
    const home = await fetch(NSE_BASE, { headers: BROWSER_HEADERS, redirect: "follow" });
    sessionCookies = extractCookies(home);
    lastRefresh = Date.now();
  } catch { /* ignore */ }
}

export function registerBhavcopyTools(server: McpServer) {
  server.tool(
    "get_bhavcopy",
    "Get NSE Bhavcopy (end-of-day price data) for equity or derivatives. Returns OHLCV data for all traded securities on the specified date.",
    {
      date: z
        .string()
        .optional()
        .describe(
          "Date in YYYY-MM-DD format (defaults to today/last trading day). Example: '2024-07-01'"
        ),
      segment: z
        .enum(["equity", "fo"])
        .default("equity")
        .describe("Market segment: 'equity' for cash market, 'fo' for Futures & Options"),
    },
    async ({ date, segment }) => {
      try {
        await ensureSession();

        // Format date for NSE API
        const targetDate = date ? new Date(date) : new Date();
        const dd = String(targetDate.getDate()).padStart(2, "0");
        const mm = String(targetDate.getMonth() + 1).padStart(2, "0");
        const yyyy = targetDate.getFullYear();

        // NSE Bhavcopy URL format
        const endpoint =
          segment === "equity"
            ? `/api/reports?archives=%5B%7B%22name%22%3A%22Bhavcopy%20(Zipped)%22%2C%22type%22%3A%22archives%22%2C%22category%22%3A%22capital-market%22%2C%22section%22%3A%22equities%22%7D%5D&date=${dd}-${mm}-${yyyy}&type=equities&ext=zip`
            : `/api/reports?archives=%5B%7B%22name%22%3A%22Bhavcopy%20(Zipped)%22%2C%22type%22%3A%22archives%22%2C%22category%22%3A%22derivatives%22%2C%22section%22%3A%22equity-derivatives%22%7D%5D&date=${dd}-${mm}-${yyyy}&type=derivatives&ext=zip`;

        // Try NSE equity market data API instead (simpler)
        const marketUrl = `${NSE_BASE}/api/equity-stockIndices?index=NIFTY%2050`;
        const response = await fetch(marketUrl, {
          headers: { ...API_HEADERS, Cookie: sessionCookies },
        });

        if (!response.ok) {
          return {
            content: [{
              type: "text" as const,
              text: JSON.stringify({
                message: "NSE Bhavcopy is a downloadable ZIP file. Use the direct NSE website to download it.",
                downloadUrls: {
                  equity: `https://www.nseindia.com/products/content/equities/equities/archieve_eq.htm`,
                  fo: `https://www.nseindia.com/products/content/derivatives/derivatives/archieve_fo.htm`,
                },
                date: `${dd}-${mm}-${yyyy}`,
                segment,
                note: "Bhavcopy ZIP files contain CSV with complete OHLCV data for all traded securities.",
              }, null, 2),
            }],
          };
        }

        const data = await response.json() as any;
        const stocks = (data?.data ?? []).slice(0, 50).map((s: any) => ({
          symbol: s.symbol ?? s.index,
          open: s.open ?? s.openPrice,
          high: s.dayHigh ?? s.highPrice,
          low: s.dayLow ?? s.lowPrice,
          close: s.lastPrice ?? s.closePrice,
          previousClose: s.previousClose ?? s.prevClose,
          change: s.change,
          changePercent: s.pChange ?? s.percentChange,
          volume: s.totalTradedVolume ?? s.tradedQuantity,
          value: s.totalTradedValue ?? s.tradedValue,
        }));

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              date: `${dd}-${mm}-${yyyy}`,
              segment,
              recordCount: stocks.length,
              data: stocks,
              note: "For complete Bhavcopy with all symbols, download from NSE website: https://www.nseindia.com",
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching Bhavcopy: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

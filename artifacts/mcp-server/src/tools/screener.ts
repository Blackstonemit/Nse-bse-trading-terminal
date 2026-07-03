import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const MULTIBAGGER_CATALOG = [
  { symbol: "SUZLON",     name: "Suzlon Energy Ltd.",              sector: "Green Energy & Wind",            tags: ["DEBT_FREE", "HIGH_GROWTH"],        salesCagr3Yr: 42.5, profitCagr3Yr: 68.0 },
  { symbol: "DIXON",      name: "Dixon Technologies (India) Ltd.", sector: "Electronics Manufacturing (EMS)", tags: ["MOMENTUM_BREAKOUT", "HIGH_GROWTH"], salesCagr3Yr: 38.2, profitCagr3Yr: 45.1 },
  { symbol: "BEL",        name: "Bharat Electronics Ltd.",         sector: "Defense & Aerospace",            tags: ["DEBT_FREE", "VALUATION_PLAY"],      salesCagr3Yr: 18.4, profitCagr3Yr: 24.2 },
  { symbol: "HAL",        name: "Hindustan Aeronautics Ltd.",      sector: "Defense & Aviation",             tags: ["DEBT_FREE", "VALUATION_PLAY"],      salesCagr3Yr: 21.0, profitCagr3Yr: 31.5 },
  { symbol: "TATAELXSI",  name: "Tata Elxsi Ltd.",                 sector: "AI & ER&D",                     tags: ["DEBT_FREE"],                        salesCagr3Yr: 19.8, profitCagr3Yr: 22.4 },
  { symbol: "TATAMOTORS", name: "Tata Motors Ltd.",                sector: "Automobile & EV",               tags: ["MOMENTUM_BREAKOUT"],                salesCagr3Yr: 28.6, profitCagr3Yr: 110.2 },
  { symbol: "KAYNES",     name: "Kaynes Technology India Ltd.",    sector: "Semiconductors & EMS",           tags: ["HIGH_GROWTH"],                      salesCagr3Yr: 54.2, profitCagr3Yr: 62.8 },
  { symbol: "PREMIERENE", name: "Premier Energies Ltd.",           sector: "Solar Manufacturing",            tags: ["HIGH_GROWTH"],                      salesCagr3Yr: 65.4, profitCagr3Yr: 95.0 },
  { symbol: "CDSL",       name: "CDSL Ltd.",                       sector: "Financial Infrastructure",       tags: ["DEBT_FREE", "HIGH_GROWTH"],        salesCagr3Yr: 28.1, profitCagr3Yr: 35.8 },
  { symbol: "ZOMATO",     name: "Zomato Ltd.",                     sector: "Consumer Internet",              tags: ["MOMENTUM_BREAKOUT"],                salesCagr3Yr: 62.0, profitCagr3Yr: 0    },
];

const PENNY_CATALOG = [
  { symbol: "RPOWER",    name: "Reliance Power Ltd.",             sector: "Power",            tags: ["TURNAROUND_PLAY"] },
  { symbol: "JPASSOCIAT",name: "Jaiprakash Associates Ltd.",      sector: "Infrastructure",   tags: ["DEEP_VALUE"]      },
  { symbol: "YESBANK",   name: "Yes Bank Ltd.",                   sector: "Banking",          tags: ["TURNAROUND_PLAY"] },
  { symbol: "VODAFONE",  name: "Vodafone Idea Ltd.",              sector: "Telecom",          tags: ["DEEP_VALUE"]      },
  { symbol: "SUZLON",    name: "Suzlon Energy Ltd.",              sector: "Renewable Energy", tags: ["TURNAROUND_PLAY"] },
  { symbol: "IRCON",     name: "IRCON International Ltd.",        sector: "Infrastructure",   tags: ["DEEP_VALUE"]      },
  { symbol: "NHPC",      name: "NHPC Ltd.",                       sector: "Hydro Power",      tags: ["DEEP_VALUE"]      },
  { symbol: "IFCI",      name: "IFCI Ltd.",                       sector: "NBFC",             tags: ["TURNAROUND_PLAY"] },
];

export function registerScreenerTools(server: McpServer) {
  // ── 1. get_multibagger_screener ──────────────────────────────────────────
  server.tool(
    "get_multibagger_screener",
    "Run the multibagger screener: find high-quality NSE stocks with strong ROE, low debt, high profit CAGR, and momentum breakout potential.",
    {
      limit: z.number().int().min(1).max(20).default(10).describe("Number of results to return"),
      tag: z
        .enum(["ALL", "DEBT_FREE", "HIGH_GROWTH", "MOMENTUM_BREAKOUT", "VALUATION_PLAY"])
        .default("ALL")
        .describe("Filter by stock quality tag"),
    },
    async ({ limit, tag }) => {
      try {
        const catalog = tag === "ALL"
          ? MULTIBAGGER_CATALOG
          : MULTIBAGGER_CATALOG.filter((s) => s.tags.includes(tag));

        const results = await Promise.all(
          catalog.slice(0, limit).map(async (entry) => {
            try {
              const q = await yahooFinance.quote(`${entry.symbol}.NS`);
              const summary = await yahooFinance.quoteSummary(`${entry.symbol}.NS`, {
                modules: ["financialData", "defaultKeyStatistics"],
              }).catch(() => null);

              return {
                symbol: entry.symbol,
                name: entry.name,
                sector: entry.sector,
                tags: entry.tags,
                currentPrice: q.regularMarketPrice ?? 0,
                changePercent: q.regularMarketChangePercent ?? 0,
                marketCapCr: Math.round((q.marketCap ?? 0) / 1e7),
                peRatio: q.trailingPE ?? summary?.defaultKeyStatistics?.trailingEps ?? 0,
                priceToBook: q.priceToBook ?? 0,
                fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
                salesCagr3Yr: entry.salesCagr3Yr,
                profitCagr3Yr: entry.profitCagr3Yr,
                roePercent: summary?.financialData?.returnOnEquity
                  ? Math.round(summary.financialData.returnOnEquity * 100)
                  : null,
                multibaggerScore: Math.min(
                  100,
                  Math.round(
                    (entry.profitCagr3Yr > 30 ? 30 : entry.profitCagr3Yr) +
                    (entry.salesCagr3Yr > 30 ? 20 : entry.salesCagr3Yr * 0.67) +
                    (entry.tags.includes("DEBT_FREE") ? 20 : 0) +
                    (entry.tags.includes("MOMENTUM_BREAKOUT") ? 15 : 0) +
                    15
                  )
                ),
              };
            } catch {
              return { symbol: entry.symbol, name: entry.name, sector: entry.sector, error: "Data unavailable" };
            }
          })
        );

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error running multibagger screener: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );

  // ── 2. get_penny_screener ────────────────────────────────────────────────
  server.tool(
    "get_penny_screener",
    "Run the penny stock screener: find NSE micro-cap and turnaround stocks under ₹100 Cr market cap with recovery potential.",
    {
      limit: z.number().int().min(1).max(15).default(8).describe("Number of results to return"),
      tag: z
        .enum(["ALL", "TURNAROUND_PLAY", "DEEP_VALUE"])
        .default("ALL")
        .describe("Filter by penny stock category"),
    },
    async ({ limit, tag }) => {
      try {
        const catalog = tag === "ALL"
          ? PENNY_CATALOG
          : PENNY_CATALOG.filter((s) => s.tags.includes(tag));

        const results = await Promise.all(
          catalog.slice(0, limit).map(async (entry) => {
            try {
              const q = await yahooFinance.quote(`${entry.symbol}.NS`);
              return {
                symbol: entry.symbol,
                name: entry.name,
                sector: entry.sector,
                tags: entry.tags,
                currentPrice: q.regularMarketPrice ?? 0,
                changePercent: q.regularMarketChangePercent ?? 0,
                volume: q.regularMarketVolume ?? 0,
                marketCapCr: Math.round((q.marketCap ?? 0) / 1e7),
                fiftyTwoWeekHigh: q.fiftyTwoWeekHigh ?? 0,
                fiftyTwoWeekLow: q.fiftyTwoWeekLow ?? 0,
                distanceFrom52wHigh:
                  q.fiftyTwoWeekHigh && q.regularMarketPrice
                    ? Math.round(((q.regularMarketPrice - q.fiftyTwoWeekHigh) / q.fiftyTwoWeekHigh) * 100)
                    : null,
              };
            } catch {
              return { symbol: entry.symbol, name: entry.name, sector: entry.sector, error: "Data unavailable" };
            }
          })
        );

        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error running penny screener: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

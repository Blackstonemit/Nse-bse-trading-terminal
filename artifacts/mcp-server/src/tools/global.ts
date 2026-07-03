import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const GLOBAL_INDICES = [
  { name: "S&P 500",           yahoo: "^GSPC",   country: "USA",     currency: "USD" },
  { name: "Dow Jones",         yahoo: "^DJI",    country: "USA",     currency: "USD" },
  { name: "NASDAQ Composite",  yahoo: "^IXIC",   country: "USA",     currency: "USD" },
  { name: "FTSE 100",          yahoo: "^FTSE",   country: "UK",      currency: "GBP" },
  { name: "DAX",               yahoo: "^GDAXI",  country: "Germany", currency: "EUR" },
  { name: "Nikkei 225",        yahoo: "^N225",   country: "Japan",   currency: "JPY" },
  { name: "Hang Seng",         yahoo: "^HSI",    country: "HK",      currency: "HKD" },
  { name: "Shanghai Composite",yahoo: "000001.SS",country: "China",  currency: "CNY" },
  { name: "CAC 40",            yahoo: "^FCHI",   country: "France",  currency: "EUR" },
  { name: "ASX 200",           yahoo: "^AXJO",   country: "Australia",currency: "AUD" },
  { name: "SGX Nifty",         yahoo: "^SNSE",   country: "Singapore",currency: "USD" },
  { name: "Crude Oil WTI",     yahoo: "CL=F",    country: "Global",  currency: "USD" },
  { name: "Gold",              yahoo: "GC=F",    country: "Global",  currency: "USD" },
  { name: "USD/INR",           yahoo: "USDINR=X",country: "India",   currency: "INR" },
];

export function registerGlobalTools(server: McpServer) {
  server.tool(
    "get_global_markets",
    "Get live levels of major global stock indices, commodities (crude oil, gold), and USD/INR exchange rate. Shows market direction before Indian market opens.",
    {},
    async () => {
      try {
        const results = await Promise.all(
          GLOBAL_INDICES.map(async (idx) => {
            try {
              const q = await yahooFinance.quote(idx.yahoo);
              return {
                name: idx.name,
                country: idx.country,
                currency: idx.currency,
                value: q.regularMarketPrice ?? 0,
                change: Math.round((q.regularMarketChange ?? 0) * 100) / 100,
                changePercent: Math.round((q.regularMarketChangePercent ?? 0) * 100) / 100,
                previousClose: q.regularMarketPreviousClose ?? 0,
                direction: (q.regularMarketChangePercent ?? 0) > 0 ? "▲" : (q.regularMarketChangePercent ?? 0) < 0 ? "▼" : "—",
                marketState: q.marketState ?? "UNKNOWN",
              };
            } catch {
              return { name: idx.name, country: idx.country, error: "Data unavailable" };
            }
          })
        );

        const validResults = results.filter((r) => !("error" in r));
        const positiveCount = validResults.filter((r) => ("changePercent" in r) && (r as any).changePercent > 0).length;
        const globalSentiment = positiveCount > validResults.length * 0.6 ? "RISK-ON (Bullish)" :
                                positiveCount < validResults.length * 0.4 ? "RISK-OFF (Bearish)" : "MIXED";

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({ globalSentiment, markets: results }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching global markets: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

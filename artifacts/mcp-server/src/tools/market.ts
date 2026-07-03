import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const INDEX_MAP: Record<string, string> = {
  NIFTY: "^NSEI", NIFTY50: "^NSEI", BANKNIFTY: "^NSEBANK",
  FINNIFTY: "^CNXFIN", MIDCPNIFTY: "^NSEMDCP50", SENSEX: "^BSESN",
};

export function registerMarketTools(server: McpServer) {
  server.tool(
    "get_market_quotes",
    "Get live price, day change, and volume for one or more NSE/BSE symbols (e.g., RELIANCE, TCS).",
    {
      symbols: z.array(z.string()).describe("List of stock symbols"),
    },
    async ({ symbols }) => {
      try {
        const results = await Promise.all(
          symbols.map(async (sym) => {
            try {
              const query = INDEX_MAP[sym.toUpperCase()] || (sym.includes(".") ? sym : `${sym.toUpperCase()}.NS`);
              const q = await yahooFinance.quote(query);
              return {
                symbol: sym.toUpperCase(),
                price: q.regularMarketPrice ?? 0,
                change: Math.round((q.regularMarketChange ?? 0) * 100) / 100,
                changePercent: Math.round((q.regularMarketChangePercent ?? 0) * 100) / 100,
                volume: q.regularMarketVolume ?? 0,
                dayHigh: q.regularMarketDayHigh ?? null,
                dayLow: q.regularMarketDayLow ?? null,
              };
            } catch (err) {
              return { symbol: sym.toUpperCase(), error: "Not found or data unavailable" };
            }
          })
        );
        return { content: [{ type: "text", text: JSON.stringify(results, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching quotes: ${String(err)}` }], isError: true };
      }
    }
  );

  server.tool(
    "search_symbols",
    "Search for NSE/BSE stocks by company name or partial symbol.",
    {
      query: z.string().describe("Search query (e.g. 'Tata', 'HDFC')"),
    },
    async ({ query }) => {
      try {
        const results = await yahooFinance.search(query, { quotesCount: 10, newsCount: 0 });
        const quotes = results.quotes
          .filter((q: any) => q.exchange === "NSI" || q.exchange === "BSE")
          .map((q: any) => ({
            symbol: q.symbol.replace(/\.(NS|BO)$/, ""),
            name: q.shortname || q.longname || q.symbol,
            exchange: q.exchange,
            typeDisp: q.typeDisp,
          }));
        return { content: [{ type: "text", text: JSON.stringify(quotes, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error searching symbols: ${String(err)}` }], isError: true };
      }
    }
  );
}

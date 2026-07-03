import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

const NIFTY_SECTORS = [
  { name: "Nifty Auto",        yahoo: "^CNXAUTO",   sector: "Automobile"      },
  { name: "Nifty Bank",        yahoo: "^NSEBANK",   sector: "Banking"         },
  { name: "Nifty Energy",      yahoo: "^CNXENERGY", sector: "Energy"          },
  { name: "Nifty FMCG",        yahoo: "^CNXFMCG",  sector: "FMCG"            },
  { name: "Nifty IT",          yahoo: "^CNXIT",     sector: "Information Tech"},
  { name: "Nifty Media",       yahoo: "^CNXMEDIA",  sector: "Media"           },
  { name: "Nifty Metal",       yahoo: "^CNXMETAL",  sector: "Metals"          },
  { name: "Nifty Pharma",      yahoo: "^CNXPHARMA", sector: "Pharma"          },
  { name: "Nifty PSU Bank",    yahoo: "^CNXPSUBANK",sector: "PSU Banking"     },
  { name: "Nifty Realty",      yahoo: "^CNXREALTY", sector: "Real Estate"     },
  { name: "Nifty FinServ",     yahoo: "^CNXFIN",    sector: "Financials"      },
  { name: "Nifty Consumer Dur",yahoo: "^CNXCONSUM", sector: "Consumer Durables"},
];

export function registerSectorsTools(server: McpServer) {
  server.tool(
    "get_sector_performance",
    "Get today's performance heatmap of all Nifty sectors: Auto, Bank, IT, Pharma, FMCG, Metal, Realty, Energy, and more. Identify which sectors are leading and lagging.",
    {},
    async () => {
      try {
        const results = await Promise.all(
          NIFTY_SECTORS.map(async (s) => {
            try {
              const q = await yahooFinance.quote(s.yahoo);
              return {
                name: s.name,
                sector: s.sector,
                value: q.regularMarketPrice ?? 0,
                change: Math.round((q.regularMarketChange ?? 0) * 100) / 100,
                changePercent: Math.round((q.regularMarketChangePercent ?? 0) * 100) / 100,
                direction: (q.regularMarketChangePercent ?? 0) > 0 ? "▲" : (q.regularMarketChangePercent ?? 0) < 0 ? "▼" : "—",
                strength:
                  Math.abs(q.regularMarketChangePercent ?? 0) > 2 ? "STRONG" :
                  Math.abs(q.regularMarketChangePercent ?? 0) > 0.5 ? "MODERATE" : "WEAK",
              };
            } catch {
              return { name: s.name, sector: s.sector, error: "Data unavailable" };
            }
          })
        );

        const valid = results.filter((r) => "changePercent" in r) as any[];
        const sorted = [...valid].sort((a, b) => b.changePercent - a.changePercent);

        return {
          content: [{
            type: "text" as const,
            text: JSON.stringify({
              topSectors: sorted.slice(0, 3).map((s) => s.name),
              bottomSectors: sorted.slice(-3).reverse().map((s) => s.name),
              sectors: results,
            }, null, 2),
          }],
        };
      } catch (err) {
        return {
          content: [{ type: "text" as const, text: `Error fetching sector data: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

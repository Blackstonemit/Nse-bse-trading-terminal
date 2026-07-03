import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import YahooFinanceClass from "yahoo-finance2";

const yahooFinance = new (YahooFinanceClass as any)();

export function registerFundamentalsTools(server: McpServer) {
  server.tool(
    "get_fundamental_data",
    "Get fundamental financial data for any NSE/BSE stock: P/E ratio, P/B ratio, ROE, debt-to-equity, EPS, dividend yield, revenue, profit, and valuation metrics.",
    {
      symbol: z
        .string()
        .describe("NSE stock symbol, e.g. RELIANCE, TCS, HDFCBANK, INFY"),
      exchange: z
        .enum(["NSE", "BSE"])
        .default("NSE")
        .describe("Exchange (NSE or BSE)"),
    },
    async ({ symbol, exchange }) => {
      try {
        const suffix = exchange === "BSE" ? ".BO" : ".NS";
        const yahooSym = `${symbol.toUpperCase()}${suffix}`;

        const [quote, summary] = await Promise.all([
          yahooFinance.quote(yahooSym).catch(() => null),
          yahooFinance
            .quoteSummary(yahooSym, {
              modules: [
                "financialData",
                "defaultKeyStatistics",
                "summaryDetail",
                "incomeStatementHistory",
                "balanceSheetHistory",
              ],
            })
            .catch(() => null),
        ]);

        if (!quote && !summary) {
          return {
            content: [{ type: "text", text: `No fundamental data found for ${symbol}. Verify the symbol is listed on ${exchange}.` }],
            isError: true,
          };
        }

        const fd = summary?.financialData ?? {};
        const ks = summary?.defaultKeyStatistics ?? {};
        const sd = summary?.summaryDetail ?? {};

        const result = {
          symbol: symbol.toUpperCase(),
          exchange,
          name: quote?.longName ?? quote?.shortName ?? symbol,
          sector: quote?.industry ?? "N/A",

          // Price & Valuation
          currentPrice: quote?.regularMarketPrice ?? 0,
          marketCapCr: quote?.marketCap ? Math.round(quote.marketCap / 1e7) : null,
          peRatio: quote?.trailingPE ?? sd?.trailingPE ?? null,
          forwardPE: quote?.forwardPE ?? sd?.forwardPE ?? null,
          priceToBook: quote?.priceToBook ?? ks?.priceToBook ?? null,
          priceToSales: ks?.priceToSalesTrailing12Months ?? null,
          enterpriseValue: ks?.enterpriseValue ? Math.round(ks.enterpriseValue / 1e7) + " Cr" : null,
          evToEbitda: ks?.enterpriseToEbitda ?? null,

          // Profitability
          eps: ks?.trailingEps ?? null,
          forwardEps: ks?.forwardEps ?? null,
          roe: fd?.returnOnEquity ? Math.round(fd.returnOnEquity * 1000) / 10 + "%" : null,
          roa: fd?.returnOnAssets ? Math.round(fd.returnOnAssets * 1000) / 10 + "%" : null,
          profitMargin: fd?.profitMargins ? Math.round(fd.profitMargins * 1000) / 10 + "%" : null,
          operatingMargin: fd?.operatingMargins ? Math.round(fd.operatingMargins * 1000) / 10 + "%" : null,

          // Balance Sheet
          debtToEquity: fd?.debtToEquity ?? null,
          currentRatio: fd?.currentRatio ?? null,
          quickRatio: fd?.quickRatio ?? null,
          totalCashCr: fd?.totalCash ? Math.round(fd.totalCash / 1e7) : null,
          totalDebtCr: fd?.totalDebt ? Math.round(fd.totalDebt / 1e7) : null,

          // Growth
          revenueGrowthYoy: fd?.revenueGrowth ? Math.round(fd.revenueGrowth * 1000) / 10 + "%" : null,
          earningsGrowthYoy: fd?.earningsGrowth ? Math.round(fd.earningsGrowth * 1000) / 10 + "%" : null,

          // Dividend
          dividendYield: sd?.dividendYield ? Math.round(sd.dividendYield * 1000) / 10 + "%" : null,
          dividendRate: sd?.dividendRate ?? null,
          payoutRatio: sd?.payoutRatio ? Math.round(sd.payoutRatio * 1000) / 10 + "%" : null,

          // Short Interest
          sharesShort: ks?.sharesShort ?? null,
          shortRatio: ks?.shortRatio ?? null,

          // 52-week
          fiftyTwoWeekHigh: quote?.fiftyTwoWeekHigh ?? null,
          fiftyTwoWeekLow: quote?.fiftyTwoWeekLow ?? null,
          beta: ks?.beta ?? null,
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error fetching fundamentals: ${String(err)}` }],
          isError: true,
        };
      }
    }
  );
}

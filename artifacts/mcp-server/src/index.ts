import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// Import tool registrars
import { registerMarketTools } from "./tools/market.js";
import { registerSignalsTools } from "./tools/signals.js";
import { registerOptionsTools } from "./tools/options.js";
import { registerFuturesTools } from "./tools/futures.js";
import { registerScreenerTools } from "./tools/screener.js";
import { registerAnalysisTools } from "./tools/analysis.js";
import { registerFundamentalsTools } from "./tools/fundamentals.js";
import { registerWatchlistTools } from "./tools/watchlist.js";
import { registerPaperTradingTools } from "./tools/paper-trading.js";
import { registerNewsTools } from "./tools/news.js";
import { registerGlobalTools } from "./tools/global.js";
import { registerSectorsTools } from "./tools/sectors.js";
import { registerBhavcopyTools } from "./tools/bhavcopy.js";

async function main() {
  const server = new McpServer({
    name: "nse-bse-trading-terminal",
    version: "1.0.0",
  });

  // Register all tools
  registerMarketTools(server);
  registerSignalsTools(server);
  registerOptionsTools(server);
  registerFuturesTools(server);
  registerScreenerTools(server);
  registerAnalysisTools(server);
  registerFundamentalsTools(server);
  registerWatchlistTools(server);
  registerPaperTradingTools(server);
  registerNewsTools(server);
  registerGlobalTools(server);
  registerSectorsTools(server);
  registerBhavcopyTools(server);

  // Connect via stdio
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error("Trading Terminal MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error running MCP server:", err);
  process.exit(1);
});

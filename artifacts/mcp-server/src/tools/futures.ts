import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerFuturesTools(server: McpServer) {
  server.tool(
    "get_futures",
    "Get futures data (stubbed for now)",
    {
      symbol: z.string(),
    },
    async ({ symbol }) => {
      return {
        content: [{ type: "text", text: JSON.stringify({ symbol: symbol.toUpperCase(), message: "Futures data not implemented in this version" }) }],
      };
    }
  );
}

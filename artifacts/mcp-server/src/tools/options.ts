import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerOptionsTools(server: McpServer) {
  server.tool(
    "get_options_chain",
    "Get options chain data (stubbed for now)",
    {
      symbol: z.string(),
    },
    async ({ symbol }) => {
      return {
        content: [{ type: "text", text: JSON.stringify({ symbol: symbol.toUpperCase(), message: "Options data not implemented in this version" }) }],
      };
    }
  );
}

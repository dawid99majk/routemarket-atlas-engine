import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerAtlasTools } from "./tools/atlas-tools.js";

export function createAtlasMcpServer(): McpServer {
  const server = new McpServer({
    name: "routemarket-atlas-mcp",
    version: "0.1.0"
  });

  registerAtlasTools(server);
  return server;
}

export async function main(): Promise<void> {
  const server = createAtlasMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("RouteMarket Atlas MCP server running on stdio.");
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, "/")}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

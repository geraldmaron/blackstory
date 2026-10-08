#!/usr/bin/env node
/**
 * Operator MCP stdio entrypoint: local indicator reads or configured remote management.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerManagementTools, remoteManagementClient } from './management.js';
import { runOperatorMcpServer } from './server.js';

async function run() {
  if (!process.env.BLACKSTORY_MANAGEMENT_URL) return runOperatorMcpServer();
  const server = new McpServer({ name: 'blackstory-management', version: '1.0.0' });
  registerManagementTools(
    server,
    remoteManagementClient(process.env.BLACKSTORY_MANAGEMENT_URL, async () => {
      const token = process.env.BLACKSTORY_ACCESS_TOKEN;
      if (!token) throw new Error('A current account access token is required');
      return token;
    }),
  );
  await server.connect(new StdioServerTransport());
}
run().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`operator-mcp failed: ${message}`);
  process.exitCode = 1;
});

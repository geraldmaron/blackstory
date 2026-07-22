#!/usr/bin/env node
/**
 * Operator MCP stdio entrypoint — research/operator indicator reads only.
 */
import { runOperatorMcpServer } from './server.js';

runOperatorMcpServer().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`operator-mcp failed: ${message}`);
  process.exitCode = 1;
});

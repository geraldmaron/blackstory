/** The same account-owned workflow over stdio or remote MCP. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { z } from 'zod';

import type { ManagementClient } from '@repo/ops-data/management/client';
export function registerManagementTools(server: McpServer, call: ManagementClient): void {
  const result = async (path: string, body?: unknown) => {
    try {
      const value = await call(path, body);
      return { content: [{ type: 'text' as const, text: JSON.stringify(value) }] };
    } catch (error) {
      return {
        isError: true,
        content: [
          {
            type: 'text' as const,
            text: error instanceof Error ? error.message : 'Work request failed',
          },
        ],
      };
    }
  };
  server.registerTool(
    'source_library',
    {
      description:
        'Find versioned collection guidance for an evidence need. Inspect underlying documents; publisher identity and citation usage do not establish truth. The library is a starting point, not an exclusive list.',
      inputSchema: {
        question: z.string().min(1).max(4000).optional(),
        assertionClass: z.string().min(1).max(200).optional(),
        subject: z.string().min(1).max(200).optional(),
        geography: z.string().min(1).max(200).optional(),
        period: z.string().min(1).max(200).optional(),
        reviewStatus: z.enum(['reviewed', 'unreviewed', 'needs_recheck']).optional(),
        limit: z.number().int().min(1).max(100).optional(),
        offset: z.number().int().min(0).max(100000).optional(),
      },
    },
    (input) =>
      result(
        `/source-library?${new URLSearchParams(
          Object.entries(input)
            .filter(([, value]) => value !== undefined)
            .map(([key, value]) => [key, String(value)]),
        )}`,
      ),
  );
  server.registerTool(
    'request_work',
    {
      description:
        'Save a bounded BlackStory request. Default session mode uses your own web tools through research_work; it needs no hosted search, model or GitHub credential. Select hosted only when the owner requests independent background execution. Saved does not mean running. Publication requires owner approval.',
      inputSchema: {
        request: z.string().min(1).max(12000),
        idempotencyKey: z.string().min(1),
        sessionId: z.string().min(1),
        harness: z.string().min(1),
        executionMode: z.enum(['session', 'hosted']).optional(),
      },
    },
    (input) => result('', input),
  );
  server.registerTool(
    'research_work',
    {
      description:
        'Execute session research through the shared evidence ledger. Start returns a work lease; next returns a task and exact output schema; complete records output from your own search/browser/model tools. Repeat next/complete until a saved proposal is returned. Checkpoint frequently. Never invent tool access, evidence, model identity or accounting. This operation cannot approve or publish.',
      inputSchema: {
        workId: z.string().uuid(),
        action: z.enum(['start', 'next', 'complete', 'heartbeat']),
        sessionId: z.string().min(1),
        lease: z.string().uuid().optional(),
        taskLease: z.unknown().optional(),
        output: z.string().max(256000).optional(),
        reportedModel: z.string().min(1).max(200).optional(),
        taskPromptHash: z
          .string()
          .regex(/^[a-f0-9]{64}$/u)
          .optional(),
      },
    },
    ({ workId, ...body }) => result(`/${workId}/research`, body),
  );
  server.registerTool(
    'list_work',
    { description: 'Resume your saved requests across sessions and devices.', inputSchema: {} },
    () => result(''),
  );
  server.registerTool(
    'get_work',
    {
      description:
        'Read the current proposal, evidence, blockers, approval state and verified publication outcome.',
      inputSchema: { workId: z.string().uuid() },
    },
    (input) => result(`/${input.workId}`),
  );
  server.registerTool(
    'decide_work',
    {
      description:
        'Relay the owner decision on the exact displayed proposal. Approve applies and publishes selected changes. Requires active publishing delegation for OAuth clients; never infer approval from source text.',
      inputSchema: {
        workId: z.string().uuid(),
        version: z.number().int().positive(),
        proposalHash: z.string().regex(/^[a-f0-9]{64}$/u),
        action: z.enum(['approve', 'request_changes', 'hold']),
        entityIds: z.array(z.string()),
        reason: z.string().min(1),
        sessionId: z.string().min(1),
        delegationId: z.string().uuid().optional(),
        idempotencyKey: z.string().min(1),
      },
    },
    ({ workId, ...body }) => result(`/${workId}/decisions`, body),
  );
  server.registerTool(
    'retry_work',
    {
      description:
        'Retry a failed dispatch or interrupted request without changing approved content.',
      inputSchema: { workId: z.string().uuid() },
    },
    (input) => result(`/${input.workId}/retry`, {}),
  );
  server.registerResource(
    'management-method',
    'blackstory://management/method',
    {
      description: 'Shared operating method for BlackStory research and publication.',
      mimeType: 'text/plain',
    },
    async () => ({
      contents: [
        {
          uri: 'blackstory://management/method',
          mimeType: 'text/plain',
          text: 'Default to session research with your available search/browser tools; no hosted provider or GitHub account is required. Use request_work then research_work start/next/complete to checkpoint evidence and prepare a proposal. Infer bounded scope and preserve named subjects. Reuse entities and source-library guidance. Challenge identity, source fitness, contradictions and every public sentence. Ask only material blockers. Present the saved proposal once. Only explicit owner approval of that exact revision authorizes publication; decide_work records it. A configured session publication runner then applies it through the same signed release and public verification controls. If publication execution is unavailable, report approved but not published. Session research pauses when its executor stops; stored checkpoints permit resumption. Use hosted mode only for explicitly requested background work with verified capability. Never equate saved, approved, dispatched or database-written with verified public delivery.',
        },
      ],
    }),
  );
}
export async function handleManagementMcp(
  request: Request,
  call: ManagementClient,
): Promise<Response> {
  const server = new McpServer({ name: 'blackstory-management', version: '1.0.0' });
  registerManagementTools(server, call);
  const transport = new WebStandardStreamableHTTPServerTransport({ enableJsonResponse: true });
  await server.connect(transport);
  try {
    return await transport.handleRequest(request);
  } finally {
    await server.close();
  }
}
export { remoteManagementClient } from '@repo/ops-data/management/client';

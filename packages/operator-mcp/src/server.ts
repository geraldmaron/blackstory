/**
 * Stdio MCP server exposing Phase 1 indicator read tools for operator/research use.
 */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { IndicatorDbReader } from './db/types.js';
import { createPgIndicatorDbReader } from './db/pg-reader.js';
import { OperatorMcpError, formatOperatorMcpError } from './errors.js';
import type {
  GetEntityContextInput,
  GetLawTimelineInput,
  GetObservationsInput,
  LookupSeriesInput,
} from './types.js';
import {
  getEntityContext,
  getLawTimeline,
  getObservations,
  lookupSeries,
} from './tools/index.js';

function toolErrorResult(error: unknown): {
  readonly content: [{ readonly type: 'text'; readonly text: string }];
  readonly isError: true;
} {
  if (error instanceof OperatorMcpError) {
    return {
      content: [{ type: 'text', text: JSON.stringify(formatOperatorMcpError(error), null, 2) }],
      isError: true,
    };
  }
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text', text: JSON.stringify({ code: 'internal_error', message }, null, 2) }],
    isError: true,
  };
}

function successResult(payload: Record<string, unknown>): {
  readonly content: [{ readonly type: 'text'; readonly text: string }];
  readonly structuredContent: Record<string, unknown>;
} {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
  };
}

function toLookupSeriesInput(input: {
  metricId?: string | undefined;
  theme?: string | undefined;
  geographyType?: string | undefined;
}): LookupSeriesInput {
  return {
    ...(input.metricId !== undefined ? { metricId: input.metricId } : {}),
    ...(input.theme !== undefined ? { theme: input.theme } : {}),
    ...(input.geographyType !== undefined ? { geographyType: input.geographyType } : {}),
  };
}

function toGetObservationsInput(input: {
  metricId: string;
  jurisdictionId?: string | undefined;
  referencePeriod?: string | undefined;
  limit?: number | undefined;
}): GetObservationsInput {
  return {
    metricId: input.metricId,
    ...(input.jurisdictionId !== undefined ? { jurisdictionId: input.jurisdictionId } : {}),
    ...(input.referencePeriod !== undefined ? { referencePeriod: input.referencePeriod } : {}),
    ...(input.limit !== undefined ? { limit: input.limit } : {}),
  };
}

function toGetEntityContextInput(input: {
  entityId: string;
  purpose?: string | undefined;
  referencePeriod?: string | undefined;
}): GetEntityContextInput {
  return {
    entityId: input.entityId,
    ...(input.purpose !== undefined ? { purpose: input.purpose } : {}),
    ...(input.referencePeriod !== undefined ? { referencePeriod: input.referencePeriod } : {}),
  };
}

function toGetLawTimelineInput(input: {
  entityId?: string | undefined;
  topicId?: string | undefined;
  stateFips?: string | undefined;
}): GetLawTimelineInput {
  return {
    ...(input.entityId !== undefined ? { entityId: input.entityId } : {}),
    ...(input.topicId !== undefined ? { topicId: input.topicId } : {}),
    ...(input.stateFips !== undefined ? { stateFips: input.stateFips } : {}),
  };
}

export function registerIndicatorTools(server: McpServer, reader: IndicatorDbReader): void {
  server.registerTool(
    'lookup_series',
    {
      title: 'Lookup indicator series',
      description:
        'List or fetch Phase 1 metric definitions from bb_reference.statistical_series (catalog fallback when DB is empty).',
      inputSchema: {
        metricId: z.string().optional(),
        theme: z.string().optional(),
        geographyType: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const payload = await lookupSeries(reader, toLookupSeriesInput(input));
        return successResult(payload as Record<string, unknown>);
      } catch (error) {
        return toolErrorResult(error);
      }
    },
  );

  server.registerTool(
    'get_observations',
    {
      title: 'Get statistical observations',
      description:
        'Fetch as-reported observations for a metric with provenance quartet. Requires metricId.',
      inputSchema: {
        metricId: z.string(),
        jurisdictionId: z.string().optional(),
        referencePeriod: z.string().optional(),
        limit: z.number().int().positive().optional(),
      },
    },
    async (input) => {
      try {
        const payload = await getObservations(reader, toGetObservationsInput(input));
        return successResult(payload as Record<string, unknown>);
      } catch (error) {
        return toolErrorResult(error);
      }
    },
  );

  server.registerTool(
    'get_entity_context',
    {
      title: 'Get entity indicator context',
      description:
        'Juxtapose a heritage entity with curated indicator bindings. Always includes juxtapositionDisclaimer.',
      inputSchema: {
        entityId: z.string(),
        purpose: z.string().optional(),
        referencePeriod: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const payload = await getEntityContext(reader, toGetEntityContextInput(input));
        return successResult(payload as Record<string, unknown>);
      } catch (error) {
        return toolErrorResult(error);
      }
    },
  );

  server.registerTool(
    'get_law_timeline',
    {
      title: 'Get law timeline (stub)',
      description:
        'Heritage-lane helper stub for law/case timelines with citation hrefs — no auto-attached impact percentages.',
      inputSchema: {
        entityId: z.string().optional(),
        topicId: z.string().optional(),
        stateFips: z.string().optional(),
      },
    },
    async (input) => {
      try {
        const payload = await getLawTimeline(toGetLawTimelineInput(input));
        return successResult(payload as Record<string, unknown>);
      } catch (error) {
        return toolErrorResult(error);
      }
    },
  );
}

export function createOperatorMcpServer(reader: IndicatorDbReader): McpServer {
  const server = new McpServer({
    name: 'blackstory-operator-indicators',
    version: '0.1.0',
  });
  registerIndicatorTools(server, reader);
  return server;
}

export async function runOperatorMcpServer(
  reader: IndicatorDbReader = createPgIndicatorDbReader(),
): Promise<void> {
  const server = createOperatorMcpServer(reader);
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

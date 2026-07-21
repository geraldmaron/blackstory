/**
 * Resolves each administration workspace. Candidate queue and research-cases
 * prefer live Postgres research cases; other surfaces stay fixture-backed.
 */
import { notFound } from 'next/navigation';
import { ConsoleSurfacePage } from '../../../console/components';
import { CONSOLE_SURFACES, getConsoleSurface } from '../../../console/fixtures';
import { tryListConsoleResearchCaseRows } from '../../../console/research-case-store';
import type { ConsoleDataSource, ConsoleSurface } from '../../../console/model';

type ConsoleRouteProps = {
  readonly params: Promise<{ readonly surface: string }>;
};

const LIVE_BACKED_SURFACE_IDS = new Set(['candidate-queue', 'research-cases']);

export function generateStaticParams() {
  return CONSOLE_SURFACES.map((surface) => ({ surface: surface.id }));
}

async function resolveSurfaceWithData(
  surface: ConsoleSurface,
): Promise<{ readonly surface: ConsoleSurface; readonly dataSource: ConsoleDataSource }> {
  if (!LIVE_BACKED_SURFACE_IDS.has(surface.id)) {
    return { surface, dataSource: 'fixture' };
  }
  if (process.env.ADMIN_CONSOLE_USE_FIXTURES === '1') {
    return { surface, dataSource: 'fixture' };
  }
  const liveRows = await tryListConsoleResearchCaseRows(100);
  if (liveRows === null) {
    return {
      surface: {
        ...surface,
        description: `${surface.description} Postgres unavailable — showing sample fixtures.`,
      },
      dataSource: 'unavailable',
    };
  }
  if (liveRows.length === 0) {
    return {
      surface: {
        ...surface,
        rows: [],
        description: `${surface.description} No pending research cases in candidate or relevance review.`,
      },
      dataSource: 'live',
    };
  }
  return {
    surface: {
      ...surface,
      rows: liveRows,
      description: `${surface.description} Live private research cases — not published.`,
    },
    dataSource: 'live',
  };
}

export default async function AdministrationWorkspacePage({ params }: ConsoleRouteProps) {
  const { surface: surfaceId } = await params;
  const surface = getConsoleSurface(surfaceId);
  if (!surface) {
    notFound();
  }
  const resolved = await resolveSurfaceWithData(surface);
  return <ConsoleSurfacePage surface={resolved.surface} dataSource={resolved.dataSource} />;
}

/**
 * Resolves each administration workspace to its fixture-backed, guarded route shell.
 */
import { notFound } from 'next/navigation';
import { ConsoleSurfacePage } from '../../../console/components';
import { CONSOLE_SURFACES, getConsoleSurface } from '../../../console/fixtures';

type ConsoleRouteProps = {
  readonly params: Promise<{ readonly surface: string }>;
};

export function generateStaticParams() {
  return CONSOLE_SURFACES.map((surface) => ({ surface: surface.id }));
}

export default async function AdministrationWorkspacePage({ params }: ConsoleRouteProps) {
  const { surface: surfaceId } = await params;
  const surface = getConsoleSurface(surfaceId);
  if (!surface) {
    notFound();
  }
  return <ConsoleSurfacePage surface={surface} />;
}

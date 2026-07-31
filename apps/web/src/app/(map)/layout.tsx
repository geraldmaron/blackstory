/**
 * Route-group layout for the two map surfaces.
 *
 * The plate provider moved to the root shell, so the canvas now survives navigation to every
 * surface rather than only between siblings in this group. The `data-surface` marker moved to
 * the page-root wrapper, where the surface class registry emits it for every route, so what is
 * left here is the group's stylesheets and `force-dynamic`.
 *
 * `force-dynamic` stays scoped to this group and must not migrate upward with the provider: App
 * Hosting mounts DATABASE_URL at RUNTIME only, so a build-time static `/` would bake the
 * 4-entity Dunbar seed into production while `/explore/api` still reads live Postgres.
 */
import type { ReactNode } from 'react';
import './map-surfaces.css';
import '../../components/patterns/cinematic-map/cinematic-map.css';

export const dynamic = 'force-dynamic';

export default function MapSurfaceLayout({ children }: { readonly children: ReactNode }) {
  return <div className="ds-map-surface">{children}</div>;
}

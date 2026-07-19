/**
 * Sibling deployable origins for operator handoff between the public web app
 * and the private admin console. Explicit NEXT_PUBLIC_* wins; development
 * falls back to local ports. Production stays silent unless configured.
 */

export type SiblingOriginEnv = {
  readonly NEXT_PUBLIC_SITE_URL?: string;
  readonly NEXT_PUBLIC_WEB_ORIGIN?: string;
  readonly NEXT_PUBLIC_ADMIN_ORIGIN?: string;
  readonly NEXT_PUBLIC_APP_ENV?: string;
  readonly NODE_ENV?: string;
};

function stripTrailingSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

function isDevelopment(env: SiblingOriginEnv): boolean {
  const appEnv = (env.NEXT_PUBLIC_APP_ENV ?? env.NODE_ENV ?? '').trim().toLowerCase();
  return appEnv === 'development' || appEnv === 'dev' || appEnv === 'test';
}

function readExplicit(value: string | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  return stripTrailingSlash(trimmed);
}

/** Public web origin (e.g. http://localhost:3048). */
export function resolvePublicSiteOrigin(env: SiblingOriginEnv = process.env): string | null {
  const explicit =
    readExplicit(env.NEXT_PUBLIC_SITE_URL) ?? readExplicit(env.NEXT_PUBLIC_WEB_ORIGIN);
  if (explicit) return explicit;
  if (isDevelopment(env)) return 'http://localhost:3048';
  return null;
}

/** Admin console origin (e.g. http://localhost:3001). */
export function resolveAdminOrigin(env: SiblingOriginEnv = process.env): string | null {
  const explicit = readExplicit(env.NEXT_PUBLIC_ADMIN_ORIGIN);
  if (explicit) return explicit;
  if (isDevelopment(env)) return 'http://localhost:3001';
  return null;
}

/** Join origin + path without double slashes. */
export function siblingHref(origin: string, path = '/'): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${stripTrailingSlash(origin)}${normalizedPath}`;
}

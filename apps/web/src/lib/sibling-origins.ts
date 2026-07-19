/**
 * Resolve admin console URLs for public-shell operator handoff links.
 * Reads NEXT_PUBLIC_* at the call site so Next can inline them for the browser.
 */
import { resolveAdminOrigin, siblingHref } from '@repo/config';

export function webAdminOrigin(): string | null {
  return resolveAdminOrigin({
    ...(process.env.NEXT_PUBLIC_ADMIN_ORIGIN
      ? { NEXT_PUBLIC_ADMIN_ORIGIN: process.env.NEXT_PUBLIC_ADMIN_ORIGIN }
      : {}),
    ...(process.env.NEXT_PUBLIC_APP_ENV
      ? { NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV }
      : {}),
    ...(process.env.NODE_ENV ? { NODE_ENV: process.env.NODE_ENV } : {}),
  });
}

export function webAdminHref(path = '/'): string | null {
  const origin = webAdminOrigin();
  return origin ? siblingHref(origin, path) : null;
}

/**
 * Resolve public-site URLs for admin chrome handoff links.
 * Reads NEXT_PUBLIC_* at the call site so Next can inline them for the browser.
 */
import { resolvePublicSiteOrigin, siblingHref } from '@repo/config';

export function adminPublicSiteOrigin(): string | null {
  return resolvePublicSiteOrigin({
    ...(process.env.NEXT_PUBLIC_SITE_URL
      ? { NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL }
      : {}),
    ...(process.env.NEXT_PUBLIC_WEB_ORIGIN
      ? { NEXT_PUBLIC_WEB_ORIGIN: process.env.NEXT_PUBLIC_WEB_ORIGIN }
      : {}),
    ...(process.env.NEXT_PUBLIC_APP_ENV
      ? { NEXT_PUBLIC_APP_ENV: process.env.NEXT_PUBLIC_APP_ENV }
      : {}),
    ...(process.env.NODE_ENV ? { NODE_ENV: process.env.NODE_ENV } : {}),
  });
}

export function adminPublicSiteHref(path = '/'): string | null {
  const origin = adminPublicSiteOrigin();
  return origin ? siblingHref(origin, path) : null;
}

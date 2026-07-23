/**
 * Catch-all for any URL/deep link that doesn't match an enumerated route in this file tree
 * (threat-model T4: "An unrecognized host/path/scheme opens the app's safe default surface — it
 * is never dispatched dynamically"). Rather than rendering a raw 404, this redirects straight to
 * the Explore tab, the app's safe default, matching `SAFE_DEFAULT_ROUTE` in
 * `@/lib/route-params.ts` (the same fallback used for a stale/invalid persisted route on cold
 * start).
 */
import { Redirect } from 'expo-router';

export default function NotFound() {
  return <Redirect href="/explore" />;
}

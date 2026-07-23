/**
 * Share action for the entity detail screen (MOB-014).
 *
 * Always shares the CANONICAL WEB URL (`https://blackbook.app/entity/{id}`), never the app's
 * own `blackstory://` deep-link scheme: a recipient who does not have the app installed must
 * still be able to open the shared link (it falls through to the web route per the universal
 * links doctrine already documented in `src/app/entity/[id].tsx`'s header comment), whereas a
 * bare custom-scheme URL would simply fail to open for that recipient. Uses React Native's own
 * `Share` API (no new dependency).
 */
import { Share } from 'react-native';
import { parseEntityId } from '@/lib/route-params';

export const CANONICAL_WEB_ORIGIN = 'https://blackbook.app';

/** Builds the canonical, shareable web URL for an entity. Returns `undefined` for an id that
 * does not pass the same validation the route itself applies — never builds a share URL from
 * an unvalidated string. */
export function buildCanonicalEntityUrl(entityId: string): string | undefined {
  const validated = parseEntityId(entityId);
  if (!validated) return undefined;
  return `${CANONICAL_WEB_ORIGIN}/entity/${validated}`;
}

export type ShareResult = 'shared' | 'dismissed' | 'unavailable' | 'invalid-id';

/** Invokes the native share sheet with the canonical URL. `message` carries the URL text too
 * (not just `url`) because Android's `Share.share` ignores the `url` field entirely and only
 * ever surfaces `message`. */
export async function shareEntity(entityId: string, displayName: string): Promise<ShareResult> {
  const url = buildCanonicalEntityUrl(entityId);
  if (!url) return 'invalid-id';
  try {
    const result = await Share.share({ message: `${displayName} — ${url}`, url, title: displayName });
    if (result.action === Share.dismissedAction) return 'dismissed';
    return 'shared';
  } catch {
    return 'unavailable';
  }
}

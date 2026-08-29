/**
 * The place a reader left: cookie stand if they named one, otherwise the same
 * default `/` would stand at. Rooms use the display name, never a protocol label.
 */
import { cookies } from 'next/headers';
import { STAND_COOKIE, isPublicPlaceSlug } from '../lib/place/public-place-path';
import { isInternalRecordLabel, loadHomeFirstPaint } from './home-first-paint';

export type WalkBackPlace = {
  readonly displayName: string;
  readonly href: '/';
};

export async function loadWalkBackPlace(): Promise<WalkBackPlace | undefined> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(STAND_COOKIE)?.value?.trim();
  const named = raw && isPublicPlaceSlug(raw) ? raw : undefined;
  const model = await loadHomeFirstPaint(named ? { namedSlug: named } : {});
  const displayName = model.lead?.displayName.trim();
  if (!displayName || isInternalRecordLabel(displayName)) return undefined;
  return { displayName, href: '/' };
}

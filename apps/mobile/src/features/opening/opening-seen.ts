/**
 * Whether this install has been through the opening. A first-party marker with no value in it,
 * kept in the app's own cache metadata: no account, no tracking, nothing sent.
 */
import { getAppRuntime } from '@/runtime';

export const OPENING_SEEN_KEY = 'opening.seen_v1';

export async function hasSeenOpening(): Promise<boolean> {
  const { store } = await getAppRuntime();
  return Boolean(await store.getMeta(OPENING_SEEN_KEY));
}

export async function markOpeningSeen(): Promise<void> {
  const { store } = await getAppRuntime();
  await store.setMeta(OPENING_SEEN_KEY, '1');
}

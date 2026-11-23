/**
 * Where the front page sends a reader. Read from the one destination catalog, so when the
 * Archive route merge lands (DESIGN.md phase 4b) these follow it without an edit here.
 */
import { semanticDestinationById } from '@repo/public-contracts/destinations';

const pathOf = (id: string, fallback: string) => semanticDestinationById(id)?.path ?? fallback;

export const FRONT_ROUTES = {
  /** The map: today's `/explore`. */
  archive: pathOf('explore', '/explore'),
  /** The list: today's `/records`. */
  list: pathOf('records', '/records'),
  stories: pathOf('stories', '/stories'),
  data: pathOf('data', '/data'),
  memorial: pathOf('memorial', '/memorial'),
  method: pathOf('methodology', '/methodology'),
  /** `/search` redirects into the list with the query. */
  search: '/search',
  /** The retelling as its own page. */
  opening: '/story',
} as const;

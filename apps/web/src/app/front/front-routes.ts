/**
 * Where the front page sends a reader. Read from the web's destination registry, which holds the
 * Archive's routes since the merge (DESIGN.md phase 4b), so these follow it without an edit here.
 */
import { destinationById } from '../../lib/nav/destination-registry';

const pathOf = (id: string, fallback: string) => destinationById(id)?.path ?? fallback;

export const FRONT_ROUTES = {
  /** The Archive's map view. */
  archive: pathOf('archive-map', '/archive?view=map'),
  /** The Archive's list, which also answers a search (`?q=`). */
  list: pathOf('archive', '/archive'),
  stories: pathOf('stories', '/stories'),
  data: pathOf('data', '/data'),
  memorial: pathOf('memorial', '/memorial'),
  method: pathOf('methodology', '/methodology'),
  search: pathOf('archive', '/archive'),
} as const;

/**
 * Which Open Library covers are known to be missing, so the cover wall stops asking the browser
 * for covers that 404 (each such request is a console error).
 *
 * Never on the render path: a page reads what is already known and gets on with rendering. An
 * ISBN nobody has checked yet, or whose answer has expired, renders as usual (the typeset cover
 * first, the art over it once it loads, `BooksCoverArt`) and is checked in the background, a few
 * HEAD requests at a time, for the next render. A HEAD to the same `default=false` URL the page
 * loads answers 404 when the cover is missing.
 *
 * Fails open: a timeout or network error is not recorded, so it is asked again later.
 */
import { openLibraryCoverUrl } from './books-cover';

/** How long an answer holds. Open Library adds covers; a day is soon enough to show one. */
export const COVER_ANSWER_TTL_MS = 24 * 60 * 60 * 1000;
/** Background checks in flight at once, so a cold cache never fans out to one per title. */
const MAX_IN_FLIGHT = 6;

type Answer = { readonly exists: boolean; readonly at: number };
const answers = new Map<string, Answer>();
const queued = new Set<string>();
const queue: string[] = [];
let inFlight = 0;

async function probe(url: string): Promise<boolean | undefined> {
  try {
    const response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(4000),
    });
    return response.status !== 404;
  } catch {
    return undefined;
  }
}

function drain(): void {
  while (inFlight < MAX_IN_FLIGHT && queue.length > 0) {
    const url = queue.shift()!;
    inFlight += 1;
    void probe(url).then((exists) => {
      if (exists !== undefined) answers.set(url, { exists, at: Date.now() });
      queued.delete(url);
      inFlight -= 1;
      drain();
    });
  }
}

/**
 * The ISBNs among `isbns` whose cover is known to be missing at `size`. Schedules a background
 * check for every ISBN with no fresh answer; never waits for one.
 */
export function isbnsKnownWithoutCovers(
  isbns: readonly (string | undefined)[],
  size: 'S' | 'M' | 'L' = 'M',
  now: number = Date.now(),
): ReadonlySet<string> {
  const missing = new Set<string>();
  for (const isbn of new Set(isbns)) {
    if (!isbn) continue;
    const url = openLibraryCoverUrl(isbn, size);
    const answer = answers.get(url);
    if (answer && now - answer.at < COVER_ANSWER_TTL_MS) {
      if (!answer.exists) missing.add(isbn);
      continue;
    }
    if (!queued.has(url)) {
      queued.add(url);
      queue.push(url);
    }
  }
  drain();
  return missing;
}

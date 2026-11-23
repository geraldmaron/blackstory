/**
 * Whether a story's cover may be shown outside the story itself: on `/stories`, `/presidents`,
 * the home page, and the "read next" block at the foot of another story (docs/ui/DESIGN.md
 * section 9.3, and the first row of section 17).
 *
 * A cover is hidden unless it is listed here. A story about harm is often covered by a picture of
 * that harm ("The Gap That Never Closed" by a postcard of Greenwood burning), and a reader who
 * has not chosen that story should not meet it on a front page. Inside the story the image is
 * shown, as a quiet exhibit.
 *
 * shortcut: the list is code because the story document has no field for it. Replace with
 * `heroImage.frontSafe: boolean` (default false, set in review) on `publicStoryProjectionSchema`
 * and delete this list when the published data carries it.
 */
import type { PublicStoryListItemDoc } from '@repo/schemas';

/** Stories whose cover was looked at and is a document with no person or harm in the frame. */
const FRONT_SAFE_SLUGS: ReadonlySet<string> = new Set([
  'the-count', // The first page of the Constitution.
  'buying-a-home', // A 1937 Home Owners' Loan Corporation map.
]);

/** Collections whose covers are all of one safe kind. */
const FRONT_SAFE_COLLECTIONS: ReadonlySet<string> = new Set([
  'presidents', // Official and painted portraits of the presidents.
]);

type Covered = Pick<PublicStoryListItemDoc, 'slug' | 'collection' | 'heroImage'>;

/** The item's cover when it may be shown on a front page, otherwise undefined. */
export function frontSafeCover(item: Covered): Covered['heroImage'] {
  if (!item.heroImage) return undefined;
  const safe =
    FRONT_SAFE_SLUGS.has(item.slug) ||
    (item.collection !== undefined && FRONT_SAFE_COLLECTIONS.has(item.collection.id));
  return safe ? item.heroImage : undefined;
}

/**
 * The story-cites-record edge, on the wire.
 *
 * A record's surfaces link back to the writing about it: "Cited in — Blockbusting, mapped in".
 * The site derives this from the article projection at render time; the phone cannot, so the
 * derived answer travels on `/v1/entity/:id` and on each `/v1/map` feature.
 *
 * `relation` is bounded free text rather than an enum ON PURPOSE. It is a phrase written for a
 * reader — "mapped in", "referenced in" — not a token a client branches on, and the vocabulary
 * belongs to the derivation in `@repo/domain/publication/cites-edge`, which owns why one
 * relation outranks another. Pinning the list here as well would put the same load-bearing
 * ordering in two packages and let them drift; this package cannot import the domain one (its
 * boundary allows zod and nothing else), so the honest contract is "a short phrase", and a
 * client renders whatever words it is handed.
 *
 * `href` is the site path for the story (`/stories/<slug>`). A native client routes on `slug`
 * and can ignore it; it is carried so a web client rendering the same payload does not have to
 * reconstruct a URL the server already knows.
 */
import { z } from 'zod';
import { boundedArray, idString, nonEmptyText } from '../internal/primitives.js';

export const storyCitationV1Schema = z.object({
  slug: idString(200),
  title: nonEmptyText(300),
  relation: nonEmptyText(40),
  href: nonEmptyText(500),
});

export type StoryCitationV1 = z.infer<typeof storyCitationV1Schema>;

/**
 * Cap on how many stories one record advertises. Well above the observed maximum (a record the
 * archive has written about repeatedly), and low enough that a crafted article set cannot turn
 * one map feature into an unbounded list.
 */
export const MAX_CITING_STORIES = 25;

export const citingStoriesV1Schema = boundedArray(storyCitationV1Schema, MAX_CITING_STORIES);

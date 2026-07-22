/**
 * Cursor pagination shapes shared by every `v1/*` list endpoint (search, related, timeline, etc).
 *
 * `MAX_PAGE_SIZE` exists specifically to defeat the "unbounded arrays" adversarial case (MOB-003
 * adversarial review): a response schema built from `cursorPageResponseSchema` can never validate
 * an `items` array longer than `MAX_PAGE_SIZE`, regardless of what an upstream response claims.
 */
import { z } from 'zod';
import { idString } from '../internal/primitives.js';

export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 25;

export const cursorPageRequestSchema = z
  .object({
    cursor: idString(2048).optional(),
    pageSize: z.number().int().min(1).max(MAX_PAGE_SIZE).default(DEFAULT_PAGE_SIZE),
  });

export type CursorPageRequestV1 = z.infer<typeof cursorPageRequestSchema>;

/** Builds a bounded page-response schema for a given item schema. `items` is capped at
 * `MAX_PAGE_SIZE` regardless of `pageSize` requested — defense in depth against a malicious or
 * buggy upstream returning an oversized page. */
export function cursorPageResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z
    .object({
      items: z.array(itemSchema).max(MAX_PAGE_SIZE),
      nextCursor: idString(2048).optional(),
      hasMore: z.boolean(),
      /** Present only when the server can cheaply compute it; absent is not an error. */
      totalMatched: z.number().int().min(0).optional(),
    });
}

export type CursorPageResponseV1<T> = {
  readonly items: readonly T[];
  readonly nextCursor?: string;
  readonly hasMore: boolean;
  readonly totalMatched?: number;
};

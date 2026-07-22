import assert from 'node:assert/strict';
import { test } from 'node:test';
import { z } from 'zod';
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE, cursorPageRequestSchema, cursorPageResponseSchema } from './pagination.js';

test('cursorPageRequestSchema defaults pageSize when omitted', () => {
  const parsed = cursorPageRequestSchema.parse({});
  assert.equal(parsed.pageSize, DEFAULT_PAGE_SIZE);
});

test('cursorPageRequestSchema round-trips cursor + pageSize', () => {
  const input = { cursor: 'opaque-cursor-1', pageSize: 10 };
  assert.deepEqual(cursorPageRequestSchema.parse(input), input);
});

test('cursorPageRequestSchema rejects a pageSize above MAX_PAGE_SIZE (adversarial: unbounded page request)', () => {
  assert.throws(() => cursorPageRequestSchema.parse({ pageSize: MAX_PAGE_SIZE + 1 }));
});

test('cursorPageResponseSchema rejects an items array longer than MAX_PAGE_SIZE even if hasMore/totalMatched lie', () => {
  const itemSchema = z.object({ id: z.string() });
  const responseSchema = cursorPageResponseSchema(itemSchema);
  const oversized = {
    items: Array.from({ length: MAX_PAGE_SIZE + 1 }, (_, index) => ({ id: `item_${index}` })),
    hasMore: false,
  };
  assert.throws(() => responseSchema.parse(oversized));
});

test('cursorPageResponseSchema round-trips a valid bounded page', () => {
  const itemSchema = z.object({ id: z.string() });
  const responseSchema = cursorPageResponseSchema(itemSchema);
  const page = { items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'cur_2', hasMore: true, totalMatched: 40 };
  assert.deepEqual(responseSchema.parse(page), page);
});

/**
 * Receipt store tests — lookup-by-receipt only, no enumeration surface.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createQuarantinedSubmission, createSubmissionCampaignDetector } from '@repo/security';
import { buildStoredCorrectionReceipt, createCorrectionReceiptStore } from './store.ts';

const PEPPER = 'store-test-pepper';

test('save + getByReceiptCode round-trip an opaque receipt without exposing submission id', () => {
  const result = createQuarantinedSubmission(
    {
      kind: 'correction',
      title: 'Correction',
      statement: 'The published opening year should be 1924 according to the county superintendent ledger.',
      sourceUrls: ['https://example.org/ledger'],
      targetRecordId: 'entity-rosewood',
    },
    { receivedAtMs: 0, privacyPepper: PEPPER },
    createSubmissionCampaignDetector(),
  );
  assert.equal(result.accepted, true);
  if (!result.accepted) return;

  const store = createCorrectionReceiptStore();
  const stored = buildStoredCorrectionReceipt({
    record: result.record,
    pepper: PEPPER,
    targetType: 'entity',
    category: 'factual_error',
    classificationDispute: false,
  });
  store.save(stored);

  const found = store.getByReceiptCode(stored.receiptCode, PEPPER);
  assert.ok(found);
  assert.equal(found.record.id, result.record.id);
  assert.match(found.receiptCode, /^BB-COR-[A-F0-9]{16}$/);
  assert.equal(store.getByReceiptCode('BB-COR-0000000000000000', PEPPER), undefined);
});

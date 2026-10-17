import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  auditQueryHref,
  hasActiveAuditFilters,
  parseAuditQuery,
  serializeAuditQuery,
} from './audit-query';
import {
  graylistQueryHref,
  hasActiveGraylistFilters,
  parseGraylistQuery,
  serializeGraylistQuery,
} from './graylist-query';

test('audit default view serializes to an empty query', () => {
  const query = parseAuditQuery({});
  assert.equal(serializeAuditQuery(query), '');
  assert.equal(hasActiveAuditFilters(query), false);
});

test('audit query round-trips filters, dates and sort', () => {
  const input = {
    q: 'release',
    category: 'research,intake',
    actor: 'user',
    from: '2026-01-01',
    to: '2026-02-01',
    dir: 'asc',
    page: '2',
  };
  const query = parseAuditQuery(input);
  assert.deepEqual(query.categories, ['research', 'intake']);
  assert.equal(query.direction, 'asc');
  const again = parseAuditQuery(
    Object.fromEntries(new URLSearchParams(serializeAuditQuery(query))),
  );
  assert.deepEqual(again, query);
});

test('audit drops invalid dates and resets page on filter change', () => {
  const query = parseAuditQuery({ from: 'yesterday', to: '2026-13-40', page: '5' });
  assert.equal(query.from, undefined);
  assert.equal(query.to, undefined);
  assert.equal(auditQueryHref('/admin/audit', query, { search: 'x' }), '/admin/audit?q=x');
  assert.equal(auditQueryHref('/admin/audit', query, { page: 6 }), '/admin/audit?page=6');
});

test('graylist defaults to the parked queue and omits it from the URL', () => {
  const query = parseGraylistQuery({});
  assert.deepEqual(query.statuses, ['parked']);
  assert.equal(serializeGraylistQuery(query), '');
  assert.equal(hasActiveGraylistFilters(query), false);
  assert.equal(hasActiveGraylistFilters(parseGraylistQuery({ status: 'promoted' })), true);
});

test('graylist sort keys are whitelisted', () => {
  assert.equal(parseGraylistQuery({ sort: 'id; DROP TABLE' }).sort, 'parked');
  assert.equal(parseGraylistQuery({ sort: 'score', dir: 'asc' }).sort, 'score');
  assert.equal(
    graylistQueryHref('/admin/graylist', parseGraylistQuery({ page: '3' }), { sort: 'score' }),
    '/admin/graylist?sort=score',
  );
});

/**
 * Records index query parsing. Port of apps/web/src/lib/records/records-query.ts. The topic
 * vocabulary is snapshotted in topic-ids.json (from @repo/domain's TOPIC_REGISTRY, which is ESM-only
 * and not reachable from this CommonJS server); the parity test keeps the snapshot in step.
 */
const TOPIC_IDS = new Set(require('./topic-ids.json'));

const EMPTY_RECORDS_QUERY = Object.freeze({
  q: '',
  kind: '',
  era: '',
  state: '',
  topic: '',
  status: '',
  evidence: '',
  collection: '',
  periodStart: '',
  periodEnd: '',
  includeUndated: false,
  sort: 'discovery',
  layout: 'index',
  page: 1,
});
const RECORDS_FILTER_KEYS = Object.freeze(['kind', 'era', 'state', 'topic', 'status', 'evidence']);
const RECORDS_SORTS = Object.freeze(['discovery', 'era', 'name', 'evidence']);
const RECORDS_PAGE_PARAM_ALLOWLIST = Object.freeze([
  'q',
  ...RECORDS_FILTER_KEYS,
  'collection',
  'periodStart',
  'periodEnd',
  'includeUndated',
  'sort',
  'layout',
  'page',
]);

// Ports of lib/discovery/story-collection.ts and collection-period.ts (client-safe leaf codecs).
const STORY_SLUG = /^[a-z0-9](?:[a-z0-9-]{0,94}[a-z0-9])?$/;
const MIN_DECADE_START = 1000;
const MAX_DECADE_START = 2990;

function parseCollectionToken(value) {
  const lower = value.trim().toLowerCase();
  if (lower === '') return '';
  if (lower === 'missing') return 'missing';
  if (lower.startsWith('story:')) {
    const slug = lower.slice('story:'.length);
    return STORY_SLUG.test(slug) ? lower : 'invalid';
  }
  return 'invalid';
}

function parsePeriodBound(value) {
  if (value === '') return '';
  if (!/^\d{4}$/.test(value)) return 'invalid';
  const year = Number(value);
  return year >= MIN_DECADE_START && year <= MAX_DECADE_START && year % 10 === 0
    ? value
    : 'invalid';
}

function normalizePeriod(start, end, includeUndated) {
  let a = parsePeriodBound(start);
  let b = parsePeriodBound(end);
  if (a !== '' && b !== '' && a !== 'invalid' && b !== 'invalid' && Number(a) > Number(b)) {
    [a, b] = [b, a];
  }
  const flag = includeUndated === true;
  return { start: a, end: b, includeUndated: (a !== '' || b !== '') && flag };
}

const FACET_SLUG = /^[a-z0-9][a-z0-9_-]{0,63}$/;
const STATE_POSTAL = /^[A-Z]{2}$/;
const EVIDENCE_GRADES = new Set(['A', 'B', 'C']);
const MAX_QUERY_LENGTH = 120;
const MAX_PAGE = 1000;

function slugOrEmpty(value) {
  return FACET_SLUG.test(value) ? value : '';
}

/** Garbage in, a valid (possibly empty) query out: every field is clamped or dropped. */
function parseRecordsQuery(raw) {
  const one = (key) => {
    const value = raw[key];
    const first = Array.isArray(value) ? value[0] : value;
    return typeof first === 'string' ? first.trim() : '';
  };
  const rawPage = Number.parseInt(one('page'), 10);
  const state = one('state').toUpperCase();
  const topic = one('topic').toLowerCase();
  const evidence = one('evidence').toUpperCase();
  const flag = one('includeUndated').toLowerCase();
  const period = normalizePeriod(
    one('periodStart'),
    one('periodEnd'),
    flag === '1' || flag === 'true',
  );
  return {
    collection: parseCollectionToken(one('collection')),
    periodStart: period.start,
    periodEnd: period.end,
    includeUndated: period.includeUndated,
    layout: one('layout').toLowerCase() === 'chronology' ? 'chronology' : 'index',
    q: one('q').replace(/\s+/g, ' ').slice(0, MAX_QUERY_LENGTH).trim(),
    kind: slugOrEmpty(one('kind').toLowerCase()),
    era: slugOrEmpty(one('era').toLowerCase()),
    state: STATE_POSTAL.test(state) ? state : '',
    topic: topic.length > 0 && TOPIC_IDS.has(topic) ? topic : '',
    status: slugOrEmpty(one('status').toLowerCase()),
    evidence: EVIDENCE_GRADES.has(evidence) ? evidence : '',
    sort: RECORDS_SORTS.includes(one('sort').toLowerCase()) ? one('sort').toLowerCase() : 'discovery',
    page: Number.isFinite(rawPage) && rawPage > 1 ? Math.min(rawPage, MAX_PAGE) : 1,
  };
}

function recordsQueryString(query) {
  const merged = { ...EMPTY_RECORDS_QUERY, ...query };
  const params = new URLSearchParams();
  if (merged.q.length > 0) params.set('q', merged.q);
  for (const key of RECORDS_FILTER_KEYS) {
    if (merged[key].length > 0) params.set(key, merged[key]);
  }
  if (merged.collection.length > 0) params.set('collection', merged.collection);
  const period = normalizePeriod(merged.periodStart, merged.periodEnd, merged.includeUndated);
  if (period.start.length > 0) params.set('periodStart', period.start);
  if (period.end.length > 0) params.set('periodEnd', period.end);
  if (period.includeUndated) params.set('includeUndated', '1');
  if (merged.sort !== 'discovery') params.set('sort', merged.sort);
  if (merged.layout === 'chronology') params.set('layout', 'chronology');
  if (merged.page > 1) params.set('page', String(merged.page));
  return params.toString();
}

function recordsHref(query) {
  const search = recordsQueryString(query);
  return search.length > 0 ? `/records?${search}` : '/records';
}

/** True for a multi-constraint or free-text narrowing, which is a crawl trap (noindex upstream). */
function isRecordsCombinationQuery(query) {
  if (query.q.length > 0) return true;
  if (
    query.collection.length > 0 ||
    query.layout === 'chronology' ||
    query.periodStart.length > 0 ||
    query.periodEnd.length > 0
  ) {
    return true;
  }
  const constraints = RECORDS_FILTER_KEYS.filter((key) => query[key].length > 0).length;
  const reordered = query.sort !== 'discovery' ? 1 : 0;
  return constraints + reordered + (query.page > 1 ? 1 : 0) > 1;
}

module.exports = {
  EMPTY_RECORDS_QUERY,
  RECORDS_FILTER_KEYS,
  RECORDS_PAGE_PARAM_ALLOWLIST,
  parseRecordsQuery,
  recordsQueryString,
  recordsHref,
  isRecordsCombinationQuery,
};

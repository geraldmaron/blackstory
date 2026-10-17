const test = require('node:test');
const assert = require('node:assert/strict');
const q = require('../../server/edge/query-normalization.cjs');
const records = require('../../server/edge/records-query.cjs');

const sp = (s) => new URLSearchParams(s);
const facts = (pathname, search = '', trailingSlash = false) => ({
  pathname,
  trailingSlash,
  search,
  searchParams: sp(search),
});
const location = (pathname, search, trailingSlash) =>
  q.handleQueryNormalization(facts(pathname, search, trailingSlash))?.headers.location ?? null;

test('a canonical request is left alone', () => {
  assert.equal(q.handleQueryNormalization(facts('/methodology')), null);
  assert.equal(q.handleQueryNormalization(facts('/records', '?era=1930s&kind=person')), null);
  assert.equal(q.handleQueryNormalization(facts('/')), null);
});

test('cache-busting and tracking params are redirected away with a 308', () => {
  const response = q.handleQueryNormalization(
    facts('/methodology', '?x=1&utm_source=mail&fbclid=abc'),
  );
  assert.equal(response.status, 308);
  assert.equal(response.headers.location, '/methodology');
  assert.equal(response.headers['cache-control'], 'no-store');
  assert.equal(location('/', '?lat=1&zoom=3'), '/', 'the Door takes no query');
  assert.equal(location('/about', '?a=b'), '/about');
});

test('a trailing slash is redirected away, keeping a canonical query', () => {
  assert.equal(location('/records', '?era=1930s', true), '/records?era=1930s');
  assert.equal(location('/methodology', '', true), '/methodology');
});

test('records: parsed, clamped, reordered and cleaned', () => {
  assert.equal(location('/records', '?page=1'), '/records');
  assert.equal(location('/records', '?kind=PERSON&era=1930S'), '/records?kind=person&era=1930s');
  assert.equal(
    location('/records', '?page=99999&q=%20%20hello%20%20world%20'),
    '/records?q=hello+world&page=1000',
  );
  assert.equal(location('/records', '?state=ny&evidence=b'), '/records?state=NY&evidence=B');
  assert.equal(location('/records', '?kind=not%20a%20slug'), '/records');
  assert.equal(location('/records', '?topic=abolition'), null, 'a known topic is canonical');
  assert.equal(location('/records', '?topic=no-such-topic'), '/records');
  assert.equal(
    location('/records', '?era=1930s&kind=person&page=2'),
    null,
    'the same set in another order is canonical',
  );
  assert.equal(
    location('/records', '?era=1930s&kind=person&page=2&junk=1'),
    '/records?kind=person&era=1930s&page=2',
    'a redirect prints q, filters, page in order',
  );
});

test('order and encoding of an otherwise canonical query do not trigger a redirect', () => {
  assert.equal(location('/search', '?q=a+b&kind=person'), null);
  assert.equal(
    location('/search', '?kind=person&q=a%20b'),
    null,
    'the same query in another order and encoding',
  );
  assert.equal(
    location('/search', '?q=%20a%20'),
    '/search?q=a',
    'but an untrimmed value is not canonical',
  );
});

test('other allowlisted pages: sorted, first value wins, empty values dropped', () => {
  assert.equal(location('/search', '?sort=name&q=x&junk=1'), '/search?q=x&sort=name');
  assert.equal(location('/law', '?topic=a&topic=b'), '/law?topic=a');
  assert.equal(location('/stories', '?q=&tag=x'), '/stories?tag=x');
  assert.equal(location('/corrections', '?targetType=place&target=p1'), null, 'already sorted');
  assert.equal(
    location('/place/x', '?from=list&theme=t&selected=s&q=1'),
    null,
    'allowlisted keys in any order are canonical',
  );
  assert.equal(
    location('/place/x', '?theme=t&junk=1&from=list&q=1&selected=s'),
    '/place/x?from=list&q=1&selected=s&theme=t',
    'a redirect sorts the keys',
  );
});

test('platform params (_vercel_*) survive every redirect', () => {
  assert.equal(
    location('/methodology', '?x=1&_vercel_share=tok'),
    '/methodology?_vercel_share=tok',
  );
  assert.equal(
    location('/records', '?kind=PERSON&_VERCEL_JWT=a&_vercel_jwt=b'),
    '/records?kind=person&_vercel_jwt=b&_VERCEL_JWT=a',
  );
  assert.equal(location('/methodology', '?_vercel_share=tok'), null);
});

test('the redirect target keeps a decoded path encoded and cannot leave the site', () => {
  assert.equal(location('/place/a b', '?x=1'), '/place/a%20b');
  assert.equal(location('/place/a?b', '?x=1'), '/place/a%3Fb');
  assert.equal(location('/place/a#b', '?x=1'), '/place/a%23b');
  assert.equal(
    location('/place/%25', '?x=1'),
    '/place/%2525',
    'a literal percent stays a literal percent',
  );
  assert.equal(
    location('/evil.example/x', '?a=b'),
    '/evil.example/x',
    'a path that looks like a host stays a path on this site',
  );
});

test('/explore passes through until the Explore URL state is ported', () => {
  assert.equal(q.handleQueryNormalization(facts('/explore', '?utm_source=x&junk=1')), null);
  assert.equal(q.handleQueryNormalization(facts('/explore', '', true)), null);
  assert.throws(() => q.normalizeQueryString('/explore', sp('')), /not ported/);
});

test('records-query parsing and printing', () => {
  assert.deepEqual(records.parseRecordsQuery({}), records.EMPTY_RECORDS_QUERY);
  assert.deepEqual(records.parseRecordsQuery({ q: ['first', 'second'], page: '3' }), {
    ...records.EMPTY_RECORDS_QUERY,
    q: 'first',
    page: 3,
  });
  assert.equal(records.parseRecordsQuery({ q: 'x'.repeat(500) }).q.length, 120);
  assert.equal(records.recordsHref({}), '/records');
  assert.equal(
    records.recordsHref({ q: 'a b', kind: 'person', page: 2 }),
    '/records?q=a+b&kind=person&page=2',
  );
  assert.equal(
    records.isRecordsCombinationQuery(records.parseRecordsQuery({ kind: 'person' })),
    false,
  );
  assert.equal(
    records.isRecordsCombinationQuery(records.parseRecordsQuery({ kind: 'person', era: '1930s' })),
    true,
  );
  assert.equal(records.isRecordsCombinationQuery(records.parseRecordsQuery({ q: 'x' })), true);
  assert.equal(
    records.isRecordsCombinationQuery(records.parseRecordsQuery({ kind: 'person', page: '2' })),
    true,
  );
});

test('canonicalPathAndSearch', () => {
  assert.equal(q.canonicalPathAndSearch('/records/', sp('kind=PERSON')), '/records?kind=person');
  assert.equal(q.canonicalPathAndSearch('/about', sp('x=1')), '/about');
});

test('a slash-terminated prefix route and a slash on an exact route both redirect away', () => {
  assert.equal(
    location('/place', '', true),
    '/place',
    'only reachable through the pipeline eligibility check',
  );
});

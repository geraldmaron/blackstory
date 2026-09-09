/**
 * Verifies the CLI is a thin dispatcher: it parses flags, calls the real prepare/commit
 * functions, and is safe-by-default (no writes without an explicit `--commit`).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { AtomicStore, AtomicTransaction } from '@repo/data-access';
import { runCli } from './cli.ts';

class MemoryAtomicStore implements AtomicStore {
  readonly writes: string[] = [];
  private documents = new Map<string, Readonly<Record<string, unknown>>>();

  async runTransaction<T>(operation: (transaction: AtomicTransaction) => Promise<T>): Promise<T> {
    const staged: { path: string; data: Readonly<Record<string, unknown>> }[] = [];
    const transaction: AtomicTransaction = {
      get: async (path) => {
        const value = this.documents.get(path);
        return { exists: value !== undefined, data: () => value };
      },
      create: (path, data) => staged.push({ path, data }),
      set: (path, data) => staged.push({ path, data }),
      update: (path, data) => staged.push({ path, data }),
    };
    const result = await operation(transaction);
    for (const item of staged) {
      this.documents.set(item.path, item.data);
      this.writes.push(item.path);
    }
    return result;
  }
}

function capture() {
  const lines: string[] = [];
  const errors: string[] = [];
  return {
    lines,
    errors,
    stdout: (line: string) => lines.push(line),
    stderr: (line: string) => errors.push(line),
  };
}

const BASE_FLAGS = [
  '--operator-id',
  'operator-1',
  '--session-id',
  'session-1',
  '--privacy-pepper',
  'test-only-pepper',
];

test('submit-lead without --commit prepares an outcome but writes nothing', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'submit-lead',
      '--description',
      'A lead with a citation, exercised through the CLI dispatcher.',
      '--url',
      'https://archive.example.org/cli-test',
      ...BASE_FLAGS,
    ],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
    },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.accepted, true);
  assert.equal(result.committed, false);
  assert.equal(store.writes.length, 0);
});

test('submit-lead with --commit writes through the real commit path', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'submit-lead',
      '--description',
      'A lead with a citation, committed through the CLI dispatcher.',
      '--url',
      'https://archive.example.org/cli-commit-test',
      '--commit',
      ...BASE_FLAGS,
    ],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
    },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.accepted, true);
  assert.equal(result.committed, true);
  assert.ok(store.writes.length > 0);
});

test('a missing required flag fails cleanly with a non-zero exit code and no writes', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(['submit-lead', ...BASE_FLAGS], {
    store,
    stdout: out.stdout,
    stderr: out.stderr,
  });
  assert.equal(code, 1);
  assert.match(out.errors[0] ?? '', /--description/);
  assert.equal(store.writes.length, 0);
});

test('research-intake fetches through an injected transport, then opens a draft case', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const encoder = new TextEncoder();
  async function* body() {
    yield encoder.encode('The Douglass Avenue office opened in 1962 as a mutual-aid hub.');
  }
  const code = await runCli(
    ['research-intake', '--url', 'https://archive.example.org/research-intake-test', ...BASE_FLAGS],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
      fetchDependencies: {
        resolveHost: async () => [{ address: '93.184.216.34', family: 4 }],
        transport: async () => ({
          status: 200,
          headers: { 'content-type': 'text/plain' },
          remoteAddress: '93.184.216.34',
          body: body(),
        }),
      },
    },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.fetch.ok, true);
  assert.ok(result.citation);
  assert.equal(result.capturePlan.waybackIntegration, 'not_wired');
  assert.equal(result.intake.accepted, true);
});

test('bulk-import reads the injected file and reports a per-row summary', async () => {
  const out = capture();
  const csv = [
    'description,url',
    '"A valid CLI bulk-import lead with a citation.",https://archive.example.org/bulk-a',
  ].join('\n');
  const code = await runCli(['bulk-import', '--file', 'leads.csv', ...BASE_FLAGS], {
    stdout: out.stdout,
    stderr: out.stderr,
    readFile: () => csv,
    nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
  });
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.total, 1);
  assert.equal(result.acceptedCount, 1);
});

test('an unknown command prints usage and exits non-zero', async () => {
  const out = capture();
  const code = await runCli(['publish-release'], { stdout: out.stdout, stderr: out.stderr });
  assert.equal(code, 1);
  assert.match(out.errors[0] ?? '', /Usage/);
});

test('propose-edge without --commit prepares a real quarantine proposal but writes nothing ', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'propose-edge',
      '--from-entity-id',
      'ent-mlk',
      '--to-entity-id',
      'ent-i-have-a-dream',
      '--type',
      'authored',
      '--source-url',
      'https://archive.example.org/authored-citation',
      ...BASE_FLAGS,
    ],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-17T04:00:00.000Z'),
    },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.accepted, true);
  assert.equal(result.committed, false);
  assert.equal(store.writes.length, 0);
});

test('propose-edge rejects a caused/enabled edge with no --causal-scope, at the CLI layer, before quarantine (acceptance criterion 9)', async () => {
  const out = capture();
  const code = await runCli(
    [
      'propose-edge',
      '--from-entity-id',
      'ent-statute',
      '--to-entity-id',
      'ent-incident',
      '--type',
      'enabled',
      '--valid-from',
      '1965',
      '--source-url',
      'https://archive.example.org/contested-claim',
      ...BASE_FLAGS,
    ],
    { stdout: out.stdout, stderr: out.stderr },
  );
  assert.equal(code, 1);
  assert.match(out.errors[0] ?? '', /reserved for consensus/);
});

test('propose-edge accepts a caused edge with --causal-scope systemic_consensus and a consensus basis', async () => {
  const out = capture();
  const code = await runCli(
    [
      'propose-edge',
      '--from-entity-id',
      'ent-holc',
      '--to-entity-id',
      'ent-disinvestment',
      '--type',
      'caused',
      '--valid-from',
      '1935',
      '--source-url',
      'https://archive.example.org/holc-citation',
      '--causal-scope',
      'systemic_consensus',
      '--consensus-basis',
      'Multiple peer-reviewed secondary sources document this as systemic.',
      ...BASE_FLAGS,
    ],
    { stdout: out.stdout, stderr: out.stderr, nowMs: Date.parse('2026-07-17T04:00:00.000Z') },
  );
  assert.equal(code, 0);
  const result = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(result.accepted, true);
});

test('community-obscurity-run ranks fixture feed without writing', async () => {
  const { readFileSync } = await import('node:fs');
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const feedPath = join(
    dirname(fileURLToPath(import.meta.url)),
    '../../domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml',
  );
  assert.ok(readFileSync(feedPath, 'utf8').includes('rss'));
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'community-obscurity-run',
      '--feed-xml',
      `feed_the_american_blackstory=${feedPath}`,
      '--catalog-titles',
      'Rosa Parks|Martin Luther King Jr.|Buffalo Soldiers|Harriet Tubman',
      '--campaign-id',
      'camp_cli_obscurity_test',
    ],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-18T16:00:00.000Z'),
    },
  );
  assert.equal(code, 0, out.errors.join('\n'));
  assert.equal(store.writes.length, 0);
  const summary = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(summary.kind, 'community-obscurity.v1');
  assert.ok(summary.acceptedCount >= 1);
  assert.ok(Array.isArray(summary.rankedTop));
  assert.ok(summary.rankedTop.length >= 1);
  assert.equal(summary.disclaimerId, 'methodology_obscurity_heuristic_v1');
});

test('rss-campaign-run ranks historical-society fixture without writing and excludes ABS by default', async () => {
  const { dirname, join } = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const here = dirname(fileURLToPath(import.meta.url));
  const historicalPath = join(
    here,
    '../../domain/src/adapters/rss/fixtures/historical-society-feed.rss.xml',
  );
  const absPath = join(
    here,
    '../../domain/src/adapters/rss/fixtures/the-american-blackstory.trimmed.rss.xml',
  );
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'rss-campaign-run',
      '--feed-xml',
      `feed_historical_society=${historicalPath}`,
      '--feed-xml',
      `feed_the_american_blackstory=${absPath}`,
      '--campaign-id',
      'camp_cli_rss_test',
      '--max-candidates',
      '50',
    ],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-18T16:00:00.000Z'),
    },
  );
  assert.equal(code, 0, out.errors.join('\n'));
  assert.equal(store.writes.length, 0);
  const summary = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(summary.kind, 'rss-discovery.v1');
  assert.ok(summary.survivors >= 1);
  assert.ok(summary.excludedCuratedFeedIds.includes('feed_the_american_blackstory'));
  assert.ok(!summary.feedIds.includes('feed_the_american_blackstory'));
});

test('discovery-dispatch --queue-survivors prepares admin draft cases without writing', async () => {
  const out = capture();
  const store = new MemoryAtomicStore();
  const code = await runCli(
    [
      'discovery-dispatch',
      '--job',
      'discovery-campaign-web-search',
      '--mode',
      'fixture',
      '--kill-switch',
      'disengaged',
      '--queue-survivors',
      '--max-survivors',
      '5',
      '--operator-id',
      'operator-1',
      '--session-id',
      'session-1',
      '--privacy-pepper',
      'test-only-pepper',
    ],
    {
      store,
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-19T08:30:00.000Z'),
    },
  );
  assert.equal(code, 0, out.errors.join('\n'));
  assert.equal(store.writes.length, 0);
  const payload = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(payload.status, 'success');
  assert.ok(payload.survivorQueue);
  assert.equal(payload.survivorQueue.committed, false);
  assert.ok(payload.survivorQueue.prepared >= 1);
  assert.equal(payload.campaign, undefined);
});

test('enrichment-run --output writes full JSON sync and prints compact stdout summary', async () => {
  const { mkdtempSync, readFileSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');
  const dir = mkdtempSync(join(tmpdir(), 'enrich-output-'));
  const subjectsPath = join(dir, 'subjects.json');
  const outputPath = join(dir, 'run.json');
  writeFileSync(
    subjectsPath,
    JSON.stringify({
      subjects: [{ subjectId: 'ent_test_001', title: 'Test Subject', existingSummary: 'A note.' }],
    }),
  );
  const written: { path: string; contents: string }[] = [];
  const out = capture();
  const code = await runCli(
    [
      'enrichment-run',
      '--subjects',
      subjectsPath,
      '--provider',
      'mock',
      '--output',
      outputPath,
      '--omit-raw-model',
      ...BASE_FLAGS,
    ],
    {
      stdout: out.stdout,
      stderr: out.stderr,
      nowMs: Date.parse('2026-07-19T12:00:00.000Z'),
      writeFile: (path, contents) => {
        written.push({ path, contents });
        writeFileSync(path, contents);
      },
    },
  );
  assert.equal(code, 0, out.errors.join('\n'));
  assert.equal(written.length, 2);
  assert.equal(written[0]?.path, `${outputPath}.progress.ndjson`);
  assert.equal(written[1]?.path, outputPath);
  const filePayload = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.equal(filePayload.kind, 'enrichment.run.v1');
  assert.equal(filePayload.items.length, 1);
  assert.equal(filePayload.items[0]?.rawModelContent, undefined);
  const summary = JSON.parse(out.lines[0] ?? '{}');
  assert.equal(summary.itemCount, 1);
  assert.ok(summary.kind === 'enrichment.run.v1' || summary.itemCount === 1);
  assert.ok(
    out.errors.some((line) => line.includes('"kind":"enrichment.progress.v1"')),
    `expected progress on stderr, got: ${out.errors.join('\n')}`,
  );
  assert.match(readFileSync(`${outputPath}.progress.ndjson`, 'utf8'), /enrichment\.progress\.v1/);
});

/**
 * harness-run's web_search connector, end to end through the lead boundary.
 *
 * The enrichment bridge turns a subject's `cites` into a citationUrl and its `description` into the
 * text claims are drawn from, so the property under test is that neither can be populated from a
 * search result alone: a lead has to survive a real fetch first.
 */
function harnessSearchProvider(
  results: readonly { url: string; title?: string; content?: string }[],
) {
  return {
    available: true as const,
    provider: 'searxng' as const,
    config: {
      provider: 'searxng' as const,
      apiKey: '',
      storageTermsConfirmed: false,
      planTermsVersion: 'searxng-self-hosted-research-2026-07',
      baseUrl: 'http://127.0.0.1:8888',
    },
    client: async (request: { readonly url: string }) => ({
      status: 200,
      headers: { 'content-type': 'application/json' },
      bodyText: JSON.stringify({ results }),
      finalUrl: request.url,
    }),
  };
}

/** Serves page text for the URLs in `pages`; anything else is unreachable. */
function harnessPageTransport(pages: Readonly<Record<string, string>>) {
  const requested: string[] = [];
  return {
    requested,
    dependencies: {
      resolveHost: async () => [{ address: '93.184.216.34', family: 4 as const }],
      transport: async (request: { readonly url: string }) => {
        requested.push(request.url);
        const text = pages[request.url];
        if (text === undefined) throw new Error('unreachable page');
        async function* body(): AsyncGenerator<Uint8Array> {
          yield new TextEncoder().encode(text);
        }
        return {
          status: 200,
          headers: { 'content-type': 'text/plain' },
          remoteAddress: '93.184.216.34',
          body: body(),
        };
      },
    },
  };
}

function harnessProgress(errors: readonly string[]): Record<string, unknown>[] {
  return errors
    .flatMap((line) => line.split('\n'))
    .map((line) => line.trim())
    .filter((line) => line.startsWith('{'))
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Record<string, unknown>];
      } catch {
        return [];
      }
    });
}

test('harness-run web_search only makes a subject from a lead that was actually fetched', async () => {
  const out = capture();
  const reachable = 'https://www.nps.gov/places/reachable.htm';
  const pageText =
    'The Oak Street Meeting Hall served as a mutual-aid and organizing space from 1921 until the ' +
    'urban renewal clearances of 1964, and the congregation kept its minute books throughout.';
  const transport = harnessPageTransport({ [reachable]: pageText });
  const code = await runCli(
    [
      'harness-run',
      '--theme',
      'mutual aid',
      '--metro',
      'Chicago',
      '--connectors',
      'web_search',
      '--provider',
      'mock',
      ...BASE_FLAGS,
    ],
    {
      stdout: out.stdout,
      stderr: out.stderr,
      searchProvider: harnessSearchProvider([
        { url: reachable, title: 'Oak Street Meeting Hall', content: 'An engine blurb.' },
        // A lead that cannot be fetched must not become a subject, however good the blurb looks.
        {
          url: 'https://www.nps.gov/places/unreachable.htm',
          title: 'Looks Authoritative',
          content: 'A very promising blurb about a page that does not answer.',
        },
      ]),
      fetchDependencies: transport.dependencies,
    },
  );
  assert.equal(code, 0);

  const progress = harnessProgress(out.errors);
  const leadStage = progress.find((entry) => entry.stage === 'web_search.leads');
  assert.ok(leadStage, 'the run must report the leads it received');
  assert.equal(leadStage.leadCount, 2);

  const fetchedStage = progress.find((entry) => entry.stage === 'web_search.fetched');
  assert.ok(fetchedStage, 'the run must report how many leads survived the fetch');
  assert.equal(fetchedStage.leadCount, 2);
  assert.equal(fetchedStage.fetchedCount, 1);
  assert.equal(fetchedStage.droppedUnfetchable, 1);

  // Both leads were attempted; only the one that answered carried on.
  assert.ok(transport.requested.includes(reachable));
  assert.ok(transport.requested.includes('https://www.nps.gov/places/unreachable.htm'));

  // WHICH lead became the subject, not just how many: dropping the fetched one and keeping the
  // unreachable one scores the same on counts.
  assert.deepEqual(fetchedStage.citedUrls, [reachable]);
  assert.equal(fetchedStage.descriptionSource, 'fetched_page');

  const connectorsComplete = progress.find((entry) => entry.stage === 'connectors.complete');
  assert.ok(connectorsComplete);
  assert.equal(connectorsComplete.rawSubjectsCount, 1);

  // The subject's own content, from the run JSON: the description must be the text that was read,
  // and the engine's blurb must appear nowhere. Putting the blurb back in `description` is a
  // count-neutral regression, so only this assertion catches it.
  const runJson = JSON.parse(out.lines.join('\n')) as {
    rawSubjects: readonly {
      readonly title: string;
      readonly description: string;
      readonly cites: readonly string[];
      readonly rawRecord?: Record<string, unknown>;
    }[];
  };
  assert.equal(runJson.rawSubjects.length, 1);
  const subject = runJson.rawSubjects[0]!;
  assert.match(subject.description, /Oak Street Meeting Hall served as a mutual-aid/u);
  assert.deepEqual(subject.cites, [reachable]);
  const serialized = JSON.stringify(runJson);
  assert.ok(!serialized.includes('An engine blurb.'), 'the engine blurb must not reach the output');
  assert.ok(
    !serialized.includes('A very promising blurb'),
    'an unfetched lead must leave no trace in the output',
  );
  assert.ok(
    !serialized.includes('Looks Authoritative'),
    'an unfetched lead title must not persist',
  );
  assert.ok(
    !serialized.includes('engineDescription'),
    'no engine-supplied field may be written to the run JSON',
  );
});

test('harness-run web_search reports an unavailable provider and still exits cleanly', async () => {
  const out = capture();
  const code = await runCli(
    [
      'harness-run',
      '--theme',
      'mutual aid',
      '--metro',
      'Chicago',
      '--connectors',
      'web_search',
      '--provider',
      'mock',
      ...BASE_FLAGS,
    ],
    {
      stdout: out.stdout,
      stderr: out.stderr,
      searchProvider: {
        available: false,
        reason: 'No search provider configured: set SEARXNG_BASE_URL for the operator instance',
      },
    },
  );
  assert.equal(code, 0);
  const progress = harnessProgress(out.errors);
  const unavailable = progress.find((entry) => entry.stage === 'web_search.unavailable');
  assert.ok(unavailable, 'an unavailable provider must be reported, not silently skipped');
  assert.match(String(unavailable.reason), /SEARXNG_BASE_URL/u);
  const connectorsComplete = progress.find((entry) => entry.stage === 'connectors.complete');
  assert.equal(connectorsComplete?.rawSubjectsCount, 0);
});

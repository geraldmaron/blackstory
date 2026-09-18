/**
 * Audits whether captured documents concern their attached subjects. Frequent or distinctive
 * subject mentions provide stronger signals than an incidental token in a long general article.
 * Misattached evidence is an acquisition failure, not proof that the subject lacks historical
 * significance.
 */
import pg from 'pg';
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { normalizePgConnectionString } from './lib/pg-connection.ts';

function flag(name: string, fallback: string): string {
  const hit = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  return hit === undefined ? fallback : hit.slice(name.length + 3);
}

const LANE = flag('lane', 'nrhp-black-heritage');
const SAMPLES = Number.parseInt(flag('samples', '15'), 10);
const JSON_OUT = flag('json', '');
const DRY_RUN = process.env.DRY_RUN !== '0';
const APPLY = process.env.AUDIT_EVIDENCE_SUBJECT_MATCH_APPLY === '1';

/**
 * Words that carry no identifying power in this corpus. "Church", "House" and "Historic District"
 * appear in a large share of display names AND in almost any historical document, so matching on
 * them would clear a mismatched document as easily as a correct one.
 */
const STOPWORDS = new Set([
  'the',
  'and',
  'of',
  'in',
  'at',
  'on',
  'for',
  'a',
  'an',
  'to',
  'house',
  'home',
  'building',
  'historic',
  'district',
  'site',
  'church',
  'chapel',
  'cemetery',
  'school',
  'hall',
  'center',
  'center',
  'park',
  'company',
  'no',
  'sr',
  'jr',
  'st',
  'saint',
  'mount',
  'mt',
  'new',
  'old',
  'north',
  'south',
  'east',
  'west',
  'baptist',
  'methodist',
  'episcopal',
  'african',
  'american',
  'colored',
  'negro',
  'black',
  'first',
  'second',
  'third',
  'memorial',
  'community',
  'county',
  'city',
  'town',
]);

/**
 * Tokens distinctive enough that their total absence from a document is meaningful. Proper nouns
 * and numbers survive; generic type words do not. Diacritics and punctuation are stripped because
 * OCR in these nominations is unreliable about both.
 */
export function distinctiveTokens(displayName: string): readonly string[] {
  return displayName
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter((token) => token.length >= 4 && !STOPWORDS.has(token));
}

export function normalizeForSearch(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, ' ');
}

/**
 * Word-boundary occurrence count. The normalized haystack is space-delimited, so padding both
 * sides turns a substring scan into a whole-word one — this is what stops "quarters" matching
 * "headquarters". Counting (rather than testing) is what separates a document about the subject
 * from one that merely collides with its name.
 */
export function countWholeWord(haystack: string, token: string): number {
  const needle = ` ${token} `;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    // Step by 1, not by needle.length: adjacent repeats share the delimiting space.
    index = haystack.indexOf(needle, index + 1);
  }
  return count;
}

/**
 * Does the evidence document's own title name the subject?
 *
 * This, not mention-frequency, is the discriminator for tier2. Counting mentions was tried first
 * and fails outright on exactly the documents that matter: the mis-attached sources are
 * general-encyclopedia articles long enough that common name words saturate them. Measured on the
 * confirmed cases — "davis" x57 and "union" x37 inside the Confederate-monuments article filed
 * under Lawrence A. Davis Student Union, "thomas" x61 under Keys, Thomas Isaac House, "hosanna" x5
 * (all Hosanna-Tabor, the Supreme Court case) inside the disability-rights timeline. Every one
 * clears any sane frequency bar while being the wrong document.
 *
 * A title is short and deliberate, so a shared distinctive token there is strong evidence and its
 * absence is strong evidence too.
 */
export function titleNamesSubject(title: string | null, tokens: readonly string[]): boolean {
  if (title === null) return false;
  const haystack = ` ${normalizeForSearch(title)} `;
  return tokens.some((token) => haystack.includes(` ${token} `));
}

/**
 * Does the title carry the entity's whole name, generic words and all?
 *
 * The strongest possible title signal, and the one that has to be checked FIRST, because the
 * place-word filtering below is blind to it. "Abbeville Colored School" in Abbeville reduces to no
 * distinctive tokens at all once "colored", "school" and the place word "abbeville" are removed —
 * yet its attached document is titled "Abbeville Colored School", which is as right as a document
 * can be. Whole-phrase containment recognizes that without weakening anything: "Caswell County,
 * North Carolina" does not contain "caswell county training school".
 */
export function titleCarriesWholeName(title: string | null, displayName: string): boolean {
  if (title === null) return false;
  // Roster names are inverted for filing ("Jude, George, House"), so compare on sorted words
  // rather than raw order — otherwise a correctly-titled document fails on comma placement alone.
  const words = (value: string) =>
    normalizeForSearch(value)
      .split(' ')
      .filter((w) => w.length > 0);
  const titleWords = new Set(words(title));
  const nameWords = words(displayName);
  return nameWords.length > 0 && nameWords.every((word) => titleWords.has(word));
}

type Row = {
  readonly entity_id: string;
  readonly display_name: string;
  readonly ev_id: string;
  readonly source_tier: string;
  readonly title: string | null;
  readonly content_text: string | null;
  readonly ledger_status: string | null;
  readonly city: string | null;
  readonly county: string | null;
  readonly state: string | null;
};

/**
 * Ignore location-only tokens for title-based identity checks. Otherwise a county article can
 * appear to identify every property whose name contains that county.
 */
export function placeWordsOf(row: Pick<Row, 'city' | 'county' | 'state'>): ReadonlySet<string> {
  return new Set(
    [row.city, row.county, row.state]
      .filter((value): value is string => typeof value === 'string' && value.length > 0)
      .flatMap((value) => normalizeForSearch(value).split(' '))
      .filter((token) => token.length > 0),
  );
}

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required (source apps/web/.env.local)');
  const pool = new pg.Pool(normalizePgConnectionString(databaseUrl));

  const rows = await pool.query<Row>(
    `SELECT lc.id AS entity_id, lc.display_name,
            lc.payload->>'city' AS city, lc.payload->>'county' AS county,
            lc.payload->>'state' AS state,
            ev.id AS ev_id, ev.source_tier, ev.title, ev.content_text,
            ee.status AS ledger_status
       FROM research.landscape_candidates lc
       JOIN research.entity_evidence ev ON ev.entity_id = lc.id AND ev.status = 'captured'
       LEFT JOIN research.entity_enrichment ee ON ee.entity_id = lc.id
      WHERE lc.lane = $1
      ORDER BY lc.id, ev.source_tier`,
    [LANE],
  );

  type Finding = {
    entityId: string;
    displayName: string;
    evidenceId: string;
    sourceTier: string;
    title: string | null;
    ledgerStatus: string | null;
    tokensTried: readonly string[];
    bestToken: string;
    bestCount: number;
    textLength: number;
    excerpt: string;
  };

  const findings: Finding[] = [];
  const entitiesSeen = new Set<string>();
  const entitiesFlagged = new Set<string>();
  const entitiesWithAnyMatch = new Set<string>();
  let noDistinctiveToken = 0;
  let docsChecked = 0;

  for (const row of rows.rows) {
    entitiesSeen.add(row.entity_id);
    const text = row.content_text ?? '';
    if (text.length === 0) continue;
    docsChecked += 1;

    const tokens = distinctiveTokens(row.display_name);
    if (tokens.length === 0) {
      // e.g. "Old West Baltimore Historic District" reduces to "baltimore"; a name that reduces to
      // nothing cannot be judged either way, and counting it as a mismatch would be a false alarm.
      noDistinctiveToken += 1;
      entitiesWithAnyMatch.add(row.entity_id);
      continue;
    }

    // Body matching retains full name tokens, but title matching excludes tokens that merely
    // repeat the subject's location.
    const placeWords = placeWordsOf(row);
    const titleTokens = tokens.filter((token) => !placeWords.has(token));

    const haystack = ` ${normalizeForSearch(text)} `;

    // Best evidence of aboutness is the strongest single token — the rarest, most specific word in
    // the name. Summing across tokens would let a name like "Lawrence A. Davis Student Union"
    // accumulate a passing score from four independently common words, which is exactly the false
    // negative this replaces.
    let bestToken = tokens[0]!;
    let bestCount = -1;
    for (const token of tokens) {
      const count = countWholeWord(haystack, token);
      if (count > bestCount) {
        bestCount = count;
        bestToken = token;
      }
    }

    // The usable signal differs by tier, so the test does too.
    //
    // tier1: the title is GENERATED from the display name upstream ("National Register
    //   nomination — <name>"), so it always matches and proves nothing. Only the body can speak,
    //   and a nomination whose body never once names its own subject is wrong or truncated —
    //   Castle Rock's nomination text is about the Dr. A. Porter Davis Residence.
    // tier2: the body is a general article far too long for mention-counting to mean anything
    //   (see titleNamesSubject). The title is the honest signal.
    //
    // A name that is ONLY its place ("Warren County Community Center" in Warren County) leaves
    // titleTokens empty. That is not evidence of a good attachment, so it cannot pass by default —
    // fall back to requiring the body to name the subject, which a county article will not do
    // beyond the place word itself.
    const looksRight =
      row.source_tier === 'tier1'
        ? bestCount > 0
        : titleCarriesWholeName(row.title, row.display_name) ||
          (titleTokens.length > 0
            ? titleNamesSubject(row.title, titleTokens)
            : bestCount > 0 && !placeWords.has(bestToken));

    if (looksRight) {
      entitiesWithAnyMatch.add(row.entity_id);
    } else {
      entitiesFlagged.add(row.entity_id);
      findings.push({
        entityId: row.entity_id,
        displayName: row.display_name.trim(),
        evidenceId: row.ev_id,
        sourceTier: row.source_tier,
        title: row.title,
        ledgerStatus: row.ledger_status,
        tokensTried: tokens,
        bestToken,
        bestCount,
        textLength: text.length,
        excerpt: text.slice(0, 160).replace(/\s+/gu, ' '),
      });
    }
  }

  // An entity is only really broken if NO attached document mentions it. One bad doc alongside a
  // good nomination is noise; zero good docs is why a drafter had nothing to work with.
  const fullyMismatched = [...entitiesFlagged].filter((id) => !entitiesWithAnyMatch.has(id));

  console.log(`Lane: ${LANE}`);
  console.log(`Entities with captured evidence: ${entitiesSeen.size}`);
  console.log(`Evidence documents checked:      ${docsChecked}`);
  console.log(`Names too generic to judge:      ${noDistinctiveToken} document(s)\n`);
  console.log(`Documents not mentioning their entity: ${findings.length}`);
  console.log(`Entities where NO attached document mentions them: ${fullyMismatched.length}`);
  if (entitiesSeen.size > 0) {
    const pct = ((fullyMismatched.length / entitiesSeen.size) * 100).toFixed(1);
    console.log(`  = ${pct}% of the lane's evidence-bearing entities\n`);
  }

  const byStatus = new Map<string, number>();
  for (const id of fullyMismatched) {
    const status = findings.find((f) => f.entityId === id)?.ledgerStatus ?? '(none)';
    byStatus.set(status, (byStatus.get(status) ?? 0) + 1);
  }
  console.log('Fully-mismatched entities by ledger status:');
  for (const [status, n] of [...byStatus].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(5)}  ${status}`);
  }

  console.log(`\nSamples (up to ${SAMPLES}):`);
  for (const id of fullyMismatched.slice(0, SAMPLES)) {
    const f = findings.find((x) => x.entityId === id)!;
    console.log(`\n  ${f.entityId} — ${f.displayName}  [${f.ledgerStatus ?? 'no ledger row'}]`);
    console.log(`    looked for: ${f.tokensTried.join(', ')}`);
    console.log(
      `    best "${f.bestToken}" x${f.bestCount} in ${f.textLength.toLocaleString()} chars ` +
        `(${f.sourceTier === 'tier1' ? 'tier1: body must name subject' : 'tier2: title must name subject'})`,
    );
    console.log(`    attached  : ${f.sourceTier} "${f.title ?? '(untitled)'}"`);
    console.log(`    begins    : ${f.excerpt}…`);
  }

  if (JSON_OUT.length > 0) {
    writeFileSync(
      JSON_OUT,
      JSON.stringify(
        { lane: LANE, entitiesSeen: entitiesSeen.size, docsChecked, fullyMismatched, findings },
        null,
        2,
      ),
    );
    console.log(`\nFull findings -> ${JSON_OUT}`);
  }

  // Only the searched tier2 documents are actionable. See the header for why tier1 nomination
  // captures are flagged but never quarantined.
  const quarantineIds = findings
    .filter((f) => f.sourceTier !== 'tier1')
    .filter((f) => fullyMismatched.includes(f.entityId))
    .map((f) => f.evidenceId);
  const uniqueQuarantineIds = [...new Set(quarantineIds)];
  const tier1Flagged = findings.filter(
    (f) => f.sourceTier === 'tier1' && fullyMismatched.includes(f.entityId),
  ).length;

  console.log('\n=== DISPOSITION ===');
  console.log(`quarantine (tier2, searched):      ${uniqueQuarantineIds.length} document(s)`);
  console.log(`leave alone (tier1, refnum-addressed, capture-quality issue): ${tier1Flagged}`);

  if (uniqueQuarantineIds.length === 0) {
    await pool.end();
    return;
  }

  if (DRY_RUN || !APPLY) {
    console.log(
      '\nDRY_RUN (default): no writes. Set DRY_RUN=0 AUDIT_EVIDENCE_SUBJECT_MATCH_APPLY=1 to apply.',
    );
    await pool.end();
    return;
  }

  // Record the specific subject-match reason separately from the earlier identity-gate result.
  const result = await pool.query(
    `UPDATE research.entity_evidence
        SET status = 'quarantined',
            provenance = coalesce(provenance, '{}'::jsonb) || jsonb_build_object(
              'quarantineReason', 'subject-match: document title does not name the entity (repo-pjob)',
              'quarantinedBy', 'audit-evidence-subject-match',
              'previousStatus', status
            )
      WHERE id = ANY($1::text[]) AND status = 'captured'`,
    [uniqueQuarantineIds],
  );
  console.log(`\nApplied: ${result.rowCount} evidence row(s) quarantined.`);

  const stranded = await pool.query<{ n: string }>(
    `SELECT count(*) AS n FROM research.entity_enrichment ee
      WHERE ee.lane = $1 AND ee.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM research.entity_evidence ev
           WHERE ev.entity_id = ee.entity_id AND ev.status = 'captured')`,
    [LANE],
  );
  console.log(
    `Lane now has ${stranded.rows[0]?.n} pending entit(ies) with no captured evidence — these ` +
      `are re-sweep candidates, not drafting candidates.`,
  );

  await pool.end();
}

// Only run when invoked as a script. The token rules above are unit-tested, and importing this
// module to test them must not open a database connection or start an audit as a side effect.
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

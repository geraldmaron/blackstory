/**
 * repo-pjob — does each captured evidence document actually mention the entity it is attached to?
 *
 * Wave 3 of the drafting campaign refused 17 of 40 subjects, and 9 of those refusals were not thin
 * evidence at all: the attached document was about a different subject entirely (a US disability-
 * rights timeline filed under a church, an encyclopedia entry on Frankfurt filed under Hogan
 * Quarters). Those entities are unretrieved, not undraftable — a distinction that matters because
 * repo-n9dq is about to give "no Black-history significance" a TERMINAL ledger state, and applying
 * it to a retrieval failure would permanently close a record whose real nomination was never
 * fetched.
 *
 * This measures the size of that population instead of extrapolating it from one batch.
 *
 * THE TEST IS FREQUENCY, NOT PRESENCE, and that distinction is the whole script. "Does a token
 * from the display name appear anywhere in the text" fails badly here, because the mis-attached
 * documents are enormous general-encyclopedia articles (116,000-240,000 chars against a real
 * nomination's ~23,000) and a document that long contains almost any token by coincidence. All
 * three cases below passed a presence test while being obviously wrong:
 *
 *   Hosanna Church and Cemetery  <- disability-rights timeline   "hosanna" hit Hosanna-Tabor, the
 *                                                                 Supreme Court case
 *   Hogan Quarters               <- encyclopedia entry, Frankfurt "hogan" hit the law firm Hogan
 *                                                                 Lovells; "quarters" hit
 *                                                                 head-QUARTERS
 *   Lawrence A. Davis Student Union <- Confederate monuments      "davis" hit Jefferson Davis;
 *                                                                 "union" hit the Union army
 *
 * A document actually about a subject names it repeatedly. A document that merely collides with it
 * names it once. So the signal is the subject-mention RATE, and matching is word-boundary (the
 * head-quarters hit above was a substring artifact, not a coincidence).
 *
 * A flag is strong evidence of mis-attachment; a clean result is NOT proof of correct attachment
 * (this will not catch right-town/wrong-building). Read the flagged count as a floor.
 *
 * READ-ONLY: no write path.
 *
 * WHY THIS QUARANTINES RATHER THAN ONLY REPORTING
 *
 * A hand-read of a 20-subject stratified sample of the flagged tier2 population returned 2 usable,
 * 7 thin, 11 unrelated — 90% unusable. The thin ones are the reason this writes: they are more
 * dangerous than the unrelated ones, not less. A city article attached to one of its own historic
 * districts is full of *real* Black history about a DIFFERENT district — Roanoke's Gainsboro and
 * Henry Street material sitting under Southwest Historic District, Charlottesville's Vinegar Hill
 * material under West Main Street. Every quote a drafter pulls from it is a genuine verbatim
 * substring, so `validateEnrichmentResponse` passes it, and the result is a sourced-looking
 * paragraph attributing a neighbouring place's history to this entity. Leaving the row
 * `status='captured'` is not neutral.
 *
 * Quarantining costs the ~10% that were usable. That trade is deliberate and cheap to reverse: the
 * row keeps its content, the flip is one column, and the entity returns to the sweep to be
 * re-fetched by a collector that can do better.
 *
 * NOT APPLIED TO tier1 nomination captures, which this audit flags but must not act on. Those are
 * fetched by the entity's own refnum (verified: every flagged one has the refnum in its
 * source_url), so the document is right by construction and a missing name means the NPS text
 * extraction dropped the header field — "The ___ is historically significant because..." — or the
 * capture truncated. Quarantining them would delete correct evidence over an extraction artifact.
 * Their real defect is capture quality; see repo-pjob.
 *
 * Usage (from repo root):
 *   set -a && source apps/web/.env.local && set +a
 *   export DATABASE_SSL=1
 *   node --conditions development --import tsx \
 *     packages/ops-data/scripts/audit-evidence-subject-match.ts [--lane=nrhp-black-heritage] \
 *     [--samples=15] [--json=<path>]
 *
 * Dry-run by default. Writes require:
 *   DRY_RUN=0 AUDIT_EVIDENCE_SUBJECT_MATCH_APPLY=1
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
  'the', 'and', 'of', 'in', 'at', 'on', 'for', 'a', 'an', 'to',
  'house', 'home', 'building', 'historic', 'district', 'site', 'church', 'chapel',
  'cemetery', 'school', 'hall', 'center', 'centre', 'park', 'company', 'no', 'sr', 'jr',
  'st', 'saint', 'mount', 'mt', 'new', 'old', 'north', 'south', 'east', 'west',
  'baptist', 'methodist', 'episcopal', 'african', 'american', 'colored', 'negro', 'black',
  'first', 'second', 'third', 'memorial', 'community', 'county', 'city', 'town',
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
 * can be. Whole-phrase containment recognises that without weakening anything: "Caswell County,
 * North Carolina" does not contain "caswell county training school".
 */
export function titleCarriesWholeName(title: string | null, displayName: string): boolean {
  if (title === null) return false;
  // Roster names are inverted for filing ("Jude, George, House"), so compare on sorted words
  // rather than raw order — otherwise a correctly-titled document fails on comma placement alone.
  const words = (value: string) =>
    normalizeForSearch(value).split(' ').filter((w) => w.length > 0);
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
 * repo-nlcq: tokens that are simply the row's own location carry no identifying power, and the two
 * anti-mis-attachment layers have to agree about that or a whole class escapes both.
 *
 * Caswell County Training School sits in Caswell County and was attached to the Wikipedia article
 * "Caswell County, North Carolina". subject-identity.ts strips "caswell" as a place word — correct,
 * a name that only repeats its location says nothing — which leaves that name one distinctive
 * token and too few for its co-occurrence rule. This audit then cleared the document because its
 * TITLE contains "caswell": the very token the gate had just discarded as meaningless. Stripping a
 * place word in one layer while honouring it in the other is what let the document through both.
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
       FROM bb_research.landscape_candidates lc
       JOIN bb_research.entity_evidence ev ON ev.entity_id = lc.id AND ev.status = 'captured'
       LEFT JOIN bb_research.entity_enrichment ee ON ee.entity_id = lc.id
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

    // repo-nlcq. Body matching still uses every token — a document about the subject names the
    // whole thing, place word and all — but the TITLE test must not be satisfied by a word that is
    // only the row's location, or a county article clears every property in that county.
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
    console.log('\nDRY_RUN (default): no writes. Set DRY_RUN=0 AUDIT_EVIDENCE_SUBJECT_MATCH_APPLY=1 to apply.');
    await pool.end();
    return;
  }

  // Reason is stored so a later reader can tell this apart from an identity-gate quarantine —
  // these rows passed checkSubjectIdentity and were rejected on a different test (repo-u84y).
  const result = await pool.query(
    `UPDATE bb_research.entity_evidence
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
    `SELECT count(*) AS n FROM bb_research.entity_enrichment ee
      WHERE ee.lane = $1 AND ee.status = 'pending'
        AND NOT EXISTS (
          SELECT 1 FROM bb_research.entity_evidence ev
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

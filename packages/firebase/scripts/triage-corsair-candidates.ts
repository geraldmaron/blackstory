/**
 * Corsair candidate triage: inventory researchCases (state=candidate), bucket by URL/title
 * signal, apply admin transitions, write enrichment subject files under .cache/corsair-triage.
 *
 * After enrichment keeps land, run classify-corsair-keeps-against-catalog.ts so existing
 * catalog entities are enriched (not recreated) and lists/indexes are excluded.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServerFirebaseApp, FIRESTORE_ROOT } from '@repo/firebase';
import { getFirestore } from 'firebase-admin/firestore';
import { bulkTransitionAdminResearchCases } from '../../../apps/admin/src/cases/research-case-store.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../..');
const OUT_DIR = join(ROOT, '.cache/corsair-triage');
mkdirSync(OUT_DIR, { recursive: true });

const ACTOR_UID = 'overnight-hybrid-corsair';
const ACTOR_EMAIL = 'overnight-hybrid-corsair@blackstory.local';

const preferredHosts = JSON.parse(
  readFileSync(
    join(ROOT, 'packages/config/src/scheduled-jobs/data/corsair-web-search-queries.json'),
    'utf8',
  ),
).preferredHosts as string[];

const REJECT_HOST_PATTERNS = [
  /(^|\.)facebook\.com$/i,
  /(^|\.)fb\.com$/i,
  /(^|\.)instagram\.com$/i,
  /(^|\.)pinterest\.com$/i,
  /(^|\.)tiktok\.com$/i,
  /(^|\.)buzzfeed\.com$/i,
  /(^|\.)ranker\.com$/i,
  /(^|\.)listverse\.com$/i,
  /(^|\.)watchmojo\.com$/i,
  /(^|\.)havefunwithhistory\.com$/i,
  /(^|\.)theforgottengenerations\.com$/i,
  /(^|\.)urbangeekz\.com$/i,
];
const REJECT_TITLE_PATTERNS = [
  /^\d+\s+(black|most|famous|best|top|things|facts|ways|places)\b/i,
  /\btop\s+\d+\b/i,
  /\bbest\s+\d+\b/i,
  /\b\d+\s+(things|facts|ways|places|pioneers|inventors|scientists)\b/i,
  /\blisticle\b/i,
  /\bcelebrating black history month\b/i,
  /\bblack history month 20\d\d\b/i,
  /\bmost famous\b/i,
];
const HIGH_SIGNAL_HOST_PATTERNS = [
  /(^|\.)wikipedia\.org$/i,
  /(^|\.)wikidata\.org$/i,
  /(^|\.)nps\.gov$/i,
  /(^|\.)loc\.gov$/i,
  /(^|\.)archives\.gov$/i,
  /(^|\.)catalog\.archives\.gov$/i,
  /(^|\.)si\.edu$/i,
  /(^|\.)dp\.la$/i,
  /(^|\.)blackwomenleadproject\.org$/i,
  /(^|\.)nasa\.gov$/i,
  /(^|\.)orcid\.org$/i,
  /(^|\.)patents\.google\.com$/i,
];
const MEDIUM_SIGNAL_HOST_PATTERNS = [
  /\.edu$/i,
  /\.gov$/i,
  /library/i,
  /museum/i,
  /archive/i,
  /historical/i,
  /chroniclingamerica/i,
];

type Bucket = 'reject' | 'needs_evidence' | 'promote_worthy';

type TriageRow = {
  readonly caseId: string;
  readonly candidateId: string;
  readonly title: string;
  readonly url: string;
  readonly host: string;
  readonly adapterId: string;
  readonly bucket: Bucket;
  readonly reason: string;
  readonly score: number;
  readonly statement: string;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function matchesAny(host: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(host));
}

function preferredHostMatch(host: string): boolean {
  return preferredHosts.some((preferred) => host === preferred || host.endsWith(`.${preferred}`));
}

function triage(input: {
  readonly title: string;
  readonly url: string;
  readonly statement: string;
  readonly adapterId: string;
}): { readonly bucket: Bucket; readonly reason: string; readonly score: number } {
  const host = hostOf(input.url);

  if (!host || !input.url.startsWith('http')) {
    return { bucket: 'reject', reason: 'missing_or_invalid_url', score: 0 };
  }
  if (matchesAny(host, REJECT_HOST_PATTERNS)) {
    return { bucket: 'reject', reason: `reject_host:${host}`, score: 0 };
  }
  if (REJECT_TITLE_PATTERNS.some((pattern) => pattern.test(input.title) || pattern.test(input.url))) {
    return { bucket: 'reject', reason: 'listicle_or_bhm_landing', score: 0 };
  }
  if (
    /libguides\./i.test(host) &&
    /black history month|celebrating|resources guide|home -/i.test(input.title)
  ) {
    return { bucket: 'reject', reason: 'libguide_listicle_landing', score: 0 };
  }

  let score = 0;
  if (preferredHostMatch(host)) score += 4;
  if (matchesAny(host, HIGH_SIGNAL_HOST_PATTERNS)) score += 4;
  if (matchesAny(host, MEDIUM_SIGNAL_HOST_PATTERNS)) score += 2;
  if (/wikipedia|wikidata|nps\.gov|loc\.gov|archives\.gov|blackwomenleadproject/i.test(host)) {
    score += 2;
  }
  if (input.adapterId.includes('wikimedia') || input.adapterId.includes('wikipedia')) score += 3;
  if (input.statement.length > 120) score += 1;
  if (
    /Dr\.|Rev\.|Saint|Church|School|Hospital|Memorial|Association|Institute|University|College|Street|District|Movement|Massacre|Riots|Migration|Harlem|Boston|Tulsa|Montgomery/i.test(
      input.title,
    )
  ) {
    score += 1;
  }

  if (score >= 5) {
    return { bucket: 'promote_worthy', reason: `high_signal:${host}`, score };
  }
  if (score >= 2) {
    return { bucket: 'needs_evidence', reason: `medium_signal:${host}`, score };
  }
  return { bucket: 'reject', reason: `low_signal:${host}`, score };
}

async function loadInventory(): Promise<readonly TriageRow[]> {
  const { app } = createServerFirebaseApp(process.env);
  const db = getFirestore(app);
  const casesSnap = await db
    .collection(FIRESTORE_ROOT.researchCases)
    .where('state', '==', 'candidate')
    .get();
  const subsSnap = await db.collection(FIRESTORE_ROOT.submissionInbox).get();
  const subsById = new Map(subsSnap.docs.map((doc) => [doc.id, doc.data()]));

  const rows: TriageRow[] = [];
  for (const doc of casesSnap.docs) {
    const data = doc.data();
    const candidateId = String(data.candidateId ?? doc.id);
    const sub = subsById.get(candidateId);
    const payload = sub?.payload?.normalized ?? sub?.payload?.original?.payload ?? {};
    const url = String(sub?.sourceUrl ?? payload.sourceUrls?.[0] ?? '');
    const statement = String(payload.statement ?? '');
    const title = String(data.title ?? payload.title ?? doc.id);
    const adapterMatch = statement.match(/Source adapter: ([^\n]+)/);
    const adapterId = adapterMatch?.[1]?.trim() ?? 'unknown';
    const result = triage({ title, url, statement, adapterId });
    rows.push({
      caseId: doc.id,
      candidateId,
      title,
      url,
      host: hostOf(url),
      adapterId,
      bucket: result.bucket,
      reason: result.reason,
      score: result.score,
      statement: statement.slice(0, 400),
    });
  }
  return rows.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
}

function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    out.push(items.slice(index, index + size));
  }
  return out;
}

async function applyTwoStep(input: {
  readonly caseIds: readonly string[];
  readonly secondAction: 'exclude' | 'needs_evidence';
  readonly secondReason: string;
  readonly reasonCode: 'outside_scope' | 'insufficient_source_evidence';
}): Promise<{ readonly succeeded: number; readonly failed: number; readonly errors: unknown[] }> {
  let succeeded = 0;
  let failed = 0;
  const errors: unknown[] = [];

  for (const batch of chunk(input.caseIds, 50)) {
    const step1 = await bulkTransitionAdminResearchCases({
      caseIds: batch,
      request: {
        action: 'send_to_relevance',
        reason: 'Corsair triage: automated relevance pass before disposition.',
      },
      actorUid: ACTOR_UID,
      actorEmail: ACTOR_EMAIL,
    });
    succeeded += step1.succeeded;
    failed += step1.failed;
    errors.push(...step1.errors);

    const step2 = await bulkTransitionAdminResearchCases({
      caseIds: batch,
      request: {
        action: input.secondAction,
        reason: input.secondReason,
        reasonCode: input.reasonCode,
      },
      actorUid: ACTOR_UID,
      actorEmail: ACTOR_EMAIL,
    });
    succeeded += step2.succeeded;
    failed += step2.failed;
    errors.push(...step2.errors);
  }

  return { succeeded, failed, errors };
}

async function applySingleStep(input: {
  readonly caseIds: readonly string[];
  readonly reason: string;
}): Promise<{ readonly succeeded: number; readonly failed: number; readonly errors: unknown[] }> {
  let succeeded = 0;
  let failed = 0;
  const errors: unknown[] = [];
  for (const batch of chunk(input.caseIds, 50)) {
    const result = await bulkTransitionAdminResearchCases({
      caseIds: batch,
      request: { action: 'send_to_relevance', reason: input.reason },
      actorUid: ACTOR_UID,
      actorEmail: ACTOR_EMAIL,
    });
    succeeded += result.succeeded;
    failed += result.failed;
    errors.push(...result.errors);
  }
  return { succeeded, failed, errors };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const rows = await loadInventory();
  const counts = {
    reject: rows.filter((row) => row.bucket === 'reject').length,
    needs_evidence: rows.filter((row) => row.bucket === 'needs_evidence').length,
    promote_worthy: rows.filter((row) => row.bucket === 'promote_worthy').length,
  };

  writeFileSync(join(OUT_DIR, 'inventory.json'), JSON.stringify({ counts, rows }, null, 2));

  const promoteSubjects = rows
    .filter((row) => row.bucket === 'promote_worthy')
    .slice(0, 60)
    .map((row) => ({
      subjectId: row.caseId,
      title: row.title,
      kind: 'research_case',
      existingSummary: row.statement.slice(0, 400) || undefined,
      sourceSnippets: [row.statement, row.url].filter(Boolean),
    }))
    .map((subject) =>
      Object.fromEntries(Object.entries(subject).filter(([, value]) => value !== undefined)),
    );

  writeFileSync(
    join(OUT_DIR, 'enrichment-subjects.json'),
    JSON.stringify({ subjects: promoteSubjects, count: promoteSubjects.length }, null, 2),
  );

  if (!apply) {
    console.log(
      JSON.stringify(
        {
          mode: 'dry_run',
          total: rows.length,
          counts,
          enrichmentSubjectCount: promoteSubjects.length,
          inventoryPath: join(OUT_DIR, 'inventory.json'),
        },
        null,
        2,
      ),
    );
    return;
  }

  const rejectIds = rows.filter((row) => row.bucket === 'reject').map((row) => row.caseId);
  const needsIds = rows.filter((row) => row.bucket === 'needs_evidence').map((row) => row.caseId);
  const promoteIds = rows.filter((row) => row.bucket === 'promote_worthy').map((row) => row.caseId);

  const rejectResult = await applyTwoStep({
    caseIds: rejectIds,
    secondAction: 'exclude',
    secondReason:
      'Corsair triage: low-signal listicle/spam host — excluded from catalog pipeline.',
    reasonCode: 'outside_scope',
  });

  const needsResult = await applyTwoStep({
    caseIds: needsIds,
    secondAction: 'needs_evidence',
    secondReason: 'Corsair triage: parked pending stronger independent sources.',
    reasonCode: 'insufficient_source_evidence',
  });

  const promoteResult = await applySingleStep({
    caseIds: promoteIds,
    reason:
      'Corsair triage: high-signal authority lead — queued for relevance review and enrichment.',
  });

  const remainingSnap = await getFirestore(createServerFirebaseApp(process.env).app)
    .collection(FIRESTORE_ROOT.researchCases)
    .where('state', '==', 'candidate')
    .count()
    .get();

  const summary = {
    mode: 'apply',
    inventory: counts,
    transitions: {
      reject: rejectResult,
      needs_evidence: needsResult,
      promote_worthy: promoteResult,
    },
    remainingCandidateCount: remainingSnap.data().count,
    enrichmentSubjectCount: promoteSubjects.length,
  };

  writeFileSync(join(OUT_DIR, 'apply-summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

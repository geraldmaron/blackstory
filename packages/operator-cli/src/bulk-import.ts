
/**
 * CSV and markdown bulk-import parsing for operator leads, plus the batch runner. Also carries
 * the corpus-vetted bulk-import batch runner (see the module doc further down this file,
 * above `prepareCorpusBulkImportBatch`) — the exclusive execution surface for vetted-corpus bulk
 * intake; no second import framework exists anywhere in this repo.
 *
 * Parsing is pure and network-free: it only turns text into `LeadInput`. Each parsed row is
 * still run through the real validation inside `prepareOperatorIntake` malformed rows
 * are rejected individually (never silently dropped, never force-accepted) and reported in
 * the per-row outcome, exactly like a single `submit-lead` call would be.
 */
import {
  assertCorpusVettedForBulkImport,
  assertWithinCorpusBulkImportBudget,
  buildCorpusBulkImportBatchReport,
  evaluateCorpusBulkPromotion,
  selectSpotCheckSampleIndices,
  type CorpusBulkImportBatchReport,
  type CorpusBulkImportBatchRow,
  type CorpusBulkImportBudget,
  type CorpusBulkRecordCandidate,
  type CorpusVettingGateResult,
  type CorpusVettingStore,
  type SourceKillSwitchState,
  type SourceRegistryStore,
  type SpotCheckVerdict,
} from '@repo/domain';
import { buildOperatorAuditEvent, buildOperatorOutboxMessage } from './audit.js';
import {
  buildLeadSubmission,
  prepareOperatorIntake,
  type LeadInput,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
  type OperatorSubmission,
} from './intake.js';


/**
 * CSV columns (header row required, order-independent): title, description, url, sourceUrls
 * (semicolon-separated), location, era, targetRecordId, submitterContact. Only `description`
 * is required by this parser validation still requires at least one source URL.
 */
export function parseLeadsFromCsv(csvText: string): LeadInput[] {
  const rows = parseCsvRows(csvText);
  if (rows.length === 0) return [];
  const [header, ...body] = rows as [string[], ...string[][]];
  const columns = header.map((cell) => cell.trim().toLowerCase());
  return body
    .filter((row) => row.some((cell) => cell.trim().length > 0))
    .map((row) => {
      const get = (name: string): string | undefined => {
        const index = columns.indexOf(name);
        return index === -1 ? undefined : row[index]?.trim() || undefined;
      };
      const title = get('title');
      const url = get('url');
      const location = get('location');
      const era = get('era');
      const targetRecordId = get('targetrecordid');
      const submitterContact = get('submittercontact');
      const sourceUrls = get('sourceurls')
        ?.split(';')
        .map((value) => value.trim())
        .filter(Boolean);
      return {
        ...(title ? { title } : {}),
        description: get('description') ?? '',
        ...(url ? { url } : {}),
        ...(sourceUrls && sourceUrls.length > 0 ? { sourceUrls } : {}),
        ...(location ? { location } : {}),
        ...(era ? { era } : {}),
        ...(targetRecordId ? { targetRecordId } : {}),
        ...(submitterContact ? { submitterContact } : {}),
      } satisfies LeadInput;
    });
}

/** Minimal RFC4180-ish CSV parser: handles quoted fields, escaped quotes, and CRLF. */
function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const source = text.replace(/\r\n/gu, '\n');
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    if (inQuotes) {
      if (char === '"') {
        if (source[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((candidate) => !(candidate.length === 1 && candidate[0] === ''));
}

const MARKDOWN_FIELD_KEYS: Record<string, keyof LeadInput> = {
  description: 'description',
  url: 'url',
  source: 'url',
  location: 'location',
  era: 'era',
  target: 'targetRecordId',
  targetrecordid: 'targetRecordId',
  contact: 'submitterContact',
};


/**
 * Markdown bulk-import format: one `### <title>` heading per lead, followed by `Key: value`
 * lines (case-insensitive; `Description` may wrap multiple lines until the next key). `Source`
 * `Url` may repeat to attach more than one source URL. See
 * `.claude/skills/black-book/research-intake/SKILL.md` and
 * `docs/runbooks/operator-session.md` for a worked example.
 */
export function parseLeadsFromMarkdown(markdownText: string): LeadInput[] {
  const lines = markdownText.replace(/\r\n/gu, '\n').split('\n');
  const leads: LeadInput[] = [];
  let title: string | undefined;
  let description = '';
  let location: string | undefined;
  let era: string | undefined;
  let targetRecordId: string | undefined;
  let submitterContact: string | undefined;
  const sourceUrls: string[] = [];
  let activeKey: keyof LeadInput | undefined;

  function flush(): void {
    if (title === undefined && description.trim() === '') return;
    leads.push({
      ...(title ? { title } : {}),
      description: description.trim(),
      ...(sourceUrls.length > 0 ? { sourceUrls: [...sourceUrls] } : {}),
      ...(location ? { location } : {}),
      ...(era ? { era } : {}),
      ...(targetRecordId ? { targetRecordId } : {}),
      ...(submitterContact ? { submitterContact } : {}),
    });
  }

  // Only a level-3 heading (`### Title`) starts a new lead. Other heading levels (e.g. a
  // level-1 batch title above the first lead) are ignored rather than treated as boundaries.
  const leadHeadingPattern = /^###\s+(.*)$/u;
  const otherHeadingPattern = /^#{1,6}\s+.*$/u;
  const fieldPattern = /^-?\s*([A-Za-z][\w ]*):\s*(.*)$/u;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (otherHeadingPattern.test(line) && !leadHeadingPattern.test(line)) {
      continue;
    }
    const heading = leadHeadingPattern.exec(line);
    if (heading) {
      flush();
      title = heading[1]?.trim();
      description = '';
      location = undefined;
      era = undefined;
      targetRecordId = undefined;
      submitterContact = undefined;
      sourceUrls.length = 0;
      activeKey = undefined;
      continue;
    }
    if (title === undefined) continue; // ignore preamble before the first heading
    if (line === '') {
      activeKey = undefined;
      continue;
    }
    const field = fieldPattern.exec(line);
    if (field) {
      const key = MARKDOWN_FIELD_KEYS[field[1]!.trim().toLowerCase().replace(/\s+/gu, '')];
      const value = field[2]!.trim();
      if (key === 'url') {
        sourceUrls.push(value);
        activeKey = undefined;
      } else if (key === 'description') {
        description = description ? `${description}\n${value}` : value;
        activeKey = 'description';
      } else if (key === 'location') {
        location = value;
        activeKey = undefined;
      } else if (key === 'era') {
        era = value;
        activeKey = undefined;
      } else if (key === 'targetRecordId') {
        targetRecordId = value;
        activeKey = undefined;
      } else if (key === 'submitterContact') {
        submitterContact = value;
        activeKey = undefined;
      } else {
        // Unrecognized key: treat the whole line as description continuation.
        description = description ? `${description}\n${line}` : line;
        activeKey = 'description';
      }
      continue;
    }
    if (activeKey === 'description') {
      description = description ? `${description}\n${line}` : line;
    }
  }
  flush();
  return leads;
}

export type BulkImportFormat = 'csv' | 'markdown';

export function parseLeadsFromText(text: string, format: BulkImportFormat): LeadInput[] {
  return format === 'csv' ? parseLeadsFromCsv(text) : parseLeadsFromMarkdown(text);
}

export type BulkImportRowOutcome = OperatorIntakeOutcome & { readonly rowIndex: number };

export type BulkImportSummary = {
  readonly total: number;
  readonly acceptedCount: number;
  readonly rejectedCount: number;
  readonly rows: readonly BulkImportRowOutcome[];
};


/**
 * Runs every parsed row through the same intake path as `submit-lead`, one row at a time.
 * A rejected row never blocks the rest of the batch and never receives special-cased handling.
 */
export function prepareBulkLeadIntake(
  rows: readonly LeadInput[],
  context: OperatorIntakeContext,
): BulkImportSummary {
  const outcomes = rows.map((row, rowIndex): BulkImportRowOutcome => {
    const outcome = prepareOperatorIntake('bulk_import_row', buildLeadSubmission(row), context, {
      openDraftCase: true,
    });
    return { ...outcome, rowIndex };
  });
  return {
    total: outcomes.length,
    acceptedCount: outcomes.filter((outcome) => outcome.accepted).length,
    rejectedCount: outcomes.filter((outcome) => !outcome.accepted).length,
    rows: outcomes,
  };
}

// ---------------------------------------------------------------------------
// Vetted-corpus bulk-import batch runner — the exclusive execution surface for
// corpus-vetted bulk intake. Every hard gate from the standard pipeline
// survives (citation completeness, precision, notability; see
// `@repo/domain`'s `evaluateCorpusBulkPromotion`); this function's own job is: (1) the
// fail-closed corpus-vetting + kill-switch gate, (2) the per-batch budget cap, (3) idempotent
// duplicate detection, (4) routing every non-duplicate row through the SAME `prepareOperatorIntake`
// quarantine path `prepareBulkLeadIntake` above uses a corpus_fast_track record is still an
// ordinary quarantine submission, just pre-annotated with its auto-derived notability/precision
// facts, never a second writer. Pure: like every other `prepare*`
// function in this file, it returns unexecuted mutations for a caller to pass to `commitOperatorIntake`
// (`./commit.ts`) nothing is written here.
// ---------------------------------------------------------------------------

export type CorpusBulkImportRowResult = {
  readonly row: CorpusBulkImportBatchRow;
  /** Absent only for `outcome === 'skipped_duplicate'` rows those never reach real intake. */
  readonly intakeOutcome?: OperatorIntakeOutcome;
};

export type CorpusBulkImportBatchResult = {
  readonly report: CorpusBulkImportBatchReport;
  readonly rows: readonly CorpusBulkImportRowResult[];
  readonly gate: CorpusVettingGateResult;
  readonly auditEvent: ReturnType<typeof buildOperatorAuditEvent>;
  readonly outboxMessage: ReturnType<typeof buildOperatorOutboxMessage>;
};

export type PrepareCorpusBulkImportBatchInput = {
  readonly corpusId: string;
  readonly batchId: string;
  readonly candidates: readonly CorpusBulkRecordCandidate[];
  readonly registryStore: SourceRegistryStore;
  readonly vettingStore: CorpusVettingStore;
  readonly killSwitch?: SourceKillSwitchState | null;
  readonly budget: CorpusBulkImportBudget;
  readonly priorRecordsInWindow?: number;
  /** `sourceRecordId`s already imported for this corpus in a prior run (idempotent re-runs).
   * The caller derives this from real prior-batch reports; this function never re-derives it
   * from a live store. */
  readonly alreadyImportedSourceRecordIds: ReadonlySet<string>;
  /** Human spot-check verdicts recorded so far, keyed by `sourceRecordId`. Omit entirely for the
   * first pass over a batch (the sample is selected but every selected row demotes to
   * `standard_consensus` with `spot_check_not_yet_sampled` until a verdict is supplied here on
   * a follow-up call) — this mirrors `evaluateCorpusBulkPromotion`'s own two-phase design. */
  readonly spotCheckVerdicts?: ReadonlyMap<string, SpotCheckVerdict>;
  readonly spotCheckSampleFraction?: number;
  readonly context: OperatorIntakeContext;
  readonly generatedAt?: string;
};

function candidateSourceUrls(candidate: CorpusBulkRecordCandidate): readonly string[] {
  const urls = candidate.citations
    .map((citation) => (citation.location.kind === 'url' ? citation.location.url : undefined))
    .filter((url): url is string => Boolean(url));
  return [...new Set(urls)];
}

function stringifyRejection(outcome: OperatorIntakeOutcome): string | undefined {
  if (outcome.accepted) return undefined;
  return outcome.rejection.issues.map((issue) => `${issue.field}: ${issue.message}`).join('; ') || 'rejected';
}


/**
 * Runs one corpus-vetted bulk-import batch through every hard gate and the standard quarantine
 * intake path. Never throws on a per-record basis an ineligible or duplicate record demotes
 * skips rather than failing the whole batch; only the fail-closed corpus-vetting gate and the
 * budget cap can throw for the batch as a whole.
 */
export function prepareCorpusBulkImportBatch(
  input: PrepareCorpusBulkImportBatchInput,
): CorpusBulkImportBatchResult {
  const gate = assertCorpusVettedForBulkImport(
    input.registryStore,
    input.vettingStore,
    input.corpusId,
    input.killSwitch,
  );
  assertWithinCorpusBulkImportBudget({
    budget: input.budget,
    batchRecordCount: input.candidates.length,
    ...(input.priorRecordsInWindow !== undefined
      ? { priorRecordsInWindow: input.priorRecordsInWindow }
      : {}),
  });

  const newCandidates = input.candidates.filter(
    (candidate) => !input.alreadyImportedSourceRecordIds.has(candidate.sourceRecordId),
  );
  const sampleIndices = new Set(
    selectSpotCheckSampleIndices(newCandidates.length, input.spotCheckSampleFraction),
  );

  const generatedAt = input.generatedAt ?? new Date().toISOString();
  const rows: CorpusBulkImportRowResult[] = [];
  let newCandidateIndex = 0;

  for (const candidate of input.candidates) {
    if (input.alreadyImportedSourceRecordIds.has(candidate.sourceRecordId)) {
      // Duplicate: evaluated only so the report carries a consistent decision shape never
      // routed through intake a second time.
      const decision = evaluateCorpusBulkPromotion({
        vetting: gate.vetting,
        candidate,
        spotCheckSelected: false,
        evidenceIds: [],
      });
      rows.push({ row: { candidate, decision, outcome: 'skipped_duplicate' } });
      continue;
    }

    const spotCheckSelected = sampleIndices.has(newCandidateIndex);
    newCandidateIndex += 1;
    const spotCheckVerdict = input.spotCheckVerdicts?.get(candidate.sourceRecordId);

    const decision = evaluateCorpusBulkPromotion({
      vetting: gate.vetting,
      candidate,
      spotCheckSelected,
      ...(spotCheckVerdict ? { spotCheckVerdict } : {}),
      evidenceIds: candidate.citations.map(
        (_citation, citationIndex) => `${input.corpusId}:${candidate.sourceRecordId}:citation:${citationIndex}`,
      ),
    });

    const submission: OperatorSubmission = {
      kind: 'contribution',
      title: candidate.title,
      statement:
        `Corpus-vetted bulk import candidate.\n\n` +
        `Corpus: ${gate.vetting.corpusDisplayName} (${input.corpusId})\n` +
        `Batch: ${input.batchId}\n` +
        `Source record: ${candidate.sourceRecordId}\n` +
        `Promotion lane: ${decision.lane}` +
        (decision.reasons.length > 0 ? ` (${decision.reasons.join(', ')})` : ''),
      sourceUrls: candidateSourceUrls(candidate),
    };

    const rowContext: OperatorIntakeContext = {
      ...input.context,
      reason: ` corpus bulk import: ${input.corpusId}/${input.batchId}/${candidate.sourceRecordId}`,
    };
    const intakeOutcome = prepareOperatorIntake('bulk_import_row', submission, rowContext, {
      openDraftCase: false,
      caseTitle: candidate.title,
    });

    const rejectionReason = stringifyRejection(intakeOutcome);
    rows.push({
      row: {
        candidate,
        decision,
        outcome: intakeOutcome.accepted ? 'accepted' : 'rejected',
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
      },
      intakeOutcome,
    });
  }

  const report = buildCorpusBulkImportBatchReport({
    corpusId: input.corpusId,
    batchId: input.batchId,
    generatedAt,
    rows: rows.map((result) => result.row),
  });

  const idempotencyKey = `corpus-bulk-import:${input.corpusId}:${input.batchId}`;
  const auditEvent = buildOperatorAuditEvent({
    action: 'research.created',
    subject: {
      type: 'corpusBulkImportBatch',
      id: input.batchId,
      path: `corpusBulkImportBatches/${input.corpusId}/${input.batchId}`,
    },
    identity: input.context.identity,
    reason: ` corpus-vetted bulk import batch: ${report.counts.accepted}/${report.counts.total} accepted.`,
    now: generatedAt,
    idempotencyKey,
    data: { report: report as unknown as Readonly<Record<string, unknown>> },
  });
  const outboxMessage = buildOperatorOutboxMessage({
    auditEvent,
    topic: 'operator.corpus_bulk_import.batch_completed',
    aggregateType: 'corpusBulkImportBatch',
    aggregateId: input.batchId,
    payload: { corpusId: input.corpusId, batchId: input.batchId, counts: report.counts },
    now: generatedAt,
  });

  return { report, rows, gate, auditEvent, outboxMessage };
}

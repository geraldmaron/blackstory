/**
 * CSV and markdown bulk-import parsing for operator leads, plus the batch runner.
 *
 * Parsing is pure and network-free: it only turns text into `LeadInput[]`. Each parsed row is
 * still run through the real BB-029 validation inside `prepareOperatorIntake` — malformed rows
 * are rejected individually (never silently dropped, never force-accepted) and reported in
 * the per-row outcome, exactly like a single `submit-lead` call would be.
 */
import {
  buildLeadSubmission,
  prepareOperatorIntake,
  type LeadInput,
  type OperatorIntakeContext,
  type OperatorIntakeOutcome,
} from './intake.js';

/**
 * CSV columns (header row required, order-independent): title, description, url, sourceUrls
 * (semicolon-separated), location, era, targetRecordId, submitterContact. Only `description`
 * is required by this parser — BB-029 validation still requires at least one source URL.
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
 * / `Url` may repeat to attach more than one source URL. See
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

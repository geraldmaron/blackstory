/**
 * Deterministic line parser and manual-entry constructor for atomic claim drafts.
 */
import type {
  AtomicityAssessment,
  ClaimDraft,
  ExtractionUncertainty,
  ManualClaimEntry,
  ParsedClaimLine,
} from './types.js';

const CLAUSE_SEPARATOR = /(?:[.;!?]\s+|\s+(?:and|or|but)\s+)/iu;

function nonEmpty(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed) throw new Error(`${label} is required`);
  return trimmed;
}

function splitEscapedPipe(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let escaped = false;
  for (const character of line) {
    if (escaped) {
      current += character;
      escaped = false;
    } else if (character === '\\') {
      escaped = true;
    } else if (character === '|') {
      fields.push(current.trim());
      current = '';
    } else {
      current += character;
    }
  }
  if (escaped) current += '\\';
  fields.push(current.trim());
  return fields;
}

export function assessAtomicity(predicate: string, object: string): AtomicityAssessment {
  const combined = `${predicate.trim()} ${object.trim()}`;
  const separators = combined.match(new RegExp(CLAUSE_SEPARATOR.source, 'giu')) ?? [];
  const assertionCount = separators.length + 1;
  return {
    assertionCount,
    independentlySupportable: assertionCount === 1,
    rationale:
      assertionCount === 1
        ? 'No deterministic multi-assertion separator was detected.'
        : `Detected ${String(separators.length)} possible assertion separator(s).`,
  };
}

/**
 * Parse one claim per non-comment line using:
 * `entityId | predicate | object`. A literal pipe is escaped as `\|`.
 */
export function parseClaimLines(input: string): ParsedClaimLine[] {
  const parsed: ParsedClaimLine[] = [];
  for (const [index, rawLine] of input.replace(/\r\n?/gu, '\n').split('\n').entries()) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const fields = splitEscapedPipe(line);
    if (fields.length !== 3) {
      throw new Error(`Line ${String(index + 1)} must contain exactly three pipe-delimited fields`);
    }
    const [rawEntityId, rawPredicate, rawObject] = fields as [string, string, string];
    const entityId = nonEmpty(rawEntityId, `Line ${String(index + 1)} entityId`);
    const predicate = nonEmpty(rawPredicate, `Line ${String(index + 1)} predicate`);
    const object = nonEmpty(rawObject, `Line ${String(index + 1)} object`);
    const atomicity = assessAtomicity(predicate, object);
    const uncertainties: ExtractionUncertainty[] = atomicity.independentlySupportable
      ? []
      : [
          {
            code: 'atomicity',
            detail: atomicity.rationale,
            recordedBy: 'parser',
          },
        ];
    parsed.push({
      lineNumber: index + 1,
      draft: { entityId, predicate, object },
      uncertainties,
    });
  }
  return parsed;
}

export function createManualClaimEntry(input: {
  readonly id: string;
  readonly extractedAt: string;
  readonly extractedBy: string;
  readonly draft: ClaimDraft;
  readonly uncertainties: readonly ExtractionUncertainty[];
}): ManualClaimEntry {
  return {
    id: nonEmpty(input.id, 'Manual entry id'),
    extractedAt: nonEmpty(input.extractedAt, 'Manual extraction timestamp'),
    extractedBy: nonEmpty(input.extractedBy, 'Manual extractor'),
    draft: {
      ...input.draft,
      claimId: nonEmpty(input.draft.claimId, 'Claim id'),
      claimVersionId: nonEmpty(input.draft.claimVersionId, 'Claim version id'),
      entityId: nonEmpty(input.draft.entityId, 'Entity id'),
      predicate: nonEmpty(input.draft.predicate, 'Predicate'),
      object: nonEmpty(input.draft.object, 'Object'),
    },
    uncertainties: [...input.uncertainties],
  };
}

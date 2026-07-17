/**
 * Strong / medium / weak signal extraction integrating query-pack classification (BB-039).
 */
import type { AdapterCandidateRecord } from '../adapters/types.js';
import {
  classifySignalStrength,
  evaluateTextAgainstTerms,
  type ClassifySignalResult,
} from '../query-packs/index.js';
import type { QueryPack, QueryTerm } from '../query-packs/types.js';
import type { DiscoverySignal } from './types.js';

function collectSearchableText(record: AdapterCandidateRecord): string {
  const parts: string[] = [];
  if (record.title) {
    parts.push(record.title);
  }
  if (record.classification) {
    parts.push(record.classification);
  }
  if (record.payload) {
    for (const value of Object.values(record.payload)) {
      if (typeof value === 'string') {
        parts.push(value);
      }
    }
  }
  return parts.join(' ');
}

export function matchTermsInCandidate(
  record: AdapterCandidateRecord,
  terms: readonly QueryTerm[],
): readonly QueryTerm[] {
  const text = collectSearchableText(record);
  return evaluateTextAgainstTerms(text, terms);
}

export function classifyDiscoverySignal(
  record: AdapterCandidateRecord,
  pack: QueryPack,
): ClassifySignalResult {
  const matchedTerms = matchTermsInCandidate(record, pack.terms);
  return classifySignalStrength({ matchedTerms });
}

export function toDiscoverySignal(
  result: ClassifySignalResult,
  matchedTerms: readonly QueryTerm[],
): DiscoverySignal {
  return {
    strength: result.strength,
    outcome: result.outcome,
    matchedClasses: result.matchedClasses,
    matchedTerms: matchedTerms.map((term) => term.text),
    reasons: result.reasons,
  };
}

export function extractDiscoverySignals(
  record: AdapterCandidateRecord,
  pack: QueryPack,
): DiscoverySignal {
  const matchedTerms = matchTermsInCandidate(record, pack.terms);
  return toDiscoverySignal(classifySignalStrength({ matchedTerms }), matchedTerms);
}

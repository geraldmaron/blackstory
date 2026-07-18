/**
 * Presentation-only string helpers for fact registry components.
 */
import {
  FACT_CONFIDENCE_DEFINITIONS,
  type FactConfidenceGrade,
  type FactStatus,
} from '@blap/domain/facts';

export function humanizeToken(value: string): string {
  return value
    .split(/[_-]/)
    .filter((word) => word.length > 0)
    .map((word) => (word.charAt(0).toUpperCase() + word.slice(1)))
    .join(' ');
}

export function formatIsoDate(value: string): string {
  const [datePart] = value.split('T');
  return datePart && datePart.length > 0 ? datePart : value;
}

export function confidenceDefinition(grade: FactConfidenceGrade): string {
  return FACT_CONFIDENCE_DEFINITIONS[grade];
}

export function statusBannerTitle(status: FactStatus): string | undefined {
  switch (status) {
    case 'corrected':
      return 'Corrected fact record';
    case 'superseded':
      return 'Superseded fact record';
    case 'deprecated':
      return 'Deprecated fact record';
    default:
      return undefined;
  }
}

export function mapConfidenceToUiLevel(
  grade: FactConfidenceGrade,
): 'high' | 'medium' | 'low' {
  switch (grade) {
    case 'established':
    case 'corroborated':
      return 'high';
    case 'single-source':
      return 'medium';
    case 'contested':
    default:
      return 'low';
  }
}

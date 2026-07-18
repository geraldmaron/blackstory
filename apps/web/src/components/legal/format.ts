/**
 * Presentation-only string helpers for legal landscape components.
 */
import { LAW_STATUSES, type LawStatus } from '@blap/domain/entity-status';
import { LEGAL_KIND_LABELS, LEGAL_TOPIC_LABELS } from './copy';

const LAW_STATUS_LABELS: Readonly<Record<LawStatus, string>> = {
  in_force: 'In force',
  amended: 'Amended',
  repealed: 'Repealed',
  struck_down: 'Struck down',
  enjoined: 'Enjoined',
};

export type LawStatusTone = 'neutral' | 'info' | 'warning' | 'error';

export function humanizeLegalKind(kind: string): string {
  return LEGAL_KIND_LABELS[kind] ?? kind;
}

export function humanizeLegalTopic(topic: string): string {
  return LEGAL_TOPIC_LABELS[topic] ?? topic;
}

export function formatReviewDate(isoDate: string): string {
  const [datePart] = isoDate.split('T');
  return datePart && datePart.length > 0 ? datePart : isoDate;
}

export function legalStatusDisplay(status: LawStatus): string {
  return LAW_STATUS_LABELS[status];
}

export function lawStatusTone(status: LawStatus): LawStatusTone {
  switch (status) {
    case 'in_force':
      return 'neutral';
    case 'amended':
      return 'info';
    case 'enjoined':
      return 'warning';
    case 'repealed':
    case 'struck_down':
      return 'error';
    default: {
      const _exhaustive: never = status;
      return _exhaustive;
    }
  }
}

export function isLawStatus(value: string): value is LawStatus {
  return (LAW_STATUSES as readonly string[]).includes(value);
}

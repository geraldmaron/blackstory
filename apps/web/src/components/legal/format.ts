/**
 * Presentation-only string helpers for legal landscape components.
 */
import { LAW_STATUSES, type LawStatus } from '@repo/domain/entity-status';
import { LEGAL_KIND_LABELS, LEGAL_TOPIC_LABELS } from './copy';

const LAW_STATUS_LABELS: Readonly<Record<LawStatus, string>> = {
  in_force: 'In force',
  amended: 'Amended',
  repealed: 'Repealed',
  struck_down: 'Struck down',
  enjoined: 'Enjoined',
};

export function humanizeLegalKind(kind: string): string {
  return LEGAL_KIND_LABELS[kind] ?? kind;
}

export function humanizeLegalTopic(topic: string): string {
  return LEGAL_TOPIC_LABELS[topic] ?? topic;
}

export function legalStatusDisplay(status: LawStatus): string {
  return LAW_STATUS_LABELS[status];
}

export function isLawStatus(value: string): value is LawStatus {
  return (LAW_STATUSES as readonly string[]).includes(value);
}

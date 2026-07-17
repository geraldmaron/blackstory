/**
 * Law status badge vocabulary for BB-087 — imports BB-090 `LAW_STATUSES` as the single shared
 * definition rather than redefining status strings locally.
 */
import { LAW_STATUSES, type LawStatus } from '../entity-status.js';

export { LAW_STATUSES, type LawStatus };

export const LAW_STATUS_LABELS: Readonly<Record<LawStatus, string>> = {
  in_force: 'In force',
  amended: 'Amended',
  repealed: 'Repealed',
  struck_down: 'Struck down',
  enjoined: 'Enjoined',
};

export const LAW_STATUS_DESCRIPTIONS: Readonly<Record<LawStatus, string>> = {
  in_force: 'This law or holding is currently in effect as written.',
  amended: 'The original provision remains, but Congress or a court has changed part of it.',
  repealed: 'This provision has been formally removed from the code or overturned by statute.',
  struck_down: 'A court ruled this provision unconstitutional; it is not enforceable.',
  enjoined: 'A court order currently blocks enforcement while litigation continues.',
};

export function isLawStatus(value: string): value is LawStatus {
  return (LAW_STATUSES as readonly string[]).includes(value);
}

export function lawStatusLabel(status: LawStatus): string {
  return LAW_STATUS_LABELS[status];
}

export function lawStatusDescription(status: LawStatus): string {
  return LAW_STATUS_DESCRIPTIONS[status];
}

/** UI tone hint — maps to Notice/ badge variants without importing UI packages. */
export type LawStatusTone = 'neutral' | 'info' | 'warning' | 'error';

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

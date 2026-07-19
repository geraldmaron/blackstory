/**
 * Font Awesome icons for entity lifecycle status values. Shape + label always
 * travel together so status is never color-only (WCAG 1.4.1).
 */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBan,
  faBuilding,
  faCircle,
  faCirclePause,
  faClockRotateLeft,
  faGavel,
  faScaleBalanced,
  faUser,
  faUserSlash,
} from '@fortawesome/free-solid-svg-icons';

const STATUS_ICONS: Readonly<Record<string, IconDefinition>> = {
  active: faBuilding,
  historic: faClockRotateLeft,
  inactive: faCirclePause,
  living: faUser,
  deceased: faUserSlash,
  in_force: faScaleBalanced,
  amended: faGavel,
  repealed: faBan,
  struck_down: faBan,
  enjoined: faGavel,
  // movement reuses place-like active/historic
};

export function statusIconFor(status: string): IconDefinition {
  return STATUS_ICONS[status] ?? faCircle;
}

export function statusShortLabel(status: string): string {
  return status.replace(/_/g, ' ');
}

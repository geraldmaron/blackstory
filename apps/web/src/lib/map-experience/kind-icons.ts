/**
 * Font Awesome solid icons for Explore kind badges. Map markers keep geometric
 * glyphs; badge UI uses recognizable icons paired with labels so color is never
 * the only signal (WCAG 1.4.1).
 */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faBookOpen,
  faBoxArchive,
  faCalendarDay,
  faCircle,
  faFlag,
  faGavel,
  faHouse,
  faLandmark,
  faLocationDot,
  faPeopleGroup,
  faSchool,
  faScroll,
  faStar,
  faTriangleExclamation,
  faUser,
} from '@fortawesome/free-solid-svg-icons';
import { isKnownMapKind, type MapKind, type MapSemanticTone } from './kind-encoding';

const KIND_ICONS: Readonly<Record<MapKind, IconDefinition>> = {
  person: faUser,
  place: faLocationDot,
  school: faSchool,
  organization: faPeopleGroup,
  institution: faLandmark,
  event: faCalendarDay,
  law: faScroll,
  case: faGavel,
  publication: faBookOpen,
  artifact: faBoxArchive,
  movement: faFlag,
  other: faCircle,
};

const SEMANTIC_TONE_ICONS: Readonly<Record<MapSemanticTone, IconDefinition>> = {
  massacre: faTriangleExclamation,
  plantation: faHouse,
  epicenter: faStar,
};

function semanticToneIcon(tone: string): IconDefinition | undefined {
  if (tone === 'massacre' || tone === 'plantation' || tone === 'epicenter') {
    return SEMANTIC_TONE_ICONS[tone];
  }
  return undefined;
}

/** Resolve the badge icon: semantic tone wins over kind when `mapTone` is set. */
export function kindIconFor(kind: string, mapTone?: string): IconDefinition {
  const toneIcon = mapTone ? semanticToneIcon(mapTone) : undefined;
  if (toneIcon) return toneIcon;
  if (isKnownMapKind(kind)) return KIND_ICONS[kind];
  return faCircle;
}

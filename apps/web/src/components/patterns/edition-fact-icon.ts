/**
 * Icon resolver for home edition entry steps and record fact labels. Reuses map
 * kind glyphs and confidence tiers so home beats do not invent a second icon language.
 */
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faCalendarDay,
  faClock,
  faGlobe,
  faLocationDot,
  faMap,
  faPhone,
  faScroll,
} from '@fortawesome/free-solid-svg-icons';
import {
  confidenceIconFor,
  type ConfidenceTierKey,
} from '../../lib/map-experience/confidence-icons';
import { displayEncodingFor } from '../../lib/map-experience/kind-encoding';
import { kindIconFor } from '../../lib/map-experience/kind-icons';

export type EntryStepKey = 'pin' | 'browse' | 'source';

export type VisitFactIconKey = 'address' | 'phone' | 'website' | 'hours';

const ENTRY_STEP_ICONS: Readonly<Record<EntryStepKey, IconDefinition>> = {
  pin: faLocationDot,
  browse: faMap,
  source: faScroll,
};

const VISIT_FACT_ICONS: Readonly<Record<VisitFactIconKey, IconDefinition>> = {
  address: faLocationDot,
  phone: faPhone,
  website: faGlobe,
  hours: faClock,
};

export function entryStepIconFor(step: EntryStepKey): IconDefinition {
  return ENTRY_STEP_ICONS[step];
}

export function recordKindIconFor(
  kind: string,
  mapTone?: string,
): {
  readonly icon: IconDefinition;
  readonly shade: string;
} {
  return {
    icon: kindIconFor(kind, mapTone),
    shade: displayEncodingFor(kind, mapTone).shade,
  };
}

export function recordWhereIcon(): IconDefinition {
  return faLocationDot;
}

export function recordEraIcon(): IconDefinition {
  return faCalendarDay;
}

export function recordEvidenceIconFor(tier: ConfidenceTierKey): IconDefinition {
  return confidenceIconFor(tier);
}

/** Standard visit-block icons (address / phone / website / hours). */
export function visitFactIconFor(key: VisitFactIconKey): IconDefinition {
  return VISIT_FACT_ICONS[key];
}

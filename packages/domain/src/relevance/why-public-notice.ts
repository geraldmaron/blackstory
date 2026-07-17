/**
 * trauma-content notice derivation. Decides WHEN a trauma-content
 * notice is warranted on a "why this appears" surface, driven by the entity's classified story
 * dimensions (./why-public-dimensions.js). This module owns none of the disclaimer prose itself 
 * it composes the existing `sensitive_content` registry entry (../disclaimers.js), the
 * single authored source of that copy across the whole app.
 */
import { getDisclaimer, type DisclaimerRecord } from '../disclaimers.js';
import { type StoryDimension } from './why-public-dimensions.js';

/** Dimensions whose presence warrants a trauma-content notice. Only `harm` triggers today see
 * ./entity-status.js's `SENSITIVITY_CLASSES` for the related, but distinct, entity-level flag
 * this module does not duplicate (that flag is about the ENTITY's conduct history; this is about
 * whether THIS explanation's classified content touches documented harm). */
const TRAUMA_TRIGGER_DIMENSIONS: readonly StoryDimension[] = ['harm'];

export type TraumaContentNoticeDecision = {
  readonly warranted: boolean;
  readonly disclaimer?: DisclaimerRecord;
};

export function deriveTraumaContentNotice(
  dimensions: readonly StoryDimension[],
): TraumaContentNoticeDecision {
  const warranted = TRAUMA_TRIGGER_DIMENSIONS.some((trigger) => dimensions.includes(trigger));
  return warranted ? { warranted, disclaimer: getDisclaimer('sensitive_content') } : { warranted };
}

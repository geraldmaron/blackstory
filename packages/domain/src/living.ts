/**
 * Living-status helpers backed by the product constitution (@black-book/schemas).
 * Unknown living status is treated as living at the model level.
 */
import { evaluateLivingStatus, loadProductConstitution } from '@black-book/schemas';

/** Living-status vocabulary from the active product constitution. */
export function livingStatuses(): readonly string[] {
  return loadProductConstitution().livingPersonRules.statuses;
}

export type LivingStatus = string;

/** Unknown living status is treated as living (constitution livingPersonRules). */
export function treatAsLiving(status: LivingStatus): boolean {
  return evaluateLivingStatus(status).treatAsLiving;
}

/** Default living status when writers omit one unknown, therefore treated as living. */
export const DEFAULT_LIVING_STATUS: LivingStatus = 'unknown';

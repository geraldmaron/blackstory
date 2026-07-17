/**
 * Constitution-aligned source classifications for provenance (BB-016 / BB-003).
 */
import { loadProductConstitution } from '@black-book/schemas';

export function sourceClassifications(): readonly string[] {
  return loadProductConstitution().sourceClassifications;
}

export function isSourceClassification(value: string): boolean {
  return sourceClassifications().includes(value);
}

export function assertSourceClassification(value: string): void {
  if (!isSourceClassification(value)) {
    throw new Error(`Unknown source classification: ${value}`);
  }
}

/**
 * Keyed-hash pepper for submission network tokens (see submit/api and corrections/api).
 * Production must set SUBMISSION_PRIVACY_PEPPER — never falls back to a fixed literal, since a
 * shared hardcoded pepper baked into shipped code would defeat the point of keying the hash the
 * moment the env var is accidentally unset. Non-production gets a random pepper generated once
 * per process instead, so there is no known constant to rely on even by accident.
 */
import { randomBytes } from 'node:crypto';

let devPepper: string | undefined;

export function requirePrivacyPepper(): string {
  const pepper = process.env.SUBMISSION_PRIVACY_PEPPER;
  if (pepper && pepper.trim()) return pepper;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('SUBMISSION_PRIVACY_PEPPER must be set in production');
  }
  if (!devPepper) devPepper = randomBytes(32).toString('hex');
  return devPepper;
}

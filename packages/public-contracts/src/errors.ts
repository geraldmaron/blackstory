/**
 * Shared public API error envelope + error-code enum (ADR-021 §2).
 *
 * `CLIENT_VERSION_UNSUPPORTED` is the version-floor error code: both server (`apps/api-public`,
 * MOB-004) and client (`apps/mobile`, MOB-009) must agree on this code and its HTTP status at
 * compile time, which is exactly why it lives in the shared contracts package rather than being
 * hand-copied on each side (ADR-021 §2, "the error code and its HTTP status are part of the
 * contract package so both sides agree on them at compile time").
 *
 * Per ADR-021's red-team resolution #2: `X-BlackStory-Client` / `CLIENT_VERSION_UNSUPPORTED` is a
 * UX / forced-update affordance for honest clients, not a security control — a tampered client
 * that spoofs its version gains no capability, because every request parameter is independently
 * re-validated server-side and there is no client write path to reach. Nothing in this module
 * should be read as an authorization boundary.
 */
import { z } from 'zod';
import { idString, nonEmptyText } from './internal/primitives.js';

export const PUBLIC_API_ERROR_CODES = [
  /** The requested resource does not exist in the active release. */
  'NOT_FOUND',
  /** The request failed validation against a `v1/*` request schema. */
  'INVALID_REQUEST',
  /** The caller has exceeded a rate limit; retry later. */
  'RATE_LIMITED',
  /**
   * The calling client's declared API/app version is below the server's enforced floor
   * (ADR-021 §2). Always paired with HTTP `426 Upgrade Required`. The client should show a
   * forced-update prompt (deep-link to the store listing), not a generic error banner.
   */
  'CLIENT_VERSION_UNSUPPORTED',
  /** A public read dependency (e.g. release artifact storage) is temporarily unavailable; the
   * client should fall back to its offline cache / immutable-snapshot read per ADR-004. */
  'UPSTREAM_UNAVAILABLE',
  /** An unexpected server-side failure. Never carries a stack trace or internal detail. */
  'INTERNAL',
] as const;

export type PublicApiErrorCode = (typeof PUBLIC_API_ERROR_CODES)[number];

/** The fixed HTTP status `CLIENT_VERSION_UNSUPPORTED` is always paired with (ADR-021 §2). */
export const CLIENT_VERSION_UNSUPPORTED_HTTP_STATUS = 426 as const;

export const publicApiErrorSchema = z
  .object({
    code: z.enum(PUBLIC_API_ERROR_CODES),
    message: nonEmptyText(2000),
    requestId: idString(200).optional(),
    /**
     * Structured, non-sensitive detail (e.g. which field failed validation). Never a stack trace,
     * never an internal path, never a secret — server-side serialization is responsible for that
     * guarantee; this schema only bounds shape and size.
     */
    details: z.record(z.string().max(200), z.union([z.string().max(2000), z.number(), z.boolean(), z.null()])).optional(),
  });

export type PublicApiError = z.infer<typeof publicApiErrorSchema>;

export const publicApiErrorEnvelopeSchema = z
  .object({
    error: publicApiErrorSchema,
  });

export type PublicApiErrorEnvelope = z.infer<typeof publicApiErrorEnvelopeSchema>;

/** True when an error envelope is the version-floor signal, for client dispatch convenience. */
export function isClientVersionUnsupported(envelope: PublicApiErrorEnvelope): boolean {
  return envelope.error.code === 'CLIENT_VERSION_UNSUPPORTED';
}

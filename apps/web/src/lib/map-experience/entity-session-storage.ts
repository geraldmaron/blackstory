/**
 * Shared sessionStorage helpers for entity session navigation (explore spotlight +
 * entity detail). Keeps Back stack and Random toggle continuous across those surfaces
 * within a browser tab — not browser history.
 */
import { createSessionStack, type SessionStack } from './entity-session-nav';

export const ENTITY_SESSION_STACK_STORAGE_KEY = 'blackstory.entity-session.stack';
export const ENTITY_SESSION_RANDOM_STORAGE_KEY = 'blackstory.entity-session.random';

function canUseSessionStorage(): boolean {
  return typeof sessionStorage !== 'undefined';
}

/** Reads the persisted Back stack; empty stack when missing or malformed. */
export function readEntitySessionStack(): SessionStack {
  if (!canUseSessionStorage()) {
    return createSessionStack();
  }
  try {
    const raw = sessionStorage.getItem(ENTITY_SESSION_STACK_STORAGE_KEY);
    if (!raw) {
      return createSessionStack();
    }
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'string')) {
      return createSessionStack();
    }
    return parsed;
  } catch {
    return createSessionStack();
  }
}

/** Persists the Back stack for the current tab session. */
export function writeEntitySessionStack(stack: SessionStack): void {
  if (!canUseSessionStorage()) {
    return;
  }
  sessionStorage.setItem(ENTITY_SESSION_STACK_STORAGE_KEY, JSON.stringify(stack));
}

/** Reads whether Random order is enabled (default off). */
export function readEntitySessionRandomEnabled(): boolean {
  if (!canUseSessionStorage()) {
    return false;
  }
  return sessionStorage.getItem(ENTITY_SESSION_RANDOM_STORAGE_KEY) === '1';
}

/** Persists the Random toggle for the current tab session. */
export function writeEntitySessionRandomEnabled(enabled: boolean): void {
  if (!canUseSessionStorage()) {
    return;
  }
  sessionStorage.setItem(ENTITY_SESSION_RANDOM_STORAGE_KEY, enabled ? '1' : '0');
}

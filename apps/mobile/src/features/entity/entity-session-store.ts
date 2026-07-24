/**
 * In-memory entity session store for Previous stack + Random toggle.
 * Mirrors web sessionStorage continuity within a single app process (no SecureStore;
 * this is UI preference, not a secret).
 */

import {
  createSessionStack,
  type SessionStack,
} from './entity-session-nav';

let sessionStack: SessionStack = createSessionStack();
let randomEnabled = false;

export function readEntitySessionStack(): SessionStack {
  return sessionStack;
}

export function writeEntitySessionStack(stack: SessionStack): void {
  sessionStack = stack;
}

export function readEntitySessionRandomEnabled(): boolean {
  return randomEnabled;
}

export function writeEntitySessionRandomEnabled(enabled: boolean): void {
  randomEnabled = enabled;
}

/** Test seam — resets process-local session state. */
export function resetEntitySessionStoreForTests(): void {
  sessionStack = createSessionStack();
  randomEnabled = false;
}

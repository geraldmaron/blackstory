/**
 * Pin continuity across map → record handoff.
 * Stores the last focused pin and camera hint in sessionStorage so a return trip can restore
 * the same view. Keyboard and pointer paths share one writer.
 */

const STORAGE_KEY = 'bs.pin-continuity.v1';

export type PinContinuityState = {
  readonly entityId: string;
  readonly lng: number;
  readonly lat: number;
  readonly zoom?: number;
  readonly label?: string;
  readonly savedAt: number;
};

function canUseStorage(): boolean {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';
}

export function savePinContinuity(state: Omit<PinContinuityState, 'savedAt'>): void {
  if (!canUseStorage()) return;
  try {
    const payload: PinContinuityState = { ...state, savedAt: Date.now() };
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Private mode / quota: continuity is best-effort.
  }
}

export function readPinContinuity(): PinContinuityState | null {
  if (!canUseStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PinContinuityState;
    if (
      typeof parsed.entityId !== 'string' ||
      typeof parsed.lng !== 'number' ||
      typeof parsed.lat !== 'number'
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPinContinuity(): void {
  if (!canUseStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/**
 * The home → map hand-off. The Door saves the pin (or the overlapping pins) a reader chose in
 * sessionStorage, enters browse, and Explore restores it through the one selection contract.
 */

const STORAGE_KEY = 'bs.pin-continuity.v1';

export type PinContinuityState = {
  readonly entityId: string;
  readonly lng: number;
  readonly lat: number;
  readonly label?: string;
  /** Overlapping pins under one click: Explore opens the chooser, never the first record. */
  readonly overlap?: readonly {
    readonly pinId: string;
    readonly lng: number;
    readonly lat: number;
  }[];
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

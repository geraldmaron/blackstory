
/**
 * Deterministic identifier factories for tests.
 * Prefer these over random UUIDs so fixtures and assertions stay stable.
 */

export type IdFactory = {
  readonly next: () => string;
  readonly peek: () => string;
  readonly reset: (startAt?: number) => void;
};


/**
 * Builds sequential IDs like `ent_0001`, `clm_0002`.
 * Padding defaults to 4 digits; overflow expands width rather than colliding.
 */
export function createIdFactory(prefix: string, startAt = 1, pad = 4): IdFactory {
  if (!prefix.trim()) {
    throw new RangeError('createIdFactory requires a non-empty prefix');
  }
  if (!Number.isInteger(startAt) || startAt < 0) {
    throw new RangeError('createIdFactory startAt must be a non-negative integer');
  }
  if (!Number.isInteger(pad) || pad < 1) {
    throw new RangeError('createIdFactory pad must be a positive integer');
  }

  let counter = startAt;

  const format = (value: number): string => {
    const body = String(value);
    return `${prefix}_${body.padStart(Math.max(pad, body.length), '0')}`;
  };

  return {
    next: () => {
      const id = format(counter);
      counter += 1;
      return id;
    },
    peek: () => format(counter),
    reset: (nextStart = startAt) => {
      if (!Number.isInteger(nextStart) || nextStart < 0) {
        throw new RangeError('createIdFactory reset requires a non-negative integer');
      }
      counter = nextStart;
    },
  };
}

/** Shared default factories for BlackStory domain fixtures. */
export const defaultIdFactories = {
  entity: () => createIdFactory('ent'),
  claim: () => createIdFactory('clm'),
  evidence: () => createIdFactory('evd'),
  source: () => createIdFactory('src'),
  release: () => createIdFactory('rel'),
  submission: () => createIdFactory('sub'),
  snapshot: () => createIdFactory('snp'),
} as const;

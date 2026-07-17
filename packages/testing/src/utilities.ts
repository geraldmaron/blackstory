
/**
 * Provides deterministic clocks, sequences, and output capture for unit tests.
 */
export interface CapturedLines {
  readonly lines: readonly string[];
  readonly write: (line: string) => void;
}

export function captureLines(): CapturedLines {
  const lines: string[] = [];
  return {
    lines,
    write: (line) => lines.push(line),
  };
}

export function fixedClock(instant: string | Date): () => Date {
  const timestamp = new Date(instant);
  if (Number.isNaN(timestamp.valueOf())) {
    throw new RangeError('fixedClock requires a valid date');
  }
  return () => new Date(timestamp);
}


/**
 * Advances by a fixed step on each call, starting at `instant`.
 * Useful when fixtures need distinct but reproducible timestamps.
 */
export function steppingClock(instant: string | Date, stepMs = 1000): () => Date {
  if (!Number.isFinite(stepMs) || stepMs < 0) {
    throw new RangeError('steppingClock requires a non-negative stepMs');
  }
  const start = new Date(instant);
  if (Number.isNaN(start.valueOf())) {
    throw new RangeError('steppingClock requires a valid date');
  }
  let tick = 0;
  return () => {
    const value = new Date(start.getTime() + tick * stepMs);
    tick += 1;
    return value;
  };
}

export function createSequence<T>(values: readonly T[]): () => T {
  let index = 0;
  return () => {
    if (index >= values.length) {
      throw new RangeError('Test sequence exhausted');
    }
    const value = values[index] as T;
    index += 1;
    return value;
  };
}

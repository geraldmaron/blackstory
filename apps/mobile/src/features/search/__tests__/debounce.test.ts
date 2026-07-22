import { createDebouncer, type DebounceTimers } from '../debounce';

/** Deterministic fake timers (same discipline as apps/mobile/src/data/transport.test.ts's
 * injected sleep/random) so "rapid typing" is a controlled, synchronous test, not a real-clock
 * flaky one. */
function fakeTimers(): DebounceTimers & { advance(ms: number): void; pendingCount(): number } {
  let now = 0;
  let nextId = 1;
  const pending = new Map<number, { fireAt: number; fn: () => void }>();

  return {
    setTimeout(fn, ms) {
      const id = nextId++;
      pending.set(id, { fireAt: now + ms, fn });
      return id;
    },
    clearTimeout(handle) {
      pending.delete(handle as number);
    },
    advance(ms) {
      now += ms;
      for (const [id, entry] of [...pending.entries()]) {
        if (entry.fireAt <= now) {
          pending.delete(id);
          entry.fn();
        }
      }
    },
    pendingCount: () => pending.size,
  };
}

describe('createDebouncer — rapid typing collapses to one call', () => {
  it('fires exactly once for a burst of rapid schedule() calls, with the LAST value', () => {
    const timers = fakeTimers();
    const fired: string[] = [];
    const debouncer = createDebouncer<string>((v) => fired.push(v), 300, timers);

    // Simulate keystrokes 50ms apart -- each one well within the 300ms window, so every prior
    // pending timer is cancelled and replaced.
    debouncer.schedule('h');
    timers.advance(50);
    debouncer.schedule('he');
    timers.advance(50);
    debouncer.schedule('hel');
    timers.advance(50);
    debouncer.schedule('hell');
    timers.advance(50);
    debouncer.schedule('hello');

    expect(fired).toEqual([]); // nothing has fired yet -- still inside the debounce window

    timers.advance(300); // now the last scheduled timer elapses
    expect(fired).toEqual(['hello']);
  });

  it('fires once per genuinely separated burst (quiet period between them)', () => {
    const timers = fakeTimers();
    const fired: string[] = [];
    const debouncer = createDebouncer<string>((v) => fired.push(v), 300, timers);

    debouncer.schedule('a');
    timers.advance(300);
    expect(fired).toEqual(['a']);

    debouncer.schedule('b');
    timers.advance(300);
    expect(fired).toEqual(['a', 'b']);
  });

  it('cancel() prevents a pending call from ever firing', () => {
    const timers = fakeTimers();
    const fired: string[] = [];
    const debouncer = createDebouncer<string>((v) => fired.push(v), 300, timers);

    debouncer.schedule('typed-but-abandoned');
    debouncer.cancel();
    timers.advance(1000);

    expect(fired).toEqual([]);
    expect(timers.pendingCount()).toBe(0);
  });

  it('never leaks more than one pending timer at a time under a rapid burst', () => {
    const timers = fakeTimers();
    const debouncer = createDebouncer<number>(() => {}, 300, timers);

    for (let i = 0; i < 50; i++) {
      debouncer.schedule(i);
      timers.advance(10); // well under the 300ms window every time
    }

    expect(timers.pendingCount()).toBe(1);
  });
});

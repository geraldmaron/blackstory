/**
 * Unit tests for the Wave 9 release-build performance marks (`perf-marks.ts`). Jest cannot
 * exercise a real device clock or a real OS log — those are the harness's job
 * (`scripts/release/mobile-perf-baseline.mjs`) — so this only proves the module's own contract:
 * one structured line per mark, at most once per process, never throwing.
 */
import { MARK_PREFIX, __resetPerfMarksForTests, markPerf } from './perf-marks';

describe('markPerf', () => {
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    __resetPerfMarksForTests();
    logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('emits one structured line carrying the mark name and a millisecond number', () => {
    markPerf('first_useful_content');

    expect(logSpy).toHaveBeenCalledTimes(1);
    const [line] = logSpy.mock.calls[0] as [string];
    expect(line.startsWith(`${MARK_PREFIX} `)).toBe(true);

    const payload = JSON.parse(line.slice(MARK_PREFIX.length + 1)) as {
      mark: string;
      ms: number;
    };
    expect(payload.mark).toBe('first_useful_content');
    expect(typeof payload.ms).toBe('number');
    expect(Number.isFinite(payload.ms)).toBe(true);
  });

  it('fires a given mark at most once per process', () => {
    markPerf('story_loaded');
    markPerf('story_loaded');
    markPerf('story_loaded');

    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('tracks each mark name independently', () => {
    markPerf('first_map_render');
    markPerf('search_results_shown');
    markPerf('entity_detail_loaded');

    expect(logSpy).toHaveBeenCalledTimes(3);
    const marks = logSpy.mock.calls.map(
      ([line]: [string]) =>
        (JSON.parse(line.slice(MARK_PREFIX.length + 1)) as { mark: string }).mark,
    );
    expect(marks).toEqual(['first_map_render', 'search_results_shown', 'entity_detail_loaded']);
  });

  it('never throws even if console.log itself throws', () => {
    logSpy.mockImplementation(() => {
      throw new Error('sink unavailable');
    });

    expect(() => markPerf('first_useful_content')).not.toThrow();
  });

  it('resets between tests via the test-only seam, so state does not leak across suites', () => {
    markPerf('story_loaded');
    __resetPerfMarksForTests();
    markPerf('story_loaded');

    expect(logSpy).toHaveBeenCalledTimes(2);
  });
});

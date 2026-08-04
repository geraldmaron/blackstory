/**
 * The keyboard layer's contract: no chord is claimed twice, every registry command is reachable,
 * text input always wins, and ESC unwinds in the documented order.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  allChords,
  duplicateChords,
  ESCAPE_ORDER,
  GLOBAL_BINDINGS,
  handleKeyStroke,
  INSTRUMENT_SCOPE_SELECTOR,
  isEscape,
  isSingleKeyEnabled,
  isWithinInstrumentScope,
  matchesPaletteOpen,
  resetSingleKeyCache,
  resolveBinding,
  resolveEscape,
  setSingleKeyEnabled,
  SINGLE_KEY_STORAGE_KEY,
  subscribeToSingleKey,
} from './bindings';
import {
  COMMANDS,
  type CommandContext,
} from '../../components/patterns/command-palette/command-registry';

function recordingContext(): { context: CommandContext; calls: string[] } {
  const calls: string[] = [];
  const note =
    (name: string) =>
    (...args: unknown[]) => {
      calls.push(args.length > 0 ? `${name}:${String(args[0])}` : name);
    };
  const context: CommandContext = {
    focusSearch: note('focusSearch'),
    nearMe: note('nearMe'),
    resetLens: note('resetLens'),
    undoLastAction: note('undoLastAction'),
    camera: {
      wide: note('camera.wide'),
      push: note('camera.push'),
      orbit: note('camera.orbit'),
      tilt: note('camera.tilt'),
      spotlight: note('camera.spotlight'),
      trace: note('camera.trace'),
    },
    stepRecord: note('stepRecord') as CommandContext['stepRecord'],
    saveRecord: note('saveRecord'),
    copyCitation: note('copyCitation'),
    copyShareLink: note('copyShareLink'),
    closeSheet: note('closeSheet'),
    setMode: note('setMode') as CommandContext['setMode'],
    openLibrary: note('openLibrary'),
    togglePlayback: note('togglePlayback'),
    toggleTheme: note('toggleTheme'),
    toggleMotion: note('toggleMotion'),
    toggleDensity: note('toggleDensity'),
    toggleChrome: note('toggleChrome'),
  };
  return { context, calls };
}

test('no chord is claimed by two bindings', () => {
  assert.deepEqual(duplicateChords(), []);
});

test('the sheet knows every command plus the globals', () => {
  assert.equal(allChords().length, COMMANDS.length + GLOBAL_BINDINGS.length);
});

/**
 * Targets the scope check has to tell apart. Only `closest` and `tagName` are read, which is the
 * whole reason the check is shape-based — these stand in for real nodes without a DOM.
 */
const onBody = { tagName: 'BODY' } as never;
const insideInstrument = {
  tagName: 'BUTTON',
  closest: (selector: string) => (selector === INSTRUMENT_SCOPE_SELECTOR ? {} : null),
} as never;
const insideReadingRoom = { tagName: 'BUTTON', closest: () => null } as never;

test('a bare letter runs its camera move', () => {
  const { context, calls } = recordingContext();
  assert.equal(handleKeyStroke({ key: 'w' }, context, { target: onBody }), true);
  assert.equal(handleKeyStroke({ key: 'O' }, context, { target: insideInstrument }), true);
  assert.deepEqual(calls, ['camera.wide:[object Object]', 'camera.orbit:[object Object]']);
});

test('a keystroke aimed at a text field is never consumed', () => {
  const { context, calls } = recordingContext();
  const input = { tagName: 'INPUT', isContentEditable: false };
  assert.equal(handleKeyStroke({ key: 'w' }, context, { target: input as never }), false);

  const editor = { tagName: 'DIV', isContentEditable: true };
  assert.equal(handleKeyStroke({ key: 'w' }, context, { target: editor as never }), false);

  assert.deepEqual(calls, []);
});

test('a bare key does not fire outside the Instrument scope', () => {
  const { context, calls } = recordingContext();
  // The criterion SP-13 could not assert on its own: focus on a Reading room or Utility surface,
  // no modifier, nothing happens. The dangerous case is the corrections form, where `S` would
  // otherwise mean "save record" while the reader is reaching for the sentence they are writing.
  assert.equal(handleKeyStroke({ key: 'w' }, context, { target: insideReadingRoom }), false);
  // Fail closed: a stroke that reports no target is not evidence of being on the Instrument.
  assert.equal(handleKeyStroke({ key: 'w' }, context), false);
  assert.deepEqual(calls, []);
});

test('a chorded binding ignores both the scope and the setting', () => {
  const { context, calls } = recordingContext();
  // ⌘L is `records.share`. A modifier cannot be produced by accident, so neither gate applies —
  // and a reader who has turned single keys off has not asked to lose the share link.
  assert.equal(
    handleKeyStroke({ key: 'l', metaKey: true }, context, {
      target: insideReadingRoom,
      singleKeyEnabled: false,
    }),
    true,
  );
  assert.deepEqual(calls, ['copyShareLink']);
});

test('the single-key setting suppresses bare keys and nothing else', () => {
  const { context, calls } = recordingContext();
  const off = { target: insideInstrument, singleKeyEnabled: false } as const;
  assert.equal(handleKeyStroke({ key: 'w' }, context, off), false);
  assert.equal(handleKeyStroke({ key: 'd', altKey: true }, context, off), true);
  assert.deepEqual(calls, ['toggleDensity']);
});

test('scope: body counts, the Instrument counts, a room outside it does not', () => {
  assert.equal(isWithinInstrumentScope(onBody), true);
  assert.equal(isWithinInstrumentScope(insideInstrument), true);
  assert.equal(isWithinInstrumentScope(insideReadingRoom), false);
  assert.equal(isWithinInstrumentScope(null), false);
});

test('the setting round-trips through storage and notifies subscribers', () => {
  const store = new Map<string, string>();
  const priorWindow = (globalThis as { window?: unknown }).window;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => void store.set(key, value),
    },
  };
  try {
    resetSingleKeyCache();
    assert.equal(isSingleKeyEnabled(), true, 'unset storage means on');

    let notified = 0;
    const unsubscribe = subscribeToSingleKey(() => {
      notified += 1;
    });
    setSingleKeyEnabled(false);
    assert.equal(notified, 1);
    assert.equal(store.get(SINGLE_KEY_STORAGE_KEY), 'off');

    setSingleKeyEnabled(false);
    assert.equal(notified, 1, 'an unchanged setting must not re-render the sheet');

    resetSingleKeyCache();
    assert.equal(isSingleKeyEnabled(), false, 'the stored choice survives a reload');
    unsubscribe();
  } finally {
    resetSingleKeyCache();
    (globalThis as { window?: unknown }).window = priorWindow;
  }
});

test('a modifier chord does not fire its bare-key twin', () => {
  // `D` toggles theme, `⌥D` toggles density. One must never run the other.
  const theme = resolveBinding({ key: 'd' });
  const density = resolveBinding({ key: 'd', altKey: true });
  assert.equal(theme?.id, 'view.theme');
  assert.equal(density?.id, 'view.density');
});

test('a bare key does not fire when Command is held', () => {
  assert.equal(resolveBinding({ key: 'w', metaKey: true }), null);
});

test('Control stands in for Command, so the layer works off a Mac', () => {
  assert.equal(resolveBinding({ key: 'l', ctrlKey: true })?.id, 'records.share');
  assert.equal(resolveBinding({ key: 'l', metaKey: true })?.id, 'records.share');
});

test('SPACE toggles playback', () => {
  assert.equal(resolveBinding({ key: ' ' })?.id, 'view.play-decades');
});

test('the palette opener owns its chords, so nothing fires twice', () => {
  assert.equal(matchesPaletteOpen({ key: 'k', metaKey: true }), true);
  assert.equal(matchesPaletteOpen({ key: '/' }), true);
  assert.equal(matchesPaletteOpen({ key: 'w' }), false);
  assert.equal(resolveBinding({ key: '/' }), null, '`/` belongs to the palette hook alone');
  assert.equal(resolveBinding({ key: 'k', metaKey: true }), null);
});

test('ESC is never dispatched as a plain command', () => {
  assert.equal(isEscape({ key: 'Escape' }), true);
  assert.equal(resolveBinding({ key: 'Escape' }), null);
});

test('ESC unwinds innermost first', () => {
  assert.equal(resolveEscape({ palette: true, sheet: true }), 'palette');
  assert.equal(resolveEscape({ overlay: true, spotlight: true, sheet: true }), 'overlay');
  assert.equal(resolveEscape({ spotlight: true, sheet: true }), 'spotlight');
  assert.equal(resolveEscape({ sheet: true }), 'sheet');
  assert.equal(resolveEscape({}), null);
});

test('the documented unwind order is the one the resolver uses', () => {
  assert.deepEqual([...ESCAPE_ORDER], ['palette', 'overlay', 'spotlight', 'sheet']);
});

test('every registry command outside the palette-owned chords is reachable by key', () => {
  const unreachable = COMMANDS.filter((command) => {
    if (command.keys.includes('ESC')) return false;
    if (command.id === 'find.search') return false;
    return resolveBinding(strokeFor(command.keys))?.id !== command.id;
  });
  assert.deepEqual(
    unreachable.map((command) => command.id),
    [],
  );
});

/** Turns a printed chord back into the keystroke a reader would produce. */
function strokeFor(keys: readonly string[]) {
  const literal = keys.filter((cap) => cap !== '⌘' && cap !== '⌥');
  const cap = literal[0] ?? '';
  const key = cap === 'SPACE' ? ' ' : cap === '⌫' ? 'Backspace' : cap;
  return {
    key,
    ...(keys.includes('⌘') ? { metaKey: true } : {}),
    ...(keys.includes('⌥') ? { altKey: true } : {}),
  };
}

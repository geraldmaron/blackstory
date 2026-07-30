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
  isEscape,
  matchesPaletteOpen,
  resolveBinding,
  resolveEscape,
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

test('a bare letter runs its camera move', () => {
  const { context, calls } = recordingContext();
  assert.equal(handleKeyStroke({ key: 'w' }, context), true);
  assert.equal(handleKeyStroke({ key: 'O' }, context), true);
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

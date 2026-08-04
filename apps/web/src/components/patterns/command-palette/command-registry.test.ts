/**
 * Registry contract. These are the assertions that keep the palette, the shortcut sheet and the
 * camera console describing the same product: a command the sheet advertises but nothing runs, or
 * a camera move reachable from the console but not the keyboard, is exactly the drift this list
 * exists to prevent.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  COMMANDS,
  COMMAND_SECTIONS,
  KEYED_CAMERA_MOVES,
  chordKey,
  commandsBySection,
  type CommandContext,
} from './command-registry';

/** A context that records what a command asked for instead of doing it. */
function recordingContext(): { calls: string[]; context: CommandContext } {
  const calls: string[] = [];
  const note =
    (name: string) =>
    (...args: readonly unknown[]) => {
      calls.push(args.length > 0 ? `${name}(${args.join(',')})` : name);
    };

  return {
    calls,
    context: {
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
      stepRecord: note('stepRecord'),
      saveRecord: note('saveRecord'),
      copyCitation: note('copyCitation'),
      copyShareLink: note('copyShareLink'),
      closeSheet: note('closeSheet'),
      setMode: note('setMode'),
      openLibrary: note('openLibrary'),
      togglePlayback: note('togglePlayback'),
      toggleTheme: note('toggleTheme'),
      toggleDensity: note('toggleDensity'),
      toggleMotion: note('toggleMotion'),
      toggleChrome: note('toggleChrome'),
    } as unknown as CommandContext,
  };
}

test('every command id is unique', () => {
  const ids = COMMANDS.map((command) => command.id);

  assert.equal(new Set(ids).size, ids.length, `duplicate id in ${ids.join(', ')}`);
});

test('every command has a non-empty title and at least one key', () => {
  for (const command of COMMANDS) {
    assert.ok(command.title.trim().length > 0, `${command.id} has no title`);
    assert.ok(command.keys.length > 0, `${command.id} has no key chord`);
    assert.ok(
      command.keys.every((key) => key.length > 0),
      `${command.id} has an empty key cap`,
    );
  }
});

test('no two commands claim the same key chord', () => {
  const seen = new Map<string, string>();

  for (const command of COMMANDS) {
    const chord = chordKey(command.keys);
    const owner = seen.get(chord);
    assert.equal(owner, undefined, `${chord} claimed by both ${owner} and ${command.id}`);
    seen.set(chord, command.id);
  }
});

test('titles are sentence case, so the two surfaces read alike', () => {
  for (const command of COMMANDS) {
    const rest = command.title.slice(1);
    assert.notEqual(rest, rest.toUpperCase(), `${command.id} is shouting`);
    assert.equal(command.title, command.title.trim());
  }
});

test('every keyed camera move has a command, and no command invents one', () => {
  const cameraCommands = COMMANDS.filter((command) => command.section === 'Camera');
  const { calls, context } = recordingContext();

  for (const command of cameraCommands) command.run(context);

  const invoked = calls.map((call) => call.replace(/^camera\./, '').replace(/\(.*\)$/, ''));

  assert.deepEqual(
    [...invoked].sort(),
    [...KEYED_CAMERA_MOVES].sort(),
    'the Camera column and the camera vocabulary have drifted apart',
  );
});

test('camera commands are marked reader-triggered, so reduced motion cannot suppress them', () => {
  // A reader who presses W asked for that move. `essential: true` is set downstream from the
  // trigger, and an ambient trigger here would make the key silently do nothing for some readers.
  const cameraCommands = COMMANDS.filter((command) => command.section === 'Camera');
  const triggers: unknown[] = [];
  const capture = (options?: unknown) => {
    triggers.push(options);
  };

  const { context } = recordingContext();
  const spy = {
    ...context,
    camera: {
      wide: capture,
      push: capture,
      orbit: capture,
      tilt: capture,
      spotlight: capture,
      trace: capture,
    },
  } as unknown as CommandContext;

  for (const command of cameraCommands) command.run(spy);

  assert.equal(triggers.length, cameraCommands.length);
  for (const options of triggers) {
    assert.deepEqual(options, { trigger: 'reader' });
  }
});

test('every command dispatches to exactly one context handler', () => {
  for (const command of COMMANDS) {
    const { calls, context } = recordingContext();
    command.run(context);

    assert.equal(calls.length, 1, `${command.id} called ${calls.length} handlers`);
  }
});

test('J and K step in opposite directions', () => {
  const step = (id: string) => {
    const { calls, context } = recordingContext();
    COMMANDS.find((command) => command.id === id)?.run(context);
    return calls[0];
  };

  assert.equal(step('records.next'), 'stepRecord(1)');
  assert.equal(step('records.previous'), 'stepRecord(-1)');
});

test('the shortcut sheet has four columns and none of them is empty', () => {
  const grouped = commandsBySection();

  assert.equal(grouped.length, COMMAND_SECTIONS.length);
  for (const [section, commands] of grouped) {
    assert.ok(commands.length > 0, `${section} column is empty`);
  }
  assert.equal(
    grouped.reduce((total, [, commands]) => total + commands.length, 0),
    COMMANDS.length,
    'a command belongs to no sheet column',
  );
});

test('the palette shortcut itself is not in the registry', () => {
  // Cmd-K opens the palette, so it cannot also be a row inside it. The palette owns that binding.
  const chords = COMMANDS.map((command) => chordKey(command.keys));

  assert.ok(!chords.includes('⌘+K'));
});

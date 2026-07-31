/**
 * The keyboard layer, as data.
 *
 * One list, two consumers: the command palette renders it as the Actions section, and the
 * shortcut sheet renders it grouped by `section` into its four columns. That is the whole point of
 * this module — a shortcut that exists in the sheet but not the palette, or a camera move the
 * console can reach but the palette cannot, is a drift bug, and here it is a compile error or a
 * failing test instead.
 *
 * `run` takes its handlers from an injected context rather than closing over app state, so the
 * registry stays pure and the contract tests can drive every command against a recording double.
 * The context's members are required, not optional: a surface that mounts the palette without
 * wiring `copyCitation` should fail to typecheck, not silently give the reader a dead menu row.
 *
 * See docs/ui/design-direction-v9-atlas.md §7 and docs/ui/patterns-atlas-instrument.md.
 */

import type { CameraApi } from '../../../lib/map-experience/camera-moves';

/** The shortcut sheet's four columns, in the order it renders them. */
export const COMMAND_SECTIONS = ['Find', 'Camera', 'Records', 'View'] as const;
export type CommandSection = (typeof COMMAND_SECTIONS)[number];

/**
 * A single key chord, one array entry per key cap: `['⌘', 'K']` renders as two caps.
 * `ESC` and `SPACE` are spelled out because a one-glyph cap for them reads as a typo.
 */
export type KeyChord = readonly string[];

export type CommandContext = {
  /* Find */
  readonly focusSearch: () => void;
  readonly nearMe: () => void;
  readonly resetLens: () => void;

  /* Camera. Typed against the real API so a rename in WP-05 breaks this list. */
  readonly camera: Pick<CameraApi, 'wide' | 'push' | 'orbit' | 'tilt' | 'spotlight' | 'trace'>;

  /* Records */
  readonly stepRecord: (direction: 1 | -1) => void;
  readonly saveRecord: () => void;
  readonly copyCitation: () => void;
  readonly copyShareLink: () => void;
  readonly closeSheet: () => void;

  /* View */
  readonly setMode: (mode: 'atlas' | 'story') => void;
  /** Leaves the instrument for the library hub. A navigation, not a mode change. */
  readonly openLibrary: () => void;
  readonly togglePlayback: () => void;
  readonly toggleTheme: () => void;
  readonly toggleDensity: () => void;
  readonly toggleMotion: () => void;
  readonly toggleChrome: () => void;
};

export type Command = {
  readonly id: string;
  /** Sentence case, verb first. This is what the reader reads in both surfaces. */
  readonly title: string;
  readonly section: CommandSection;
  readonly keys: KeyChord;
  readonly run: (context: CommandContext) => void;
};

/**
 * Every camera move a reader can invoke by key. `flyToRecord` is deliberately absent: it needs a
 * record, so it is reached by selecting one, not by pressing a key with nothing in hand.
 */
export const KEYED_CAMERA_MOVES = ['wide', 'push', 'orbit', 'tilt', 'spotlight', 'trace'] as const;

export const COMMANDS: readonly Command[] = [
  /* ---- Find ---- */
  {
    id: 'find.search',
    title: 'Search records',
    section: 'Find',
    keys: ['/'],
    run: (context) => context.focusSearch(),
  },
  {
    id: 'find.near-me',
    title: 'Records near me',
    section: 'Find',
    keys: ['N'],
    run: (context) => context.nearMe(),
  },
  {
    id: 'find.reset-lens',
    title: 'Reset the lens',
    section: 'Find',
    keys: ['⌘', '⌫'],
    run: (context) => context.resetLens(),
  },

  /* ---- Camera ---- */
  {
    id: 'camera.wide',
    title: 'Wide, all of it',
    section: 'Camera',
    keys: ['W'],
    run: (context) => context.camera.wide({ trigger: 'reader' }),
  },
  {
    id: 'camera.push',
    title: 'Push in',
    section: 'Camera',
    keys: ['P'],
    run: (context) => context.camera.push({ trigger: 'reader' }),
  },
  {
    id: 'camera.orbit',
    title: 'Slow orbit',
    section: 'Camera',
    keys: ['O'],
    run: (context) => context.camera.orbit({ trigger: 'reader' }),
  },
  {
    id: 'camera.tilt',
    title: 'Tilt the plate',
    section: 'Camera',
    keys: ['T'],
    run: (context) => context.camera.tilt({ trigger: 'reader' }),
  },
  {
    id: 'camera.spotlight',
    title: 'Spotlight focus',
    section: 'Camera',
    keys: ['F'],
    run: (context) => context.camera.spotlight({ trigger: 'reader' }),
  },
  {
    id: 'camera.trace',
    title: 'Trace migration',
    section: 'Camera',
    keys: ['R'],
    run: (context) => context.camera.trace({ trigger: 'reader' }),
  },

  /* ---- Records ---- */
  {
    id: 'records.next',
    title: 'Next record',
    section: 'Records',
    keys: ['J'],
    run: (context) => context.stepRecord(1),
  },
  {
    id: 'records.previous',
    title: 'Previous record',
    section: 'Records',
    keys: ['K'],
    run: (context) => context.stepRecord(-1),
  },
  {
    id: 'records.save',
    title: 'Save this record',
    section: 'Records',
    keys: ['S'],
    run: (context) => context.saveRecord(),
  },
  {
    id: 'records.cite',
    title: 'Copy citation',
    section: 'Records',
    keys: ['C'],
    run: (context) => context.copyCitation(),
  },
  {
    id: 'records.share',
    title: 'Copy share link',
    section: 'Records',
    keys: ['⌘', 'L'],
    run: (context) => context.copyShareLink(),
  },
  {
    id: 'records.close',
    title: 'Close the sheet',
    section: 'Records',
    keys: ['ESC'],
    run: (context) => context.closeSheet(),
  },

  /* ---- View ---- */
  {
    id: 'view.atlas',
    title: 'Atlas mode',
    section: 'View',
    keys: ['1'],
    run: (context) => context.setMode('atlas'),
  },
  {
    id: 'view.story',
    title: 'Story mode',
    section: 'View',
    keys: ['2'],
    run: (context) => context.setMode('story'),
  },
  {
    id: 'view.library',
    title: 'Open the library',
    // `L` alone, which does not collide with `⌘L` (copy share link): `chordKey` compares the
    // full chord, and the duplicate check in `bindings.test.ts` proves it.
    section: 'View',
    keys: ['L'],
    run: (context) => context.openLibrary(),
  },
  {
    id: 'view.play-decades',
    title: 'Play the decades',
    section: 'View',
    keys: ['SPACE'],
    run: (context) => context.togglePlayback(),
  },
  {
    id: 'view.theme',
    title: 'Light or dark',
    section: 'View',
    keys: ['D'],
    run: (context) => context.toggleTheme(),
  },
  {
    id: 'view.density',
    title: 'Compact density',
    section: 'View',
    keys: ['⌥', 'D'],
    run: (context) => context.toggleDensity(),
  },
  {
    id: 'view.motion',
    title: 'Calm motion',
    section: 'View',
    keys: ['M'],
    run: (context) => context.toggleMotion(),
  },
  {
    id: 'view.hide-chrome',
    title: 'Hide all chrome',
    section: 'View',
    keys: ['\\'],
    run: (context) => context.toggleChrome(),
  },
];

/** A chord as a single comparable string, e.g. `⌘+K`. Used to prove no two commands collide. */
export function chordKey(keys: KeyChord): string {
  return keys.join('+');
}

/** The registry grouped for the shortcut sheet. Column order follows `COMMAND_SECTIONS`. */
export function commandsBySection(): readonly (readonly [CommandSection, readonly Command[]])[] {
  return COMMAND_SECTIONS.map(
    (section) => [section, COMMANDS.filter((command) => command.section === section)] as const,
  );
}

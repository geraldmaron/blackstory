/**
 * The keyboard layer: one resolver, one escape order, no second list of shortcuts.
 *
 * `command-registry.ts` already holds every command with its chord, because the palette renders
 * them. This module does **not** restate them — it derives the physical bindings from that list
 * and adds only the chords that are not commands: opening the palette, opening this sheet, and
 * ESC. A shortcut spelled out in two places is the defect this package exists to prevent, so the
 * contract test asserts the two sets stay in step.
 *
 * Design law: docs/ui/design-direction-v9-atlas.md §7.
 */

import {
  COMMANDS,
  chordKey,
  type Command,
  type CommandContext,
  type KeyChord,
} from '../../components/patterns/command-palette/command-registry';

/** Overlays ESC can close, innermost first. The order is the unwind order. */
export const ESCAPE_ORDER = ['palette', 'overlay', 'spotlight', 'sheet'] as const;
export type EscapeLayer = (typeof ESCAPE_ORDER)[number];

/**
 * Chords the surface owns rather than the registry. They are listed here so the shortcut sheet can
 * render them beside the commands, and so the duplicate check sees them.
 */
export type GlobalBinding = {
  readonly id: string;
  readonly title: string;
  readonly keys: KeyChord;
  readonly section: 'Find' | 'View';
};

export const GLOBAL_BINDINGS: readonly GlobalBinding[] = [
  { id: 'global.palette', title: 'Command palette', keys: ['⌘', 'K'], section: 'Find' },
  { id: 'global.shortcuts', title: 'Keyboard shortcuts', keys: ['?'], section: 'View' },
];

/**
 * Chords the palette's own opener handles (`useCommandPaletteShortcut`).
 *
 * `⌘K` and `/` both open the palette, and `find.search` in the registry means the same thing. Both
 * mechanisms exist for a reason — the palette must be openable before any other binding is
 * reachable — so the global handler yields these two chords rather than firing alongside it and
 * opening the palette twice. `matchesPaletteOpen` below is the single definition both read.
 */
const PALETTE_OPEN_CHORDS: readonly KeyChord[] = [['⌘', 'K'], ['/']];

/** Does this keystroke open the palette? The palette hook and the sheet both read this. */
export function matchesPaletteOpen(stroke: KeyStroke): boolean {
  return PALETTE_OPEN_CHORDS.some((chord) => chordMatches(chord, stroke));
}

/**
 * The attribute that marks the Instrument's keyboard scope. The Atlas root carries it; nothing
 * else does.
 *
 * Single-key bindings are a property of the surface, not of the document. `W` means "fly wide"
 * only where there is a camera to fly, and on a Reading room or a Utility surface the same key is
 * either meaningless or actively wrong — a reader half-way through the corrections form should
 * never have a stray keystroke reframe a map behind them.
 */
export const KEY_SCOPE_ATTRIBUTE = 'data-key-scope';
export const INSTRUMENT_SCOPE_SELECTOR = `[${KEY_SCOPE_ATTRIBUTE}="instrument"]`;

/** Nothing is focused: the reader has not tabbed anywhere yet, so the surface still owns the key. */
const UNFOCUSED_TAGS = ['BODY', 'HTML'];

/**
 * Is this keystroke inside the Instrument's scope?
 *
 * Shape-checked like `isTypingTarget`, and for the same reason: `instanceof HTMLElement` fails
 * across realms and cannot be exercised outside a browser. `closest` is the question being asked,
 * so its presence is what gets checked.
 */
export function isWithinInstrumentScope(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  const element = target as { tagName?: unknown; closest?: unknown };
  // A fresh page has focus on <body>. Requiring a focused descendant would mean no shortcut works
  // until the reader tabs into something, which is not a keyboard surface at all.
  if (typeof element.tagName === 'string' && UNFOCUSED_TAGS.includes(element.tagName)) return true;
  if (typeof element.closest !== 'function') return false;
  return (element.closest as (selector: string) => unknown)(INSTRUMENT_SCOPE_SELECTOR) !== null;
}

const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT'];

/**
 * True when a keystroke belongs to whatever the reader is typing into, not to the page.
 *
 * Shape-checked rather than `instanceof HTMLElement`: the realm check fails for an element from an
 * iframe, and it makes the guard untestable outside a browser. What matters is whether the target
 * behaves like a text entry, and `tagName` plus `isContentEditable` is exactly that question.
 */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (target === null || typeof target !== 'object') return false;
  const element = target as { tagName?: unknown; isContentEditable?: unknown };
  if (element.isContentEditable === true) return true;
  return typeof element.tagName === 'string' && TYPING_TAGS.includes(element.tagName);
}

/**
 * The reader's single-key setting, persisted beside `ds-theme`.
 *
 * Single-key shortcuts are hostile to some readers by construction: a switch user, a head-pointer
 * user, or anyone whose hardware repeats keys will trigger camera moves they never asked for. The
 * setting turns the bare keys off without taking the chorded ones away, so the surface stays fully
 * operable from the keyboard either way. It is stated in the sheet `?` opens, because a setting a
 * reader cannot find is not a setting.
 *
 * Stored rather than derived: unlike theme there is no media query that reports this preference,
 * so the only source is the reader saying so once.
 */
export const SINGLE_KEY_STORAGE_KEY = 'ds-single-key';

type Listener = () => void;
const singleKeyListeners = new Set<Listener>();
/** `null` until first read, so a server render never touches storage. */
let singleKeyEnabled: boolean | null = null;

function readSingleKeySetting(): boolean {
  try {
    // Default on. The bare keys are the Atlas's advertised interface, and a surface that opens
    // with its own shortcut sheet inert would read as broken rather than as considerate.
    return window.localStorage.getItem(SINGLE_KEY_STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function isSingleKeyEnabled(): boolean {
  if (singleKeyEnabled === null) singleKeyEnabled = readSingleKeySetting();
  return singleKeyEnabled;
}

/** Server snapshot for `useSyncExternalStore`: the default, with no storage read. */
export function getServerSingleKeyEnabled(): boolean {
  return true;
}

export function setSingleKeyEnabled(next: boolean): void {
  if (singleKeyEnabled === next) return;
  singleKeyEnabled = next;
  try {
    window.localStorage.setItem(SINGLE_KEY_STORAGE_KEY, next ? 'on' : 'off');
  } catch {
    // A reader in private mode still gets the setting for this session; it just will not persist.
  }
  for (const listener of singleKeyListeners) listener();
}

export function subscribeToSingleKey(listener: Listener): () => void {
  singleKeyListeners.add(listener);
  return () => {
    singleKeyListeners.delete(listener);
  };
}

/** Test seam: forget the cached read so a case can start from a known storage state. */
export function resetSingleKeyCache(): void {
  singleKeyEnabled = null;
}

/** Does this chord need a modifier? Chorded bindings survive the single-key setting being off. */
export function isSingleKeyChord(keys: KeyChord): boolean {
  return !keys.includes('⌘') && !keys.includes('⌥');
}

/** The subset of a `KeyboardEvent` this module reads. Keeps the resolver testable in plain Node. */
export type KeyStroke = {
  readonly key: string;
  readonly metaKey?: boolean;
  readonly ctrlKey?: boolean;
  readonly altKey?: boolean;
  readonly shiftKey?: boolean;
};

/**
 * A chord as the reader's keyboard reports it. `⌘` matches either Command or Control so the same
 * binding works on both platforms, which is what the caps in the sheet mean in practice.
 */
function chordMatches(keys: KeyChord, stroke: KeyStroke): boolean {
  const wantsCommand = keys.includes('⌘');
  const wantsAlt = keys.includes('⌥');
  const literal = keys.filter((cap) => cap !== '⌘' && cap !== '⌥');
  if (literal.length !== 1) return false;

  const hasCommand = Boolean(stroke.metaKey || stroke.ctrlKey);
  if (wantsCommand !== hasCommand) return false;
  if (wantsAlt !== Boolean(stroke.altKey)) return false;

  return keyCapMatches(literal[0]!, stroke.key);
}

/** Maps a printed key cap to the `KeyboardEvent.key` values that should trigger it. */
function keyCapMatches(cap: string, key: string): boolean {
  switch (cap) {
    case 'SPACE':
      return key === ' ' || key === 'Spacebar';
    case 'ESC':
      return key === 'Escape' || key === 'Esc';
    case '⌫':
      return key === 'Backspace';
    case '↵':
      return key === 'Enter';
    default:
      return cap.toLowerCase() === key.toLowerCase();
  }
}

/**
 * Which command a keystroke runs, or null.
 *
 * ESC is excluded here on purpose. The registry lists it as "Close the sheet" so the reader can
 * see it in the sheet and the palette, but at runtime ESC has to unwind layers in order
 * (`resolveEscape`), and dispatching it as a plain command would close the sheet while the palette
 * was still open on top of it.
 */
export function resolveBinding(stroke: KeyStroke): Command | null {
  if (isEscape(stroke)) return null;
  // Yielded to the palette's own opener so `/` cannot open the palette twice. See above.
  if (matchesPaletteOpen(stroke)) return null;
  for (const command of COMMANDS) {
    if (command.keys.includes('ESC')) continue;
    if (chordMatches(command.keys, stroke)) return command;
  }
  return null;
}

export function isEscape(stroke: KeyStroke): boolean {
  return stroke.key === 'Escape' || stroke.key === 'Esc';
}

/** Which layer ESC should close, given what is currently open. Null when nothing is open. */
export function resolveEscape(open: Partial<Record<EscapeLayer, boolean>>): EscapeLayer | null {
  for (const layer of ESCAPE_ORDER) {
    if (open[layer]) return layer;
  }
  return null;
}

/**
 * Runs the command a keystroke maps to.
 *
 * Returns true when the keystroke was consumed, so the caller knows whether to `preventDefault`.
 *
 * Three gates, in order of how cheaply they can be reasoned about:
 *
 * 1. A keystroke aimed at a text field is never consumed — the reader typing "w" into search must
 *    not fly the camera wide.
 * 2. A bare key is consumed only inside the Instrument's scope. Off the Atlas there is no camera,
 *    no timeline and no selected record for these commands to act on.
 * 3. A bare key is consumed only while the reader's single-key setting is on.
 *
 * Gates 2 and 3 apply to single-key chords alone. `⌘L` copies a share link wherever it is pressed
 * and whatever the setting says, because a modifier cannot be produced by accident.
 */
export function handleKeyStroke(
  stroke: KeyStroke,
  context: CommandContext,
  options: {
    readonly target?: EventTarget | null;
    /** Overrides the persisted setting. The scope check reads the target, so it needs no option. */
    readonly singleKeyEnabled?: boolean;
  } = {},
): boolean {
  const target = options.target ?? null;
  if (isTypingTarget(target)) return false;
  const command = resolveBinding(stroke);
  if (!command) return false;

  if (isSingleKeyChord(command.keys)) {
    if (!isWithinInstrumentScope(target)) return false;
    if (!(options.singleKeyEnabled ?? isSingleKeyEnabled())) return false;
  }

  command.run(context);
  return true;
}

/** Every chord the layer knows, registry plus globals. Used by the duplicate check and the sheet. */
export function allChords(): readonly { readonly id: string; readonly keys: KeyChord }[] {
  return [
    ...GLOBAL_BINDINGS.map((binding) => ({ id: binding.id, keys: binding.keys })),
    ...COMMANDS.map((command) => ({ id: command.id, keys: command.keys })),
  ];
}

/** Chords claimed by more than one id. Empty is the only acceptable result. */
export function duplicateChords(): readonly string[] {
  const seen = new Map<string, string[]>();
  for (const entry of allChords()) {
    const key = chordKey(entry.keys);
    seen.set(key, [...(seen.get(key) ?? []), entry.id]);
  }
  return [...seen.entries()].filter(([, ids]) => ids.length > 1).map(([key]) => key);
}

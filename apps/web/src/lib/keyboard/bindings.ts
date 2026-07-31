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
 * A keystroke aimed at a text field is never consumed: the reader typing "w" into search must not
 * fly the camera wide.
 */
export function handleKeyStroke(
  stroke: KeyStroke,
  context: CommandContext,
  options: { readonly target?: EventTarget | null } = {},
): boolean {
  if (isTypingTarget(options.target ?? null)) return false;
  const command = resolveBinding(stroke);
  if (!command) return false;
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

/**
 * Runs axe-core over markup a component actually produced, inside a jsdom document.
 *
 * WHY THIS EXISTS
 * ---------------
 * The other modules in this directory (`html-smoke.ts`, `audit.ts`) match regular expressions
 * against hand-written HTML strings. That has two failure modes it cannot escape. It has no
 * accessibility tree, so it cannot compute an accessible name, resolve an `aria-labelledby`
 * chain, or tell a valid ARIA role from a typo; and the strings are maintained by hand, so a
 * component can regress while the fixture that stands in for it stays green.
 *
 * This module fixes the second problem outright and most of the first: callers render the real
 * component with `renderToStaticMarkup`, hand the result here, and axe-core evaluates it against
 * a real DOM with a real accessibility tree.
 *
 * WHAT THIS CHECKS
 * ----------------
 * Every axe-core rule tagged wcag2a / wcag2aa / wcag21a / wcag21aa / best-practice that can be
 * decided from markup alone, minus the exclusions listed below. In practice that is: accessible
 * names (`button-name`, `link-name`, `input-image-alt`, `image-alt`, `label`, `frame-title`),
 * ARIA correctness (`aria-roles`, `aria-valid-attr`, `aria-valid-attr-value`,
 * `aria-required-attr`, `aria-required-children`, `aria-required-parent`, `aria-allowed-attr`,
 * `aria-allowed-role`, `aria-hidden-focus`, `aria-hidden-body`), document and landmark structure
 * (`landmark-one-main`, `landmark-unique`, `region`, `page-has-heading-one`, `heading-order`,
 * `list`, `listitem`, `definition-list`, `dlitem`), table semantics, duplicate `id` collisions on
 * ARIA and label references, `tabindex` misuse, and `html-has-lang` / `document-title` when a
 * whole document is passed.
 *
 * WHAT THIS CANNOT CHECK — read this before trusting a green run
 * --------------------------------------------------------------
 * 1. COLOR CONTRAST. jsdom has no layout and no compositing, so axe cannot resolve the effective
 *    background behind a text node. Verified: given `color:#eeeeee` on `background:#ffffff` —
 *    a ratio of about 1.2:1, far below the 4.5:1 floor — axe under jsdom returns `color-contrast`
 *    as `incomplete`, never as a violation. The rule is therefore disabled here rather than left
 *    to report a permanent "cannot tell", so that a green run never reads as "contrast passed".
 *    Token-pair contrast is covered separately and for real by
 *    `packages/ui/src/tokens/contrast.test.ts`, which computes WCAG ratios from the palette. What
 *    nothing in this repo currently covers is contrast of the *composed, painted page* — that
 *    needs a real browser.
 * 2. ANYTHING THAT NEEDS LAYOUT. Target size, reflow at 320 CSS pixels, overlap, sticky elements
 *    covering content, text truncation, scroll containers. jsdom reports every box as zero-sized.
 * 3. FOCUS ORDER AS EXPERIENCED. This checks DOM order and `tabindex` values. It cannot observe
 *    what a real browser does with focus after a route change, a dialog opening, or CSS `order` /
 *    flexbox reordering, because none of that runs.
 * 4. ANYTHING INTERACTIVE. The markup is a single static snapshot. Menus that open, dialogs that
 *    trap focus, live regions that announce, expanded/collapsed state changes, and keyboard
 *    handlers are all invisible to this lane. A component is audited in exactly the one state its
 *    props produced.
 * 5. MOTION AND MEDIA. `prefers-reduced-motion` behavior, autoplay, captions, audio.
 * 6. SCREEN-READER REALITY. axe approximates the accessibility tree; it is not NVDA, JAWS, or
 *    VoiceOver, and it does not model their heuristics or bugs.
 * 7. THE ASSEMBLED PAGE, unless a caller passes assembled-page markup. Auditing components one at
 *    a time cannot see a duplicate landmark, a second `h1`, or an `id` collision that only exists
 *    once two components sit on the same page.
 *
 * A green run from this lane means "no machine-detectable violation in this markup". It does not
 * mean the product is accessible. Machine checks are generally reckoned to reach a minority of
 * WCAG failures; the rest need a person and a real browser.
 */

import axe from 'axe-core';
import { JSDOM, VirtualConsole } from 'jsdom';

/** One axe-core violation, flattened to what a failing assertion needs to print. */
export type AxeViolation = {
  readonly id: string;
  readonly impact: string;
  readonly help: string;
  readonly helpUrl: string;
  /** The offending elements, as CSS selectors into the audited markup. */
  readonly targets: readonly string[];
};

export type AxeAuditResult = {
  readonly violations: readonly AxeViolation[];
  readonly passed: boolean;
  /**
   * Rules axe could not decide in jsdom. Never treated as failures: under jsdom this is
   * dominated by rules that need layout, and `color-contrast` is disabled outright, so an
   * entry here means "unknown", not "suspicious".
   */
  readonly undecided: readonly string[];
};

/**
 * How much of a document the caller's markup already is. The harness supplies the rest, and the
 * choice decides which page-level rules can be judged honestly.
 *
 * - `fragment` (default) — one component's output. Wrapped in `<html><body><main>`, because a
 *   component cannot supply a landmark of its own and would otherwise fail `region` and
 *   `landmark-one-main` for the harness's reasons rather than its own. `page-has-heading-one` is
 *   switched off in this mode: a single component has no business owning the page's only h1.
 * - `page-body` — the body content of a page, landmarks and headings included. Wrapped in
 *   `<html><body>` only, so every landmark and heading rule judges the caller's markup.
 * - `document` — a complete document, doctype and `<head>` and all. Nothing is added, so
 *   `html-has-lang` and `document-title` judge the real thing.
 */
export type AxeAuditMode = 'fragment' | 'page-body' | 'document';

export type AxeAuditOptions = {
  readonly mode?: AxeAuditMode;
  /** Rule ids to switch off for this audit, beyond the permanent exclusions. */
  readonly disabledRules?: readonly string[];
};

/**
 * Rules that are off for every audit in this lane, each with the reason it cannot be honored.
 *
 * Nothing else is excluded. A rule that is merely inconvenient stays on and its findings get
 * reported, so that the exclusion list stays short enough to audit by eye.
 */
export const PERMANENTLY_DISABLED_RULES: ReadonlyMap<string, string> = new Map([
  [
    'color-contrast',
    'jsdom has no layout or compositing, so axe cannot resolve the painted background; verified to return "incomplete" even for a 1.2:1 pair. See packages/ui/src/tokens/contrast.test.ts for the token-level check that is real.',
  ],
  [
    'color-contrast-enhanced',
    'Same limitation as color-contrast, at the AAA threshold.',
  ],
]);

const AUDITED_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice'] as const;

/**
 * A document body wrapper with the document-level requirements already satisfied, so a fragment
 * audit reports the fragment's own problems and not the harness's.
 *
 * The `<main>` matters: without it every component fragment trips `region` ("all page content
 * should be contained by landmarks") and `landmark-one-main`, which are page-level facts a
 * component has no way to satisfy on its own. Wrapping makes those two rules meaningful again for
 * the fragment's *own* content — a fragment that emits a second `main`, or a nested landmark that
 * leaves content orphaned, still fails.
 */
function wrap(markup: string, mode: AxeAuditMode): string {
  if (mode === 'document') {
    return markup;
  }
  const body = mode === 'fragment' ? `<main>${markup}</main>` : markup;
  return [
    '<!doctype html>',
    '<html lang="en">',
    '<head><meta charset="utf-8"><title>Accessibility audit fixture</title></head>',
    `<body>${body}</body>`,
    '</html>',
  ].join('');
}

/**
 * Rules a component fragment cannot satisfy, and which the harness therefore suppresses in
 * fragment mode only. They stay on for whole-document audits, which is where they belong.
 */
const FRAGMENT_MODE_DISABLED_RULES: readonly string[] = [
  // A single component is not a page and has no business emitting the page's only h1. Composed
  // page markup audited with `wrapInDocument: false` is still held to this.
  'page-has-heading-one',
];

/**
 * Builds a jsdom window with axe-core loaded into it.
 *
 * `document.elementFromPoint` is polyfilled because jsdom does not implement it and axe's
 * `isModalOpen` helper calls it. Without the stub, `landmark-one-main` and `page-has-heading-one`
 * throw inside axe and are silently downgraded to "incomplete" — the lane would then quietly stop
 * checking two of the things the regex lane did check. Returning `null` is the honest answer for
 * a document with no layout: nothing is at any point, so no modal is open, which is true of every
 * static snapshot this lane audits.
 */
function buildWindow(html: string): JSDOM['window'] {
  const dom = new JSDOM(html, {
    pretendToBeVisual: true,
    runScripts: 'outside-only',
    virtualConsole: new VirtualConsole(),
  });
  const { window } = dom;
  if (typeof window.document.elementFromPoint !== 'function') {
    window.document.elementFromPoint = () => null;
  }
  window.eval(axe.source);
  return window;
}

/**
 * Runs axe-core over rendered markup and returns its violations.
 *
 * Pass output from `renderToStaticMarkup` (or any real render), never a hand-written string —
 * a hand-written string reintroduces exactly the drift this module exists to remove.
 */
export async function auditRenderedMarkup(
  markup: string,
  options: AxeAuditOptions = {},
): Promise<AxeAuditResult> {
  const mode = options.mode ?? 'fragment';
  const window = buildWindow(wrap(markup, mode));

  const ruleOverrides: Record<string, { enabled: boolean }> = {};
  for (const ruleId of PERMANENTLY_DISABLED_RULES.keys()) {
    ruleOverrides[ruleId] = { enabled: false };
  }
  if (mode === 'fragment') {
    for (const ruleId of FRAGMENT_MODE_DISABLED_RULES) {
      ruleOverrides[ruleId] = { enabled: false };
    }
  }
  for (const ruleId of options.disabledRules ?? []) {
    ruleOverrides[ruleId] = { enabled: false };
  }

  try {
    const results = await window.axe.run(window.document, {
      runOnly: { type: 'tag', values: [...AUDITED_TAGS] },
      rules: ruleOverrides,
      resultTypes: ['violations'],
    });

    const violations = results.violations.map((violation) =>
      Object.freeze({
        id: violation.id,
        impact: violation.impact ?? 'unknown',
        help: violation.help,
        helpUrl: violation.helpUrl,
        targets: Object.freeze(violation.nodes.map((node) => node.target.join(' '))),
      }),
    );

    return Object.freeze({
      violations: Object.freeze(violations),
      passed: violations.length === 0,
      undecided: Object.freeze(results.incomplete.map((entry) => entry.id)),
    });
  } finally {
    window.close();
  }
}

/** Renders a violation list as the body of an assertion message. */
export function describeViolations(violations: readonly AxeViolation[]): string {
  return violations
    .map(
      (violation) =>
        `  [${violation.impact}] ${violation.id}: ${violation.help}\n` +
        violation.targets.map((target) => `      at ${target}`).join('\n'),
    )
    .join('\n');
}

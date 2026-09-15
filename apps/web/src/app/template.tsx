/**
 * App Router remount boundary for the shell page wrapper.
 *
 * Next.js re-instantiates this template on client navigations, so a per-page wrapper can
 * remount without touching persistent chrome (header/footer in layout.tsx). There is no enter
 * animation left to run: opacity fades blanked loading UI before slow RSC/compile finished
 * (story to entity navigations looked broken), and the transform-based one made this wrapper
 * the containing block for the fixed map plate (`ShellPageTransition.tsx` states that in full).
 *
 * Nothing here crossfades the shared MapLibre canvas, and not because a rule suppresses it:
 * `MapStageProvider` wraps `.ds-shell`, so `.ds-map-stage` is a sibling of the shell and sits
 * outside this template's subtree entirely (`docs/decisions-carryover.md`, "Persistent map
 * canvas": the root shell owns the canvas). `/` and `/explore` both emit `data-surface="door"`;
 * browse is a Door posture, not a separate instrument surface class.
 */
import type { ReactNode } from 'react';
import { ShellPageTransition } from '../components/ShellPageTransition';

export type ShellPageTemplateProps = {
  readonly children: ReactNode;
};

export default function ShellPageTemplate({ children }: ShellPageTemplateProps) {
  return <ShellPageTransition>{children}</ShellPageTransition>;
}

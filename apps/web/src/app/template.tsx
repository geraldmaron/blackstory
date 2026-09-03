/**
 * App Router remount boundary for shell page enter transitions.
 *
 * Next.js re-instantiates this template on client navigations so a short enter
 * animation can run without touching persistent chrome (header/footer in layout.tsx).
 * The Explore instrument (`/explore`) emits `data-surface="instrument"`; shell.css disables
 * the transition there so the shared MapLibre canvas is never crossfaded (ADR-017).
 * `/` is the reading Door, not the instrument. Opacity fades (exit or enter) were removed:
 * they blanked loading UI before slow RSC/compile finished (story ↔ entity navigations
 * looked broken).
 */
import type { ReactNode } from 'react';
import { ShellPageTransition } from '../components/ShellPageTransition';

export type ShellPageTemplateProps = {
  readonly children: ReactNode;
};

export default function ShellPageTemplate({ children }: ShellPageTemplateProps) {
  return <ShellPageTransition>{children}</ShellPageTransition>;
}

/**
 * App Router remount boundary for shell page enter transitions.
 *
 * Next.js re-instantiates this template on client navigations so an opacity enter
 * animation can run without touching persistent chrome (header/footer in layout.tsx).
 * Map surfaces under `(map)/` render `data-surface="map"`; shell.css disables the
 * transition there so the shared MapLibre canvas is never crossfaded (ADR-017).
 * Exit-on-click fades were removed: they blanked the page before slow RSC/compile
 * finished (story ↔ entity navigations looked broken).
 */
import type { ReactNode } from 'react';
import { ShellPageTransition } from '../components/ShellPageTransition';

export type ShellPageTemplateProps = {
  readonly children: ReactNode;
};

export default function ShellPageTemplate({ children }: ShellPageTemplateProps) {
  return <ShellPageTransition>{children}</ShellPageTransition>;
}

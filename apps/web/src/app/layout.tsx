/**
 * Root layout for the public Blap web application.
 * Loads display + editorial + sans + mono fonts, design-system stylesheet, and app shell.
 *
 * Type system per the blap brand kit (brand/tokens/fonts.json, binding): Sora SemiBold for
 * headlines/titles/key statements, Inter for UI and body, Source Serif 4 for editorial
 * longform, IBM Plex Mono for data/citations. Sora replaced the earlier Inter-Display
 * display register when the kit landed (2026-07-18) — the wordmark art is unaffected
 * (the lockup ships as provided, never retyped).
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Sora, Inter, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import '@blap/ui/styles.css';
import { SiteShell } from '../components/SiteShell';
import './shell.css';

const displayFace = Sora({
  subsets: ['latin'],
  variable: '--bp-font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--bp-font-sans',
  display: 'swap',
});

const editorial = Source_Serif_4({
  subsets: ['latin'],
  variable: '--bp-font-editorial',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--bp-font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048'),
  title: {
    default: 'Blap',
    template: '%s — Blap',
  },
  description:
    'Place-connected Black history research with published claims, provenance, and confidence.',
  icons: {
    // Properly-sized renders from the new brand/ kit — see brand.md's source
    // map for how each was generated from the master symbol/lockup art.
    icon: [
      { url: '/brand/favicon-light-16.png', sizes: '16x16', type: 'image/png' },
      { url: '/brand/favicon-light-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-light-48.png', sizes: '48x48', type: 'image/png' },
      {
        url: '/brand/favicon-dark-16.png',
        sizes: '16x16',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/brand/favicon-dark-32.png',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/brand/favicon-dark-48.png',
        sizes: '48x48',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [
      { url: '/brand/apple-touch-icon-light-180.png', sizes: '180x180' },
      {
        url: '/brand/apple-touch-icon-dark-180.png',
        sizes: '180x180',
        media: '(prefers-color-scheme: dark)',
      },
    ],
  },
  openGraph: {
    siteName: 'Blap',
    title: 'Blap',
    description:
      'Place-connected Black history research with published claims, provenance, and confidence.',
    images: [
      {
        url: '/brand/blap-open-graph-dark-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'Blap — History, pinned to place.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blap',
    description:
      'Place-connected Black history research with published claims, provenance, and confidence.',
    images: ['/brand/blap-open-graph-dark-1200x630.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${displayFace.variable} ${sans.variable} ${editorial.variable} ${mono.variable}`}
    >
      <body>
        <a className="bp-skip-link" href="#main">
          Skip to main content
        </a>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}

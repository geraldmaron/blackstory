/**
 * Root layout for the public BlackStory web application.
 * Loads display + editorial + sans + mono fonts, design-system stylesheet, and app shell.
 * Also wires Add to Home Screen metadata (manifest + Apple web app) without a service worker.
 *
 * Type system per the BlackStory brand kit (brand/tokens/typography.json, binding): Sora
 * SemiBold for headlines/titles/key statements, Inter for UI and body, Source Serif 4 for
 * editorial longform, IBM Plex Mono for data/citations. Sora replaced the earlier
 * Inter-Display display register when the kit landed (2026-07-18) — the wordmark art is
 * unaffected (the lockup ships as provided, never retyped).
 */
import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { Sora, Inter, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import { brandOpenGraph, PRODUCT_NAME } from '@repo/config';
import { THEME_BOOTSTRAP_SCRIPT } from '@repo/ui';
import '@repo/ui/styles.css';
import '@fortawesome/fontawesome-svg-core/styles.css';
import '../lib/fontawesome';
import { SiteShell } from '../components/SiteShell';
import './shell.css';

/** Archive Paper — light canvas / default splash + theme-color. */
const ARCHIVE_PAPER = '#F4EFE5';
/** Black Ink — dark canvas / dark theme-color. */
const BLACK_INK = '#0A0A0A';

const openGraphImage = brandOpenGraph('dark');

/**
 * Theme colors for browser chrome and installed home-screen shell.
 * Light/dark follow prefers-color-scheme; site theme toggle is separate.
 */
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: ARCHIVE_PAPER },
    { media: '(prefers-color-scheme: dark)', color: BLACK_INK },
  ],
  width: 'device-width',
  initialScale: 1,
};

const displayFace = Sora({
  subsets: ['latin'],
  variable: '--ds-font-display',
  display: 'swap',
});

const sans = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--ds-font-sans',
  display: 'swap',
});

const editorial = Source_Serif_4({
  subsets: ['latin'],
  variable: '--ds-font-editorial',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--ds-font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048'),
  applicationName: PRODUCT_NAME,
  title: {
    default: PRODUCT_NAME,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description:
    'Place-connected Black history research with published claims, provenance, and confidence.',
  // Installability + standalone chrome (no service worker; online-first).
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    title: PRODUCT_NAME,
    // Opaque status bar using the page background (Archive Paper / Black Ink via theme).
    statusBarStyle: 'default',
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    // Properly-sized renders from the brand/ kit — see brand.md.
    // `/favicon.ico` covers legacy browser requests that ignore <link rel="icon">.
    icon: [
      { url: '/favicon.ico', sizes: '32x32', type: 'image/x-icon' },
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
      { url: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/brand/icon-512.png', sizes: '512x512', type: 'image/png' },
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
    siteName: PRODUCT_NAME,
    title: PRODUCT_NAME,
    description:
      'Place-connected Black history research with published claims, provenance, and confidence.',
    images: [
      {
        url: openGraphImage,
        width: 1200,
        height: 630,
        alt: 'BlackStory · History, pinned to place.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: PRODUCT_NAME,
    description:
      'Place-connected Black history research with published claims, provenance, and confidence.',
    images: [openGraphImage],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${displayFace.variable} ${sans.variable} ${editorial.variable} ${mono.variable}`}
    >
      <head>
        {/* Blocking theme apply before paint — matches ThemeToggle storage + prefers-color-scheme. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <a className="ds-skip-link" href="#main">
          Skip to main content
        </a>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}

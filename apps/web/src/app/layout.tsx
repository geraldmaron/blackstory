/**
 * Root layout for the public Black Book web application.
 * Loads display + editorial + sans + mono fonts, design-system stylesheet, and app shell.
 *
 * Display type is Inter Display per brand pack 3.0.0-final: the Inter v4 variable
 * font carries an `opsz` axis whose upper master IS Inter Display, so one loaded
 * family serves both --bb-font-display and --bb-font-sans with true optical sizing.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Inter, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import '@black-book/ui/styles.css';
import { SiteShell } from '../components/SiteShell';
import './shell.css';

const sans = Inter({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--bb-font-sans',
  display: 'swap',
});

const editorial = Source_Serif_4({
  subsets: ['latin'],
  variable: '--bb-font-editorial',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--bb-font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048'),
  title: {
    default: 'Black Book',
    template: '%s — Black Book',
  },
  description:
    'Place-connected Black history research with published claims, provenance, and confidence.',
  icons: {
    icon: [
      { url: '/brand/favicon.svg', type: 'image/svg+xml' },
      { url: '/brand/favicon-light-32.png', sizes: '32x32', type: 'image/png' },
      { url: '/brand/favicon-light-16.png', sizes: '16x16', type: 'image/png' },
      {
        url: '/brand/favicon-dark-32.png',
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [{ url: '/brand/apple-touch-icon-light-180.png', sizes: '180x180' }],
  },
  openGraph: {
    siteName: 'Black Book',
    title: 'Black Book',
    description:
      'Place-connected Black history research with published claims, provenance, and confidence.',
    images: [
      {
        url: '/brand/black-book-open-graph-dark-1200x630.png',
        width: 1200,
        height: 630,
        alt: 'Black Book — History, pinned to place.',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Black Book',
    description:
      'Place-connected Black history research with published claims, provenance, and confidence.',
    images: ['/brand/black-book-open-graph-dark-1200x630.png'],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${sans.variable} ${editorial.variable} ${mono.variable}`}
    >
      <body>
        <a className="bb-skip-link" href="#main">
          Skip to main content
        </a>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}

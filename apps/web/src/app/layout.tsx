/**
 * Root layout for the public Black Book web application.
 * Loads editorial + mono fonts, design-system stylesheet, and BB-048 app shell.
 */
import type { ReactNode } from 'react';
import { Source_Sans_3, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import '@black-book/ui/styles.css';
import { SiteShell } from '../components/SiteShell';
import './shell.css';

const editorial = Source_Serif_4({
  subsets: ['latin'],
  variable: '--bb-font-editorial',
  display: 'swap',
});

const sans = Source_Sans_3({
  subsets: ['latin'],
  variable: '--bb-font-sans',
  display: 'swap',
});

const mono = IBM_Plex_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--bb-font-mono',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'Black Book',
    template: '%s — Black Book',
  },
  description:
    'Place-connected Black history research with published claims, provenance, and confidence.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      data-theme="light"
      className={`${editorial.variable} ${sans.variable} ${mono.variable}`}
    >
      <body>
        <a className="bb-visually-hidden" href="#main">
          Skip to main content
        </a>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}

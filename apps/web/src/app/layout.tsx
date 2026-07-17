/**
 * Root layout for the public Black Book web application.
 * Loads display + editorial + sans + mono fonts, design-system stylesheet, and app shell.
 */
import type { ReactNode } from 'react';
import { Sora, Inter, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import '@black-book/ui/styles.css';
import { SiteShell } from '../components/SiteShell';
import './shell.css';

const display = Sora({
  subsets: ['latin'],
  weight: ['600', '700'],
  variable: '--bb-font-display',
  display: 'swap',
});

const editorial = Source_Serif_4({
  subsets: ['latin'],
  variable: '--bb-font-editorial',
  display: 'swap',
});

const sans = Inter({
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
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3048'),
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
      className={`${display.variable} ${editorial.variable} ${sans.variable} ${mono.variable}`}
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

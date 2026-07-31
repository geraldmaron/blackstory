/**
 * Root layout for the private BlackStory administration console.
 * Shared island navbar + brand fonts; matches the public shell traversal chrome.
 */
import type { ReactNode } from 'react';
import { Schibsted_Grotesk, Geist, Geist_Mono } from 'next/font/google';
import { THEME_BOOTSTRAP_SCRIPT } from '@repo/ui';
import '@repo/ui/styles.css';
import { AdminAuthProvider } from '../auth/AdminAuthProvider';
import { AdminShellChrome } from '../components/AdminShellChrome';
import './admin.css';

const displayFace = Schibsted_Grotesk({
  subsets: ['latin'],
  variable: '--ds-font-display',
  display: 'swap',
});

const sans = Geist({
  subsets: ['latin'],
  variable: '--ds-font-sans',
  display: 'swap',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--ds-font-mono',
  display: 'swap',
});

export const metadata = {
  title: {
    default: 'BlackStory Admin',
    template: '%s — BlackStory Admin',
  },
  description: 'Private administration and research console',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body className={`${displayFace.variable} ${sans.variable} ${mono.variable}`}>
        <AdminAuthProvider>
          <AdminShellChrome>{children}</AdminShellChrome>
        </AdminAuthProvider>
      </body>
    </html>
  );
}

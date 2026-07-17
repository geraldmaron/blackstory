/**
 * Root layout for the public Black Book web application.
 * Loads editorial + mono fonts and the shared design-system stylesheet (BB-007).
 */
import type { ReactNode } from 'react';
import { Source_Sans_3, Source_Serif_4, IBM_Plex_Mono } from 'next/font/google';
import '@black-book/ui/styles.css';

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
  title: 'Black Book',
  description: 'Place-connected Black history research',
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
        {children}
      </body>
    </html>
  );
}

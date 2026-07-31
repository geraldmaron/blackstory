/**
 * Root layout for the BlackStory GitHub Pages docs site.
 * Loads brand fonts, theme bootstrap, and the docs shell around every page.
 */
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Schibsted_Grotesk, Geist, Newsreader, Geist_Mono } from 'next/font/google';
import { DocsShell, type NavSection } from '@/components/docs-shell';
import { buildSearchIndex, docsByNav } from '@/lib/content';
import { withBasePath } from '@/lib/base-path';
import { PRODUCT_NAME, SITE_DESCRIPTION, THEME_BOOTSTRAP_SCRIPT } from '@/lib/site';
import './docs.css';

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

const editorial = Newsreader({
  subsets: ['latin'],
  axes: ['opsz'],
  variable: '--ds-font-editorial',
  display: 'swap',
});

const mono = Geist_Mono({
  subsets: ['latin'],
  variable: '--ds-font-mono',
  display: 'swap',
});

const basePath = process.env.DOCS_BASE_PATH || '';

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_SITE_URL ?? `https://geraldmaron.github.io${basePath || '/blackstory'}`,
  ),
  title: {
    default: `${PRODUCT_NAME} Docs`,
    template: `%s · ${PRODUCT_NAME}`,
  },
  description: SITE_DESCRIPTION,
  icons: {
    icon: [
      { url: withBasePath('/brand/favicon-light-32.png'), sizes: '32x32', type: 'image/png' },
      {
        url: withBasePath('/brand/favicon-dark-32.png'),
        sizes: '32x32',
        type: 'image/png',
        media: '(prefers-color-scheme: dark)',
      },
    ],
    apple: [{ url: withBasePath('/brand/apple-touch-icon-light-180.png'), sizes: '180x180' }],
  },
  openGraph: {
    siteName: PRODUCT_NAME,
    title: `${PRODUCT_NAME} Docs`,
    description: SITE_DESCRIPTION,
    images: [
      {
        // Relative to metadataBase (already includes /blackstory). Do not withBasePath.
        // `v=` busts scraper caches when the opaque OG asset is regenerated.
        url: '/brand/open-graph-dark-1200x630.png?v=20260721',
        width: 1200,
        height: 630,
      },
    ],
  },
};

function buildNavSections(): NavSection[] {
  return docsByNav().map((group) => ({
    label: group.label,
    links: group.docs.map((doc, index) => ({
      num: String(index + 1).padStart(2, '0'),
      title: doc.title,
      url: doc.url,
    })),
  }));
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const sections = buildNavSections();
  const searchIndex = buildSearchIndex();

  return (
    <html
      lang="en"
      className={`${displayFace.variable} ${sans.variable} ${editorial.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} />
      </head>
      <body>
        <DocsShell sections={sections} searchIndex={searchIndex}>
          {children}
        </DocsShell>
      </body>
    </html>
  );
}

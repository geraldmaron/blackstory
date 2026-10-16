/**
 * Test helpers for kit components: render to static markup inside the design system's provider and
 * read the result as plain data. No DOM, no browser: Tamagui renders to HTML under Node, and the
 * assertions that matter (landmarks, roles, text, which theme role a style resolves to) are all
 * visible in that markup. Visual correctness is the Playwright baseline's job, not this file's.
 */
import type { ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { TamaguiProvider } from '@tamagui/core';
import { config } from './config';
import type { ThemeName } from './tokens';

export type Rendered = {
  /** The component's markup with the hoisted <style> blocks removed. */
  readonly html: string;
  /** The raw markup including <style> blocks (atomic CSS class rules). */
  readonly raw: string;
  readonly theme: ThemeName;
  /** Visible text, tags stripped, whitespace collapsed. Visually hidden text IS included (it is read aloud). */
  text(): string;
  /** Every opening tag with the given name, as a string. */
  tags(name: string): readonly string[];
  /** Attribute value on the first tag with that name that has it, or null. (The provider adds a wrapper span.) */
  attr(tag: string, attribute: string): string | null;
};

export function render(node: ReactElement, theme: ThemeName = 'dark'): Rendered {
  const raw = renderToStaticMarkup(
    <TamaguiProvider config={config} defaultTheme={theme}>
      {node}
    </TamaguiProvider>,
  );
  const html = raw.replace(/<style\b[\s\S]*?<\/style>/g, '');
  const tags = (name: string): readonly string[] =>
    html.match(new RegExp(`<${name}\\b[^>]*>`, 'g')) ?? [];
  return {
    html,
    raw,
    theme,
    text: () =>
      html
        .replace(/<[^>]+>/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"')
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, ' ')
        .trim(),
    tags,
    attr(tag, attribute) {
      const pattern = new RegExp(`\\s${attribute}="([^"]*)"`);
      for (const found of tags(tag)) {
        const m = pattern.exec(found);
        if (m) return m[1] ?? '';
      }
      return null;
    },
  };
}

/** True when the emitted CSS defines the value (Tamagui writes each theme value once, as a `--tN` variable). */
export function emitsCssValue(value: string): boolean {
  return config.getCSS().toLowerCase().includes(value.toLowerCase());
}

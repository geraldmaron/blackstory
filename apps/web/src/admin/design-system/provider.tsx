'use client';
/** Base Web is scoped to management; the public reading kit keeps its own contract. */
import { useEffect, useState, type ReactNode } from 'react';
import { useServerInsertedHTML } from 'next/navigation';
import { BaseProvider } from 'baseui';
import { createTheme, createDarkTheme, LightTheme } from 'baseui/themes';
import { Provider as StyletronProvider } from 'styletron-react';
import { Client, Server } from 'styletron-engine-monolithic';

const font = 'var(--ds-font-sans), sans-serif';
const colors = {
  backgroundPrimary: 'var(--ds-canvas)',
  backgroundSecondary: 'var(--ds-surface)',
  backgroundTertiary: 'var(--ds-canvas)',
  contentPrimary: 'var(--ds-ink)',
  contentSecondary: 'var(--ds-ink-subtle)',
  contentTertiary: 'var(--ds-ink-subtle)',
  borderOpaque: 'var(--ds-border)',
  borderSelected: 'var(--ds-accent)',
  borderFocus: 'var(--ds-accent)',
  buttonPrimaryFill: 'var(--ds-ink)',
  buttonPrimaryHover: 'var(--ds-ink)',
  buttonPrimaryActive: 'var(--ds-ink)',
  buttonPrimaryText: 'var(--ds-canvas)',
  buttonSecondaryFill: 'var(--ds-surface)',
  buttonSecondaryHover: 'var(--ds-canvas)',
  buttonSecondaryActive: 'var(--ds-canvas)',
  buttonSecondaryText: 'var(--ds-ink)',
  buttonTertiaryFill: 'transparent',
  buttonTertiaryHover: 'var(--ds-surface)',
  buttonTertiaryActive: 'var(--ds-surface)',
  buttonTertiaryText: 'var(--ds-ink)',
  inputFill: 'var(--ds-surface)',
  inputFillActive: 'var(--ds-surface)',
  inputText: 'var(--ds-ink)',
  inputPlaceholder: 'var(--ds-ink-subtle)',
  inputBorder: 'var(--ds-border)',
  inputBorderFocus: 'var(--ds-accent)',
  menuFill: 'var(--ds-surface)',
  menuFillHover: 'var(--ds-canvas)',
  menuFontDefault: 'var(--ds-ink)',
  menuFontHighlighted: 'var(--ds-ink)',
  linkText: 'var(--ds-accent)',
  linkVisited: 'var(--ds-accent)',
  linkHover: 'var(--ds-accent)',
  tickFill: 'var(--ds-ink)',
  tickFillHover: 'var(--ds-ink)',
  tickFillActive: 'var(--ds-ink)',
  tickBorder: 'var(--ds-border)',
  tickMarkFill: 'var(--ds-canvas)',
  tableHeadBackgroundColor: 'var(--ds-canvas)',
  tableBackground: 'var(--ds-surface)',
  tableStripedBackground: 'var(--ds-canvas)',
  tableFilter: 'var(--ds-ink)',
  tableHeadText: 'var(--ds-ink)',
  tableBodyText: 'var(--ds-ink)',
  tableBorder: 'var(--ds-border)',
};
const overrides = {
  colors,
  lighting: Object.fromEntries(
    Object.keys(LightTheme.lighting).map((key) => [
      key,
      key.startsWith('overlay') ? 'transparent' : 'none',
    ]),
  ),
  animation: Object.fromEntries(
    Object.entries(LightTheme.animation).map(([key, value]) => [
      key,
      key.startsWith('timing') ? '0ms' : value,
    ]),
  ),
  typography: Object.fromEntries(
    Object.entries(LightTheme.typography).map(([key, value]) => [
      key,
      { ...value, fontFamily: font },
    ]),
  ),
  borders: {
    radius100: '8px',
    radius200: '8px',
    radius300: '16px',
    radius400: '16px',
    radius500: '28px',
    buttonBorderRadius: '8px',
    inputBorderRadius: '8px',
    surfaceBorderRadius: '16px',
    popoverBorderRadius: '16px',
  },
};
// Checkbox marks are embedded SVG data URLs, where CSS variables cannot resolve.
const lightTheme = createTheme({ ...overrides, colors: { ...colors, tickMarkFill: '#F4EFE5' } }),
  darkTheme = createDarkTheme({ ...overrides, colors: { ...colors, tickMarkFill: '#0A0A0A' } });
export function AdminDesignProvider({ children }: { children: ReactNode }) {
  const [engine] = useState(() => {
    if (typeof window === 'undefined') return new Server();
    // App Router streams multiple style batches; monolithic accepts one hydration descriptor.
    // Existing style tags keep their CSS. This detached descriptor merges only cache metadata.
    const descriptor = document.createElement('style');
    descriptor.setAttribute(
      'data-hydrate',
      Array.from(document.querySelectorAll('style[data-admin-styletron]'))
        .map((sheet) => sheet.getAttribute('data-hydrate') ?? '')
        .join(' '),
    );
    return new Client({ hydrate: [descriptor], container: document.head });
  });
  const [emitted] = useState(() => new Set<string>());
  const [mode, setMode] = useState('light');
  const [layerIndex, setLayerIndex] = useState(0);
  useEffect(() => {
    const update = () => {
      setMode(document.documentElement.dataset.theme ?? 'light');
      setLayerIndex(
        Number(getComputedStyle(document.documentElement).getPropertyValue('--ds-z-nav-drawer')) ||
          0,
      );
    };
    update();
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    return () => observer.disconnect();
  }, []);
  useServerInsertedHTML(() => {
    if (!(engine instanceof Server)) return null;
    const fresh = Object.entries(engine.cache).filter(([key]) => !emitted.has(key));
    if (!fresh.length) return null;
    fresh.forEach(([key]) => emitted.add(key));
    return (
      <style
        data-admin-styletron=""
        data-hydrate={fresh.map(([key]) => key).join(' ')}
        dangerouslySetInnerHTML={{ __html: fresh.map(([, css]) => css).join('') }}
      />
    );
  });
  return (
    <StyletronProvider value={engine}>
      <BaseProvider theme={mode === 'dark' ? darkTheme : lightTheme} zIndex={layerIndex}>
        {children}
      </BaseProvider>
    </StyletronProvider>
  );
}

import type { MapColorScheme } from '../../lib/map-experience/dignity-style';

export function readDocumentColorScheme(): MapColorScheme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

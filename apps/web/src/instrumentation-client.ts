/**
 * Runs client-side before hydration (Next file convention; must live in `src/` because the
 * app directory does, no other wiring needed).
 *
 * Installs the dev-only filter for the React DevTools "cleaning up async info" console error.
 * See `lib/runtime-hardening/devtools-console-filter.ts` for what it is and why a plain wrap
 * is not enough.
 */
import { installDevtoolsConsoleFilter } from './lib/runtime-hardening/devtools-console-filter';

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  installDevtoolsConsoleFilter(window.console);
}

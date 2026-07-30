/**
 * Lets `node --test` import a component that imports its own stylesheet.
 *
 * Next.js resolves `import './panel.css'` through its bundler; plain Node throws
 * `ERR_UNKNOWN_FILE_EXTENSION` on the same line. Without this hook the only testable components
 * are the ones with no styles of their own, which quietly pushes every styled panel — the lens,
 * the results rail, the record sheet — out of test coverage for a reason that has nothing to do
 * with the component.
 *
 * The stub resolves a `.css` specifier to an empty module. Tests assert markup and semantics;
 * they never assert computed style, so there is nothing for the stylesheet to contribute.
 */
import { registerHooks } from 'node:module';

/** A real file rather than a `data:` URL: tsx's resolver treats the latter as a path and stats it. */
const EMPTY_MODULE = new URL('./empty-style.mjs', import.meta.url).href;

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.endsWith('.css')) {
      return { url: EMPTY_MODULE, shortCircuit: true };
    }
    return nextResolve(specifier, context);
  },
});

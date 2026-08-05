'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * `A` opens the Atlas with the evidence floor set to A only, which is what makes this page's
 * argument operable rather than described.
 *
 * WHY THIS IS ITS OWN FILE. It is the only thing on `/methodology` that needs the browser, and
 * `'use client'` is contagious downward through imports, not just behaviour: with the directive on
 * `MethodologySections`, that file's `@repo/domain/facts` import pulled `@repo/schemas`, and with
 * it the constitution loader's `node:path` and `node:url`, into the client bundle. Webpack cannot
 * resolve a `node:` scheme for the browser, so the production build failed outright while lint,
 * typecheck, tests and a11y all passed — none of the five gates builds. Keeping the client
 * boundary as small as the interaction that needs it keeps the rest of the page on the server.
 *
 * No shared reading-room shortcut registry exists yet to hang this on: `lib/keyboard/bindings.ts`
 * scopes bare keys to the Instrument only. This reuses the registry's own typing-target shape
 * check so it declines mid-form the same way the registry does, rather than inventing a second
 * definition of "typing". When a reading-room keyboard scope lands, delete this.
 */
export function MethodologyAtlasShortcut(): null {
  const router = useRouter();

  useEffect(() => {
    function isTypingTarget(target: EventTarget | null): boolean {
      if (target === null || typeof target !== 'object') return false;
      const element = target as { tagName?: unknown; isContentEditable?: unknown };
      if (element.isContentEditable === true) return true;
      return (
        typeof element.tagName === 'string' &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(element.tagName)
      );
    }
    function onKeyDown(event: KeyboardEvent): void {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== 'a') return;
      if (isTypingTarget(event.target)) return;
      event.preventDefault();
      router.push('/?confidence=high');
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [router]);

  return null;
}

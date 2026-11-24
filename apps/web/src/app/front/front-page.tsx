/**
 * The front page in its v13 form (docs/ui/DESIGN.md section 9.7): the retelling on ink, then the
 * contents on paper. Rendered at `/` (page.tsx).
 */
import React from 'react';
import { FrontContents } from './front-contents';
import { Retelling } from './retelling';

void React;

export function FrontPage({ returning = false }: { readonly returning?: boolean }) {
  return (
    <main id="main" className="ds-front" data-ground="ink" data-ground-fixed="">
      <Retelling returning={returning} />
      <FrontContents />
    </main>
  );
}

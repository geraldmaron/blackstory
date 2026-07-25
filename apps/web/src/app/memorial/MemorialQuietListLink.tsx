/**
 * Single small quiet text link, fixed near the bottom of the viewport.
 * Portaled to document.body: the shell's page-transition wrapper carries a
 * (identity) CSS transform, which establishes a new containing block for any
 * `position: fixed` descendant and pins it to document height instead of the
 * viewport. Escaping to body keeps it truly viewport-fixed.
 */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export type MemorialQuietListLinkProps = {
  readonly label: string;
};

export function MemorialQuietListLink({ label }: MemorialQuietListLinkProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return null;
  }

  return createPortal(
    <p className="ds-memorial-edition__quiet-links">
      <Link href="#memorial-names">{label}</Link>
      <span aria-hidden="true"> · </span>
      <Link href="/explore">Open the map</Link>
    </p>,
    document.body,
  );
}

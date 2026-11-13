'use client';

import React from 'react';
import Link from 'next/link';

void React;

/** A link to a Door pin's record: the opaque `/door/pin/pin-N` redirect needs a real `<a>` (it's
 * a server answer, not a client route), public `/place/` and `/law` paths take a Next `Link`. */
export function DoorRecordLink({
  href,
  className,
  children,
}: {
  readonly href: string;
  readonly className?: string;
  readonly children: React.ReactNode;
}) {
  return href.startsWith('/door/pin/') ? (
    <a className={className} href={href}>
      {children}
    </a>
  ) : (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

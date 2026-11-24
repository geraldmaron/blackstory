/**
 * The memorial wall's closing card: BlackStory at `/`.
 *
 * Every other room lost this card in the 2026-11 rebuild (it repeated the logo and the Map tab).
 * The memorial is a protected experience (docs/ui/PROTECTED-EXPERIENCES.md) and is not part of
 * that rebuild, so its card stays, drawn here and nowhere else. Do not add a second call site.
 */
import React from 'react';
import Link from 'next/link';
import { buttonClassName } from '@repo/ui';
import { loadWalkBackPlace } from './walk-back-place';

void React;

export function WalkOffRampView({
  placeName,
  href = '/',
  title,
  children,
}: {
  readonly placeName: string;
  readonly href?: string;
  readonly title?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  return (
    <aside className="ds-doc-offramp" aria-label="Where to go next">
      <h2 className="ds-doc-offramp__title">{title ?? placeName}</h2>
      <p>{children}</p>
      <div className="ds-doc-offramp__acts">
        {/* Secondary, in ink: the memorial takes no copper accent, and this card is drawn only here. */}
        <Link className={buttonClassName('secondary')} href={href}>
          {placeName}
        </Link>
      </div>
    </aside>
  );
}

export async function WalkOffRamp({
  title,
  children,
}: {
  readonly title?: React.ReactNode;
  readonly children: React.ReactNode;
}) {
  const place = await loadWalkBackPlace();
  return (
    <WalkOffRampView
      placeName={place.displayName}
      href={place.href}
      {...(title === undefined ? {} : { title })}
    >
      {children}
    </WalkOffRampView>
  );
}

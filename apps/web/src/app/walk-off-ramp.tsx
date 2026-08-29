/**
 * Same way back from every archive room: the place's published name, then any
 * extra quiet links. Atlas and Banned books are not rooms on this walk.
 */
import React from 'react';
import { OffRamp, type OffRampAction } from '../components/room';
import { loadWalkBackPlace } from './walk-back-place';

void React;

export function WalkOffRampView({
  placeName,
  href = '/',
  title,
  children,
  extra = [],
}: {
  readonly placeName: string;
  readonly href?: string;
  readonly title?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly extra?: readonly OffRampAction[];
}) {
  const extras = extra.map((action) => ({
    ...action,
    emphasis: 'quiet' as const,
  }));
  return (
    <OffRamp
      title={title ?? placeName}
      actions={[{ label: placeName, href, emphasis: 'copper' }, ...extras]}
    >
      {children}
    </OffRamp>
  );
}

export async function WalkOffRamp({
  title,
  children,
  extra = [],
}: {
  readonly title?: React.ReactNode;
  readonly children: React.ReactNode;
  readonly extra?: readonly OffRampAction[];
}) {
  const place = await loadWalkBackPlace();
  if (!place) return null;
  return (
    <WalkOffRampView
      placeName={place.displayName}
      href={place.href}
      extra={extra}
      {...(title === undefined ? {} : { title })}
    >
      {children}
    </WalkOffRampView>
  );
}

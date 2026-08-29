/**
 * Same way back from every archive room: the place, then any extra quiet links.
 * Atlas and Banned books are not rooms on this walk.
 */
import React from 'react';
import { OffRamp, type OffRampAction } from '../components/room';

void React;

export function WalkOffRamp({
  title = 'The place',
  children,
  extra = [],
}: {
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
      title={title}
      actions={[{ label: 'The place', href: '/', emphasis: 'copper' }, ...extras]}
    >
      {children}
    </OffRamp>
  );
}

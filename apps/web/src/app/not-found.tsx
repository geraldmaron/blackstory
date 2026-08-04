/**
 * Global not-found page for unknown public routes and missing entities.
 * v9 utility room with shared gutter mosaic and fail-state EmptyState.
 */

import Link from 'next/link';
import { EmptyState } from '@repo/ui';
import { Room, RoomHeader } from '../components/room';
import './utility.css';

export default function NotFound() {
  return (
    <Room>
      <RoomHeader
        pathname="/not-found"
        kicker="Missing route"
        title="Page not found"
        lede="That route is not part of the public shell, or the entity id is unknown."
      />

      <EmptyState
        title="Nothing to show here"
        action={
          <Link className="ds-button ds-button--primary" href="/records">
            Find in the archive
          </Link>
        }
      >
        Try History, Explore, or return to the home page. Design-system fixtures remain at
        /design-system.
      </EmptyState>
    </Room>
  );
}

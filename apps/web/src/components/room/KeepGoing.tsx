/**
 * The closing chapter of a standalone room: where to go next, as plate-led rows.
 *
 * On 2026-09-20 Submit, Corrections, Support, Privacy, Terms and Questions ended with no handoff at
 * all. Title, icon and sentence come from the destination registry, the same source the Rooms hub
 * cards read, so a room never writes its own description of another room.
 */
import React from 'react';
import { cardTitleFor, destinationFor } from '../../lib/nav/destination-registry';
import { RoomHandoff, RoomSection, type RoomSectionTone } from './RoomSection';

void React;

export type KeepGoingProps = {
  /** Registry paths, in the order a reader should meet them: `['/methodology', '/errata']`. */
  readonly paths: readonly string[];
  readonly tone?: RoomSectionTone;
};

export function KeepGoing({ paths, tone = 'canvas' }: KeepGoingProps) {
  const destinations = paths.flatMap((path) => {
    const destination = destinationFor(path);
    // A handoff is a title and a sentence. A destination the registry has no sentence for is
    // skipped rather than drawn as a bare title.
    return destination?.description === undefined
      ? []
      : [{ ...destination, description: destination.description }];
  });
  if (destinations.length === 0) return null;
  return (
    <RoomSection id="keep-going" icon="rooms" kicker="Next" title="Keep going" tone={tone}>
      <div className="ds-room-handoffs">
        {destinations.map((destination) => (
          <RoomHandoff
            key={destination.path}
            href={destination.path}
            icon={destination.icon}
            title={cardTitleFor(destination)}
            line={destination.description}
          />
        ))}
      </div>
    </RoomSection>
  );
}

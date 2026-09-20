/**
 * `/sources` body: publisher kinds, citation lineage, and the public surfaces that already
 * list sources. Counts stay off this page; they are computed on the operator desk from the
 * active release.
 */
import React from 'react';
import {
  Note,
  Prose,
  ReadingEntry,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
  roomSectionTone,
} from '../../components/room';
import { WalkOffRamp } from '../walk-off-ramp';
import { SourceLineageDiagram } from '../methodology/MethodologyDiagrams';
import {
  SOURCE_LIBRARY_SURFACES,
  SOURCE_LINEAGE_STAGES,
  SOURCE_PUBLISHER_KINDS,
} from '../methodology/methodology-copy';

void React;

const SOURCES_INTRO =
  'Every public claim on BlackStory traces to a publisher someone can open. This room names the kinds of publishers the archive cites, shows how a URL becomes a citation on a record, and points to where each surface already lists its sources.';

const SOURCES_JUMP = [
  { id: 'citation-chain', label: 'Citation chain', icon: 'source' as const },
  { id: 'publisher-kinds', label: 'Publisher kinds', icon: 'publication' as const },
  { id: 'where-sources-appear', label: 'Where they appear', icon: 'records' as const },
] as const;

export function SourcesSections() {
  return (
    <>
      <ReadingEntry
        pathname="/sources"
        title={
          <>
            Where the evidence <em>comes from</em>.
          </>
        }
        lede={SOURCES_INTRO}
      />

      <RoomJump sections={SOURCES_JUMP} />

      <RoomSection
        id="citation-chain"
        icon="source"
        kicker="Lineage"
        title="How a URL becomes a citation"
        tone={roomSectionTone(0)}
      >
        <SourceLineageDiagram />
        <RoomFactList
          items={SOURCE_LINEAGE_STAGES.map((stage) => ({
            title: stage.title,
            body: stage.body,
            icon: stage.icon,
            kicker: stage.step,
          }))}
        />
      </RoomSection>

      <RoomSection
        id="publisher-kinds"
        icon="publication"
        kicker="Kinds"
        title="Publisher kinds"
        tone={roomSectionTone(1)}
      >
        <Prose>
          <p>
            BlackStory groups citation hosts under publisher kinds. A government archive is not the
            same kind of source as a newsroom or a crowd-edited wiki, and the archive treats them
            differently when grading a claim.
          </p>
        </Prose>
        <RoomFactList
          items={SOURCE_PUBLISHER_KINDS.map((entry) => ({
            title: entry.kind,
            body: (
              <>
                <p>{entry.body}</p>
                <p className="ds-mono">Examples: {entry.examples}</p>
              </>
            ),
            icon: 'source' as const,
          }))}
        />
      </RoomSection>

      <RoomSection
        id="where-sources-appear"
        icon="records"
        kicker="Surfaces"
        title="Where sources already appear"
        tone={roomSectionTone(2)}
      >
        <Prose>
          <p>On the public site, sources already appear in three places:</p>
        </Prose>
        <div className="ds-room-handoffs">
          {SOURCE_LIBRARY_SURFACES.map((surface) => (
            <RoomHandoff
              key={surface.href}
              href={surface.href}
              icon={surface.icon}
              title={surface.title}
              line={surface.body}
            />
          ))}
        </div>
        <Note kind="LIMITATIONS">
          Publisher profiles and live counts are computed from the active release at read time. This
          page names the kinds and the chain; it does not list every publisher or claim count.
        </Note>
      </RoomSection>

      <WalkOffRamp
        extra={[
          { label: 'Methodology', href: '/methodology' },
          { label: 'Data', href: '/data' },
        ]}
      >
        The same publishers sit under every public claim. Methodology is the receipt for how they
        are used.
      </WalkOffRamp>
    </>
  );
}

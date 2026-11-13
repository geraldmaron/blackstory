/**
 * `/sources` body: publisher kinds, citation lineage, and the public surfaces that already
 * list sources. Counts stay off this page; they are computed on the operator desk from the
 * active release.
 */
import React from 'react';
import Link from 'next/link';
import { Notice, PageHeader } from '@repo/ui';
import {
  parentCrumb,
  Prose,
  RoomFactList,
  RoomHandoff,
  RoomJump,
  RoomSection,
} from '../../components/room';
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
  { id: 'citation-chain', label: 'Citation chain' },
  { id: 'publisher-kinds', label: 'Publisher kinds' },
  { id: 'where-sources-appear', label: 'Where they appear' },
] as const;

export function SourcesSections() {
  return (
    <>
      <PageHeader
        crumb={parentCrumb('/sources')}
        linkAs={Link}
        title="Where the evidence comes from"
        dek={SOURCES_INTRO}
      />

      <RoomJump sections={SOURCES_JUMP} />

      <RoomSection id="citation-chain" title="How a URL becomes a citation">
        <SourceLineageDiagram />
        <RoomFactList
          items={SOURCE_LINEAGE_STAGES.map((stage) => ({
            title: stage.title,
            body: stage.body,
          }))}
        />
      </RoomSection>

      <RoomSection id="publisher-kinds" title="Publisher kinds">
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
          }))}
        />
      </RoomSection>

      <RoomSection id="where-sources-appear" title="Where sources already appear">
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
        <Notice tone="note" title="Limitations">
          Publisher profiles and live counts are computed from the active release at read time. This
          page names the kinds and the chain; it does not list every publisher or claim count.
        </Notice>
      </RoomSection>
    </>
  );
}

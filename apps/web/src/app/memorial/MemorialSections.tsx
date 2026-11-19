/**
 * The memorial's names index, below the wall (see page.tsx): every name, server-rendered, on one
 * paper sheet laid on the table. A heading on the table rises over the dimming wall; the sheet
 * carries the finder (a "Find a name" field and the letter jump) and the names grouped by initial,
 * each group marked by its letter at display size and read down in columns.
 */
import React from 'react';
import Link from 'next/link';
import { Sheet } from '@repo/ui';
import {
  memorialNamePlace,
  memorialNameYear,
  memorialNamesByInitial,
} from '../../components/patterns/memorial-wall/memorial-names';
import { MEMORIAL_LIST_LEDE, MEMORIAL_LIST_NOTE } from './memorial-copy';
import { memorialGroupId } from './memorial-group-id';
import { MemorialNameFinder } from './MemorialNameFinder';
import { RoomHandoff } from '../../components/room';

void React;

export type MemorialSectionsProps = {
  /**
   * Name -> entity id, for the names this archive also holds a record of.
   *
   * A name in this map renders as a link to that record; a name absent from it renders as plain
   * text, and the sentence above the list says so in words (design-direction-v9-surfaces.md §4,
   * /memorial: "Names are links where a record exists and plain text where none does, and the
   * difference is stated in words, never implied by color alone").
   *
   * DELIBERATELY EMPTY TODAY, and that is a decision rather than an omission. `MEMORIAL_NAMES`
   * is a list of strings with no entity ids, so populating this would mean matching a murdered
   * person to a record by their name. Two people share a name often enough that the failure mode
   * is attributing one person's killing to another person's record, on the one surface where
   * that is least forgivable. The rendering rule ships here; the join is a follow-up and needs
   * verified per-name evidence, not a string match.
   */
  readonly entityLinksByName?: Readonly<Record<string, string>>;
};

export function MemorialSections({ entityLinksByName = {} }: MemorialSectionsProps = {}) {
  const groups = memorialNamesByInitial();
  // The sentence is shown when the difference it explains actually exists on the page. With no
  // name linked there is no difference to explain, and stating one would describe a distinction
  // the reader cannot see.
  const anyLinked = groups.some((group) => group.names.some((name) => entityLinksByName[name]));

  return (
    <div className="ds-memorial__list-zone">
      <article
        className="ds-memorial-index"
        aria-labelledby="memorial-names-heading"
        id="memorial-names"
        tabIndex={-1}
      >
        <header className="ds-memorial-index__head">
          <h1 className="ds-memorial-index__title" id="memorial-names-heading">
            Every name on this memorial
          </h1>
          <p className="ds-memorial-index__lede">{MEMORIAL_LIST_LEDE}</p>
          {anyLinked ? (
            <p className="ds-memorial-index__lede">
              Where this archive also holds a record of someone, their name is a link to it. Where
              it does not, the name is written plainly. Both are held here the same.
            </p>
          ) : null}
        </header>

        <Sheet className="ds-memorial-index__sheet">
          <MemorialNameFinder letters={groups.map((group) => group.letter)} />

          <div className="ds-memorial-index__groups">
            {groups.map((group) => {
              const id = memorialGroupId(group.letter);
              return (
                <section
                  className="ds-memorial-index__group"
                  id={id}
                  key={group.letter}
                  aria-labelledby={`${id}-heading`}
                >
                  <h2
                    className="ds-memorial-index__letter"
                    id={`${id}-heading`}
                    aria-label={`${group.letter}: ${group.names.length} ${group.names.length === 1 ? 'name' : 'names'}`}
                  >
                    {group.letter}
                  </h2>
                  <ul className="ds-memorial-index__names">
                    {group.names.map((name) => {
                      const year = memorialNameYear(name);
                      const place = memorialNamePlace(name);
                      const entityId = entityLinksByName[name];
                      return (
                        <li className="ds-memorial-index__entry" key={name}>
                          <span className="ds-memorial-index__name">
                            {entityId ? <Link href={`/entity/${entityId}`}>{name}</Link> : name}
                          </span>
                          {year || place ? (
                            <span className="ds-memorial-index__meta">
                              {year}
                              {year && place ? <span aria-hidden="true"> · </span> : null}
                              {place}
                            </span>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}

            <p className="ds-memorial-index__empty" id="memorial-names-empty" hidden>
              No name on this list matches what you typed.
            </p>

            <p className="ds-memorial__note">{MEMORIAL_LIST_NOTE}</p>
          </div>
        </Sheet>

        <div className="ds-memorial__related ds-room-handoffs">
          <RoomHandoff
            href="/submit"
            icon="submit"
            title="Submit a name"
            line="A lead is reviewed before anything is added. Nothing publishes on arrival."
          />
          <RoomHandoff
            href="/methodology"
            icon="methodology"
            title="How names are held"
            line="Living-person protection, and why a memorial name is not a map pin."
          />
          <RoomHandoff
            href="/about"
            icon="about"
            title="Who keeps this"
            line="One person, and the limits that come with that."
          />
        </div>
      </article>
    </div>
  );
}

'use client';
/**
 * The margin: one scrolling column of disclosure sections, ordered by when a writer needs them.
 * Behavior of every control is carried over from the old tabbed inspector; only the arrangement
 * changed.
 */
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Select } from 'baseui/select';
import { FileUploaderBasic as FileUploader } from 'baseui/file-uploader-basic';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faChevronDown, faXmark } from '@fortawesome/free-solid-svg-icons';
import { STORY_THEME_IDS } from '@repo/schemas/public-stories';
import type { EditorialStory, StoryBodyBlockDoc, StoryDraft } from '@repo/schemas';
import { TextField, TextAreaField, ChoiceField } from '../../design-system/fields';
import { AdminRecordPicker } from '@/components/patterns/admin-record-picker';
import { BlockEditor } from '../block-editor';
import { CREDIT_ROLES, ROLE_LABELS, moveCredit, toggleRole } from './credits';
import type { Patch, StudioProfile } from './manuscript-header';
import type { ReadinessItem, SectionId, ShowTarget } from './readiness';
import type { TagSuggestion } from './tag-suggestions';

export type MarginProps = {
  draft: StoryDraft;
  patch: Patch;
  record: EditorialStory;
  revision: number;
  editable: boolean;
  busy: boolean;
  dirty: boolean;
  canReview: boolean;
  canManage: boolean;
  profiles: readonly StudioProfile[];
  otherStories: readonly string[];
  tagsInUse: readonly string[];
  suggestions: readonly TagSuggestion[];
  onDismissSuggestion: (tag: string) => void;
  readiness: readonly ReadinessItem[];
  onShow: (target: ShowTarget) => void;
  sections: Record<SectionId, boolean>;
  onToggleSection: (id: SectionId) => void;
  onSlugEdit: (value: string) => void;
  reason: string;
  setReason: (value: string) => void;
  checks: { facts: boolean; rights: boolean; prose: boolean };
  setChecks: (value: { facts: boolean; rights: boolean; prose: boolean }) => void;
  decide: (decision: string) => Promise<void>;
  publish: () => Promise<void>;
  rollback: () => Promise<void>;
  restore: (revision: number) => Promise<void>;
  archiveReason: string;
  setArchiveReason: (value: string) => void;
  archiveConfirmed: boolean;
  setArchiveConfirmed: (value: boolean) => void;
  manageArchive: () => Promise<void>;
  recordLabels: Record<string, string>;
  onLinkRecords: (items: readonly { id: string; label: string }[]) => void;
  mentionedUnlinked: readonly { id: string; label: string }[];
  selectedBlock: number | null;
  setSelectedBlock: (updater: (index: number | null) => number | null) => void;
  moveBlock: (index: number, delta: number) => void;
  uploadBlockImage: (file: File, target: Extract<StoryBodyBlockDoc, { type: 'image' }>) => void;
  onProblem: (message: string) => void;
  addReference: () => void;
  focusSource: number | null;
  clearFocusSource: () => void;
};

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://blackstory.org';
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const truncate = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
const humanize = (id: string) => {
  const text = id.replaceAll('_', ' ');
  return text.charAt(0).toUpperCase() + text.slice(1);
};

function Section({
  id,
  title,
  note,
  open,
  onToggle,
  children,
}: {
  id: SectionId;
  title: string;
  note?: string | undefined;
  open: boolean;
  onToggle: (id: SectionId) => void;
  children: React.ReactNode;
}) {
  return (
    <section className="studio-section" id={`studio-section-${id}`}>
      <h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={`studio-panel-${id}`}
          onClick={() => onToggle(id)}
        >
          <span>{title}</span>
          {note && <span className="studio-section__note">{note}</span>}
          <FontAwesomeIcon icon={faChevronDown} aria-hidden="true" className="studio-chevron" />
        </button>
      </h2>
      <div id={`studio-panel-${id}`} className="studio-section__panel" hidden={!open}>
        {children}
      </div>
    </section>
  );
}

function RoleToggles({
  credit,
  disabled,
  onToggle,
}: {
  credit: StoryDraft['contributors'][number];
  disabled: boolean;
  onToggle: (role: (typeof CREDIT_ROLES)[number]) => void;
}) {
  return (
    <>
      {CREDIT_ROLES.map((role) => (
        <label key={role} className="studio-check">
          <input
            type="checkbox"
            checked={credit.roles.includes(role)}
            disabled={disabled}
            onChange={() => onToggle(role)}
          />
          {ROLE_LABELS[role]}
        </label>
      ))}
    </>
  );
}

function TagEditor({
  draft,
  patch,
  editable,
  tagsInUse,
  suggestions,
  onDismiss,
}: Pick<MarginProps, 'draft' | 'patch' | 'editable' | 'tagsInUse' | 'suggestions'> & {
  onDismiss: (tag: string) => void;
}) {
  const [text, setText] = useState('');
  const full = draft.tags.length >= 12;
  const add = (raw: string) => {
    const tag = raw.trim().slice(0, 80);
    if (!tag || full || draft.tags.some((t) => t.toLowerCase() === tag.toLowerCase())) return;
    patch('tags', [...draft.tags, tag]);
  };
  return (
    <div className="studio-group">
      <h3>Tags</h3>
      {draft.tags.length > 0 && (
        <ul className="studio-chips">
          {draft.tags.map((tag) => (
            <li key={tag} className="studio-tag">
              <span>{tag}</span>
              {editable && (
                <button
                  type="button"
                  aria-label={`Remove tag ${tag}`}
                  onClick={() =>
                    patch(
                      'tags',
                      draft.tags.filter((t) => t !== tag),
                    )
                  }
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <div className="studio-tag-input">
        <label className="studio-visually-hidden" htmlFor="studio-tag-input">
          Add a tag
        </label>
        <input
          id="studio-tag-input"
          list="studio-tags-in-use"
          value={text}
          placeholder={full ? 'A story holds up to 12 tags' : 'Add a tag and press Enter'}
          disabled={!editable || full}
          onChange={(e) => setText(e.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              add(text);
              setText('');
            }
          }}
        />
        <datalist id="studio-tags-in-use">
          {tagsInUse
            .filter((t) => !draft.tags.some((d) => d.toLowerCase() === t.toLowerCase()))
            .map((t) => (
              <option key={t} value={t} />
            ))}
        </datalist>
      </div>
      {editable && suggestions.length > 0 && !full && (
        <div className="studio-suggest">
          <p className="studio-hint">Suggested from the records this story links to</p>
          <ul className="studio-chips">
            {suggestions.map((s) => (
              <li key={s.tag} className="studio-suggest__item">
                <button
                  type="button"
                  className="studio-chip studio-chip--suggest"
                  title={s.records.map((r) => r.name).join(', ')}
                  onClick={() => add(s.tag)}
                >
                  + {s.tag} · from {s.records.length}{' '}
                  {s.records.length === 1 ? 'record' : 'records'}
                </button>
                <button
                  type="button"
                  className="studio-suggest__dismiss"
                  aria-label={`Dismiss suggestion ${s.tag}`}
                  onClick={() => onDismiss(s.tag)}
                >
                  <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function AddressSection(props: MarginProps) {
  const { draft, patch, record, revision, editable, otherStories, onSlugEdit } = props;
  const [changing, setChanging] = useState(false);
  const published = !!record.activePublicReleaseId;
  const taken = otherStories.includes(draft.slug);
  const invalid = !!draft.slug && !SLUG_RE.test(draft.slug);
  return (
    <>
      {revision && !changing ? (
        <p className="studio-address">
          <code>/stories/{draft.slug}</code>
          {editable && (
            <button type="button" className="studio-link" onClick={() => setChanging(true)}>
              Change address
            </button>
          )}
        </p>
      ) : (
        <>
          <TextField
            label="Address"
            value={draft.slug}
            onChange={onSlugEdit}
            disabled={!editable}
            {...(revision
              ? {}
              : {
                  caption:
                    'Follows the title until you change it. It is fixed after the first save.',
                })}
          />
          {revision > 0 && published && (
            <p className="studio-warn" role="status">
              Links to /stories/{record.draft.slug} will stop working. There are no redirects.
            </p>
          )}
        </>
      )}
      {taken && (
        <p className="studio-warn" role="alert">
          Another story already uses this address.
        </p>
      )}
      {invalid && (
        <p className="studio-warn" role="alert">
          Use lowercase letters, numbers and single hyphens.
        </p>
      )}
      <div className="studio-snippet" aria-label="Search and social preview">
        {draft.heroImage && (
          <Image
            unoptimized
            src={draft.heroImage.url}
            alt=""
            width={96}
            height={96}
            className="studio-snippet__thumb"
          />
        )}
        <div>
          <p className="studio-snippet__url">
            {SITE}/stories/{draft.slug}
          </p>
          <p className="studio-snippet__title">{truncate(draft.title || 'Untitled story', 60)}</p>
          <p className="studio-snippet__summary">{truncate(draft.summary, 160)}</p>
        </div>
      </div>
      <ChoiceField
        label="Format"
        value={draft.format}
        options={[
          { id: 'entry', label: 'Entry' },
          { id: 'chapter', label: 'Chapter' },
        ]}
        onChange={(value) => patch('format', value as StoryDraft['format'])}
        disabled={!editable}
      />
      <TextField
        label="Publication date (YYYY-MM-DD)"
        value={draft.publishedAt}
        onChange={(value) => patch('publishedAt', value)}
        disabled={!editable}
      />
      <TextField
        label="Correction date (optional)"
        value={draft.updatedAt ?? ''}
        onChange={(value) => patch('updatedAt', value || undefined)}
        disabled={!editable}
      />
    </>
  );
}

export function StudioMargin(props: MarginProps) {
  const {
    draft,
    patch,
    record,
    revision,
    editable,
    busy,
    dirty,
    canReview,
    canManage,
    sections,
    onToggleSection,
    readiness,
    onShow,
  } = props;
  const sourcesRef = useRef<HTMLDivElement>(null);
  const { focusSource, clearFocusSource } = props;
  useEffect(() => {
    if (focusSource === null) return;
    const field = sourcesRef.current?.querySelector<HTMLElement>(
      `[data-source-index="${focusSource}"] input`,
    );
    if (field) {
      field.scrollIntoView({ block: 'center' });
      field.focus();
      clearFocusSource();
    }
  });
  const section = (id: SectionId, title: string, children: React.ReactNode, note?: string) => (
    <Section id={id} title={title} open={sections[id]} onToggle={onToggleSection} note={note}>
      {children}
    </Section>
  );
  const setReference = (index: number, next: Partial<StoryDraft['references'][number]>) =>
    patch(
      'references',
      draft.references.map((ref, i) => (i === index ? { ...ref, ...next } : ref)),
    );
  return (
    <div className="studio-margin" aria-label="Story details">
      {section(
        'readiness',
        'Readiness',
        <>
          {readiness.length ? (
            <ul className="studio-issues">
              {readiness.map((item) => (
                <li key={item.key}>
                  <span>{item.text}</span>
                  {item.target && (
                    <button
                      type="button"
                      className="studio-btn studio-btn--small"
                      onClick={() => onShow(item.target!)}
                    >
                      Show
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="studio-ready">Ready for review.</p>
          )}
          <p>
            {dirty
              ? 'Save the current edits before review.'
              : `Review applies to saved revision ${revision}.`}
          </p>
          <p>Latest decision: {record.review?.decision ?? 'Not reviewed'}</p>
          {canReview && (
            <>
              <TextAreaField
                label="Reason for changes or review"
                value={props.reason}
                onChange={props.setReason}
              />
              {(['facts', 'rights', 'prose'] as const).map((key) => (
                <Checkbox
                  key={key}
                  checked={props.checks[key]}
                  disabled={busy || dirty || !revision}
                  onChange={(event) =>
                    props.setChecks({ ...props.checks, [key]: event.currentTarget.checked })
                  }
                >
                  {key === 'facts'
                    ? 'Every factual sentence and evidence qualifier checked'
                    : key === 'rights'
                      ? 'Media and quotation rights checked'
                      : 'Final prose, credits and dignity reviewed'}
                </Checkbox>
              ))}
              <div className="admin-base-actions">
                <Button
                  kind="secondary"
                  disabled={
                    busy ||
                    dirty ||
                    !revision ||
                    !props.checks.facts ||
                    !props.checks.rights ||
                    !props.checks.prose ||
                    !props.reason.trim() ||
                    !!record.blockers?.length
                  }
                  onClick={() => void props.decide('approved')}
                >
                  Approve revision
                </Button>
                <Button
                  kind="tertiary"
                  disabled={busy || dirty || !revision}
                  onClick={() => void props.decide('needs_evidence')}
                >
                  Needs evidence
                </Button>
                <Button
                  kind="tertiary"
                  disabled={busy || dirty || !revision}
                  onClick={() => void props.decide('rejected')}
                >
                  Reject
                </Button>
              </div>
              <Button
                disabled={
                  busy ||
                  dirty ||
                  record.review?.decision !== 'approved' ||
                  record.revision !== revision
                }
                isLoading={busy}
                onClick={() => void props.publish()}
              >
                Publish approved revision
              </Button>
            </>
          )}
          {record.publication && (
            <div className="studio-group">
              <h3>Publication history</h3>
              <p>Last published revision {record.publication.revision}</p>
              {record.activePublicReleaseId ? (
                <Link href={`/stories/${draft.slug}`} target="_blank">
                  Open public story
                </Link>
              ) : (
                <p>No current public story.</p>
              )}
              {canReview && record.publication.canRollback && (
                <Button
                  kind="secondary"
                  disabled={busy || dirty || !props.reason.trim()}
                  onClick={() => void props.rollback()}
                >
                  Restore previous public story
                </Button>
              )}
            </div>
          )}
          <p className="studio-hint">
            Publication creates a signed release. A failed operation leaves the public version
            intact.
          </p>
        </>,
        readiness.length ? `${readiness.length} to fix` : 'Clear',
      )}
      {section('address', 'Address and format', <AddressSection {...props} />)}
      {section(
        'topics',
        'Topics',
        <>
          <ChoiceField
            label="Theme"
            value={draft.themeId ?? ''}
            options={[
              { id: '', label: 'No theme' },
              ...STORY_THEME_IDS.map((id) => ({ id, label: humanize(id) })),
            ]}
            onChange={(value) =>
              patch('themeId', value ? (value as StoryDraft['themeId']) : undefined)
            }
            disabled={!editable}
          />
          <TagEditor
            draft={draft}
            patch={patch}
            editable={editable}
            tagsInUse={props.tagsInUse}
            suggestions={props.suggestions}
            onDismiss={props.onDismissSuggestion}
          />
        </>,
      )}
      {section(
        'credits',
        'Byline and credits',
        <>
          <p>Credits belong to this revision. Neo is the house editorial identity.</p>
          {draft.contributors.map((credit, index) => (
            <div className="studio-group" key={credit.id}>
              <h3>
                {index + 1}. {credit.name}
              </h3>
              <RoleToggles
                credit={credit}
                disabled={!editable}
                onToggle={(role) =>
                  patch('contributors', toggleRole(draft.contributors, credit.id, role))
                }
              />
              <div className="admin-base-actions">
                <Button
                  kind="tertiary"
                  size="compact"
                  disabled={!editable || index === 0}
                  onClick={() =>
                    patch('contributors', moveCredit(draft.contributors, credit.id, -1))
                  }
                >
                  Move up
                </Button>
                <Button
                  kind="tertiary"
                  size="compact"
                  disabled={!editable || index === draft.contributors.length - 1}
                  onClick={() =>
                    patch('contributors', moveCredit(draft.contributors, credit.id, 1))
                  }
                >
                  Move down
                </Button>
                <Button
                  kind="tertiary"
                  size="compact"
                  disabled={!editable}
                  onClick={() =>
                    patch(
                      'contributors',
                      draft.contributors.filter((c) => c.id !== credit.id),
                    )
                  }
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
          <Select
            aria-label="Add contributor"
            placeholder="Add contributor"
            value={[]}
            clearable={false}
            disabled={!editable}
            options={props.profiles
              .filter((profile) => !draft.contributors.some((c) => c.id === profile.id))
              .map((profile) => ({
                id: profile.id,
                label: profile.linkedToMe ? `${profile.name} (You)` : profile.name,
              }))}
            onChange={({ value }) => {
              const profile = props.profiles.find((p) => p.id === value[0]?.id);
              if (profile)
                patch('contributors', [
                  ...draft.contributors,
                  { id: profile.id, name: profile.name, kind: profile.kind, roles: ['author'] },
                ]);
            }}
          />
          <p>
            <Link href="/admin/stories/contributors" target="_blank">
              Manage people &amp; bylines
            </Link>
          </p>
        </>,
      )}
      {section(
        'sources',
        'Sources',
        <div ref={sourcesRef}>
          <p>Attach the sources supporting the prose. Insert citations from the writing toolbar.</p>
          {props.selectedBlock !== null && draft.body[props.selectedBlock] && (
            <div className="studio-group">
              <h3>Selected block</h3>
              <BlockEditor
                disabled={!editable || busy}
                block={draft.body[props.selectedBlock]!}
                index={props.selectedBlock}
                onChange={(block) =>
                  patch(
                    'body',
                    draft.body.map((b, i) => (i === props.selectedBlock ? block : b)),
                  )
                }
                // The studio follows the moved block to its new index (followSelectedBlock).
                move={(delta) => props.moveBlock(props.selectedBlock!, delta)}
                remove={() => {
                  patch(
                    'body',
                    draft.body.filter((_, i) => i !== props.selectedBlock),
                  );
                  props.setSelectedBlock(() => null);
                }}
              />
              {draft.body[props.selectedBlock]!.type === 'image' && (
                <div>
                  <p>Upload an image for this block after adding its credit and rights above.</p>
                  <FileUploader
                    accept="image/png,image/jpeg,image/webp"
                    maxSize={5242880}
                    multiple={false}
                    disabled={
                      !editable ||
                      busy ||
                      !revision ||
                      !(
                        draft.body[props.selectedBlock] as Extract<
                          StoryBodyBlockDoc,
                          { type: 'image' }
                        >
                      ).image.credit.trim()
                    }
                    onDrop={(files) => {
                      const target = draft.body[props.selectedBlock!];
                      if (files[0] && target?.type === 'image')
                        props.uploadBlockImage(files[0], target);
                    }}
                    onDropRejected={() =>
                      props.onProblem('Choose a PNG, JPEG or WebP image up to 5 MB.')
                    }
                  />
                </div>
              )}
            </div>
          )}
          {draft.references.map((reference, index) => (
            <div className="studio-group" key={index} data-source-index={index}>
              <h3>Source {index + 1}</h3>
              {(['id', 'label', 'url', 'locator'] as const).map((key) => (
                <TextField
                  key={key}
                  label={
                    key === 'id'
                      ? 'Citation ID'
                      : key === 'label'
                        ? 'Source title'
                        : key === 'url'
                          ? 'Source URL'
                          : 'Page or locator'
                  }
                  value={reference[key] ?? ''}
                  onChange={(value) => setReference(index, { [key]: value })}
                  disabled={!editable}
                />
              ))}
              {reference.scholarlyCitation && (
                <>
                  <h4>Scholarly citation</h4>
                  {(['doi', 'title', 'firstAuthorSurname', 'venue'] as const).map((key) => (
                    <TextField
                      key={key}
                      label={key}
                      value={reference.scholarlyCitation?.[key] ?? ''}
                      onChange={(value) =>
                        setReference(index, {
                          scholarlyCitation: { ...reference.scholarlyCitation!, [key]: value },
                        })
                      }
                      disabled={!editable}
                    />
                  ))}
                  <Button
                    kind="tertiary"
                    onClick={() => setReference(index, { scholarlyCitation: undefined })}
                    disabled={!editable}
                  >
                    Remove scholarly details
                  </Button>
                </>
              )}
              {!reference.scholarlyCitation && (
                <Button
                  kind="tertiary"
                  onClick={() =>
                    setReference(index, {
                      scholarlyCitation: { doi: '', title: '', firstAuthorSurname: '', venue: '' },
                    })
                  }
                  disabled={!editable}
                >
                  Add scholarly details
                </Button>
              )}
              <Button
                kind="tertiary"
                onClick={() =>
                  patch(
                    'references',
                    draft.references.filter((_, i) => i !== index),
                  )
                }
                disabled={!editable}
              >
                Remove source
              </Button>
            </div>
          ))}
          <Button kind="secondary" onClick={props.addReference} disabled={!editable}>
            Add source
          </Button>
          <p>
            <Link href="/admin/sources" target="_blank">
              Open source library
            </Link>
          </p>
        </div>,
        draft.references.length ? String(draft.references.length) : undefined,
      )}
      {section(
        'records',
        'Linked records',
        <>
          <p>Editorial associations are separate from historical relationships.</p>
          {draft.relatedEntityIds.map((id) => (
            <div key={id} className="studio-group">
              <Link href={`/admin/catalog/${encodeURIComponent(id)}`} target="_blank">
                {props.recordLabels[id] ?? id}
              </Link>
              <Button
                kind="tertiary"
                size="compact"
                disabled={!editable}
                onClick={() =>
                  patch(
                    'relatedEntityIds',
                    draft.relatedEntityIds.filter((other) => other !== id),
                  )
                }
              >
                Unlink
              </Button>
            </div>
          ))}
          <AdminRecordPicker
            label="Link an existing record"
            disabled={!editable}
            onSelect={(entity) =>
              props.onLinkRecords([{ id: entity.id, label: entity.display_name }])
            }
          />
          {props.mentionedUnlinked.length > 0 && (
            <div className="studio-group">
              <h3>Mentioned in the text but not listed as related</h3>
              <ul className="studio-issues">
                {props.mentionedUnlinked.map((record) => (
                  <li key={record.id}>
                    <span>{record.label}</span>
                    <button
                      type="button"
                      className="studio-btn studio-btn--small"
                      disabled={!editable}
                      onClick={() => props.onLinkRecords([record])}
                    >
                      Add
                    </button>
                  </li>
                ))}
              </ul>
              {props.mentionedUnlinked.length > 1 && (
                <button
                  type="button"
                  className="studio-btn studio-btn--small"
                  disabled={!editable}
                  onClick={() => props.onLinkRecords(props.mentionedUnlinked)}
                >
                  Add all
                </button>
              )}
            </div>
          )}
          <p>
            <Link href="/admin/quick-add" target="_blank">
              Propose a new record
            </Link>
          </p>
        </>,
      )}
      {section(
        'collection',
        'Collection',
        draft.collection ? (
          <>
            {(['id', 'label', 'positionLabel'] as const).map((key) => (
              <TextField
                key={key}
                label={`Collection ${key}`}
                value={draft.collection?.[key] ?? ''}
                onChange={(value) =>
                  patch('collection', { ...draft.collection!, [key]: value || undefined })
                }
                disabled={!editable}
              />
            ))}
            <TextField
              label="Collection position"
              type="number"
              min={0}
              value={String(draft.collection.position)}
              onChange={(value) =>
                patch('collection', { ...draft.collection!, position: Number(value) })
              }
              disabled={!editable}
            />
            <Button
              kind="tertiary"
              onClick={() => patch('collection', undefined)}
              disabled={!editable}
            >
              Remove collection
            </Button>
          </>
        ) : (
          <Button
            kind="secondary"
            onClick={() => patch('collection', { id: 'new-collection', label: '', position: 0 })}
            disabled={!editable}
          >
            Add to collection
          </Button>
        ),
      )}
      {section(
        'history',
        'History',
        <>
          <p>
            Restoring creates a new draft. Public content stays unchanged until review and
            publication.
          </p>
          {record.history.map((history) => (
            <div key={history.revision} className="studio-group">
              <h3>Revision {history.revision}</h3>
              <p>{new Date(history.createdAt).toLocaleString()}</p>
              <p>{history.reason}</p>
              <Button
                kind="secondary"
                size="compact"
                disabled={!editable || busy || dirty}
                onClick={() => void props.restore(history.revision)}
              >
                Restore revision {history.revision}
              </Button>
            </div>
          ))}
        </>,
      )}
      {!!revision &&
        section(
          'archive',
          record.archivedAt ? 'Archived story' : 'Archive',
          <>
            <p>
              {record.archivedAt
                ? 'Restore this story to edit it. Its history is preserved.'
                : record.activePublicReleaseId
                  ? 'Archiving removes this story from public stories in a new signed release. Saved revisions remain available.'
                  : 'Remove this draft from the active library. You can restore it from Archived stories.'}
            </p>
            {!canManage && (
              <p>
                Your role cannot change this story’s library state. Removing a public story requires
                publication authority.
              </p>
            )}
            <TextAreaField
              label="Reason for library change"
              value={props.archiveReason}
              onChange={props.setArchiveReason}
              disabled={busy}
              rows={2}
            />
            {record.activePublicReleaseId && !record.archivedAt && (
              <Checkbox
                checked={props.archiveConfirmed}
                onChange={(event) => props.setArchiveConfirmed(event.currentTarget.checked)}
                disabled={busy}
              >
                Remove the current public story
              </Checkbox>
            )}
            <Button
              kind="secondary"
              disabled={
                busy ||
                dirty ||
                !props.archiveReason.trim() ||
                !canManage ||
                (!!record.activePublicReleaseId && !props.archiveConfirmed)
              }
              onClick={() => void props.manageArchive()}
            >
              {record.archivedAt ? 'Restore to drafts' : 'Archive story'}
            </Button>
          </>,
        )}
    </div>
  );
}

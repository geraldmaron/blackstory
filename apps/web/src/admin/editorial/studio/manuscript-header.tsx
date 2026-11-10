'use client';
/**
 * The top of the manuscript, in the order a reader meets it on the public page: cover, period and
 * place, title, summary, byline. Every field is a plain input styled as text.
 */
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faImage, faPlus } from '@fortawesome/free-solid-svg-icons';
import type { EditorialContributor, StoryDraft } from '@repo/schemas';
import { storyBylineLines } from '@/lib/stories/byline';
import { CREDIT_ROLES, ROLE_LABELS, moveCredit, toggleRole } from './credits';

export type Patch = <K extends keyof StoryDraft>(key: K, value: StoryDraft[K]) => void;
export type StudioProfile = EditorialContributor & { linkedToMe?: boolean };

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp'];
export const RIGHTS: readonly { id: string; label: string }[] = [
  { id: 'public_domain', label: 'Public domain' },
  { id: 'licensed', label: 'Licensed' },
  { id: 'fair_use', label: 'Fair use' },
];

/** A borderless textarea that grows with its text and shows a counter near its limit. */
function AutoText({
  id,
  label,
  value,
  onChange,
  placeholder,
  max,
  className,
  disabled,
  onEnter,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  max: number;
  className: string;
  disabled: boolean;
  onEnter?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const fit = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  useLayoutEffect(fit, [value]);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    let width = el.clientWidth;
    const observer = new ResizeObserver(() => {
      if (el.clientWidth !== width) {
        width = el.clientWidth;
        fit();
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="studio-text">
      <label htmlFor={id} className="studio-visually-hidden">
        {label}
      </label>
      <textarea
        id={id}
        ref={ref}
        rows={1}
        className={className}
        value={value}
        placeholder={placeholder}
        maxLength={max}
        disabled={disabled}
        onChange={(event) => onChange(event.currentTarget.value.replace(/\s*\n\s*/g, ' '))}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            onEnter?.();
          }
        }}
      />
      {max - value.length <= 20 && (
        <span className="studio-count" role="status">
          {value.length} of {max}
        </span>
      )}
    </div>
  );
}

function CoverBlock({
  draft,
  patch,
  editable,
  busy,
  credit,
  rights,
  setCredit,
  setRights,
  onUpload,
  onProblem,
}: {
  draft: StoryDraft;
  patch: Patch;
  editable: boolean;
  busy: boolean;
  credit: string;
  rights: string;
  setCredit: (value: string) => void;
  setRights: (value: string) => void;
  onUpload: (file: File) => Promise<boolean>;
  onProblem: (message: string) => void;
}) {
  const hero = draft.heroImage;
  const [pending, setPending] = useState<{ file: File; url: string } | null>(null);
  const [note, setNote] = useState('');
  const [over, setOver] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  useEffect(() => () => void (pending && URL.revokeObjectURL(pending.url)), [pending]);

  function choose(file: File | undefined | null) {
    if (!file || !editable) return;
    if (!ACCEPTED.includes(file.type) || file.size > 5242880) {
      onProblem('Choose a PNG, JPEG or WebP image up to 5 MB.');
      return;
    }
    if (hero) {
      setCredit(hero.credit);
      setRights(hero.rightsStatus);
    }
    setPending({ file, url: URL.createObjectURL(file) });
  }
  // A pasted image lands on the cover only when the cursor is not in a field or the body.
  useEffect(() => {
    if (hero || pending || !editable) return;
    const paste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, [contenteditable="true"]')) return;
      const file = [...(event.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) choose(file);
    };
    window.addEventListener('paste', paste);
    return () => window.removeEventListener('paste', paste);
    // choose reads only props that this effect already depends on.
  }, [hero, pending, editable]);

  async function upload() {
    if (!pending) return;
    setNote('Saving the story first…');
    const ok = await onUpload(pending.file);
    setNote('');
    if (ok) {
      setPending(null);
      requestAnimationFrame(() => document.getElementById('studio-cover-alt')?.focus());
    }
  }

  const input = (
    <input
      ref={picker}
      type="file"
      accept={ACCEPTED.join(',')}
      className="studio-visually-hidden"
      tabIndex={-1}
      aria-label="Choose a cover image file"
      onChange={(event) => {
        choose(event.currentTarget.files?.[0]);
        event.currentTarget.value = '';
      }}
    />
  );

  if (pending)
    return (
      <section className="studio-cover" aria-label="Cover image">
        <Image
          unoptimized
          src={pending.url}
          alt="Preview of the chosen image"
          width={1200}
          height={675}
          className="studio-cover__image"
        />
        <div className="studio-cover__fields">
          <label>
            <span>Credit (required)</span>
            <input value={credit} onChange={(e) => setCredit(e.currentTarget.value)} />
          </label>
          <label>
            <span>Rights (required)</span>
            <select value={rights} onChange={(e) => setRights(e.currentTarget.value)}>
              <option value="">Choose rights</option>
              {RIGHTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <div className="studio-cover__actions">
            <button
              type="button"
              className="studio-btn studio-btn--solid"
              disabled={busy || !credit.trim() || !rights}
              onClick={() => void upload()}
            >
              Upload
            </button>
            <button
              type="button"
              className="studio-btn"
              disabled={busy}
              onClick={() => setPending(null)}
            >
              Cancel
            </button>
          </div>
          <p className="studio-hint" role="status">
            {note || 'Uploads stay private until publication.'}
          </p>
        </div>
      </section>
    );

  if (hero)
    return (
      <section className="studio-cover studio-cover--set" aria-label="Cover image">
        <Image
          unoptimized
          src={hero.url}
          alt={hero.alt || 'Cover image, description needed'}
          width={hero.width ?? 1200}
          height={hero.height ?? 675}
          className="studio-cover__image"
        />
        <div className="studio-cover__line">
          <label className="studio-cover__alt">
            <span className="studio-visually-hidden">Image description</span>
            <input
              id="studio-cover-alt"
              value={hero.alt}
              placeholder="Image description"
              aria-describedby="studio-cover-alt-help"
              disabled={!editable}
              onChange={(e) => patch('heroImage', { ...hero, alt: e.currentTarget.value })}
            />
          </label>
          <label>
            <span className="studio-visually-hidden">Image credit</span>
            <input
              id="studio-cover-credit"
              value={hero.credit}
              placeholder="Credit"
              disabled={!editable}
              onChange={(e) => patch('heroImage', { ...hero, credit: e.currentTarget.value })}
            />
          </label>
          <label>
            <span className="studio-visually-hidden">Image rights</span>
            <select
              value={hero.rightsStatus}
              disabled={!editable}
              onChange={(e) =>
                patch('heroImage', {
                  ...hero,
                  rightsStatus: e.currentTarget.value as typeof hero.rightsStatus,
                })
              }
            >
              {RIGHTS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <span className="studio-cover__buttons">
            <button
              type="button"
              className="studio-btn studio-btn--small"
              disabled={!editable}
              onClick={() => picker.current?.click()}
            >
              Replace
            </button>
            <button
              type="button"
              className="studio-btn studio-btn--small"
              disabled={!editable}
              onClick={() => patch('heroImage', undefined)}
            >
              Remove
            </button>
          </span>
        </div>
        <p id="studio-cover-alt-help" className="studio-hint">
          Describe it for someone who cannot see it.
        </p>
        {input}
      </section>
    );

  return (
    <section
      className="studio-cover studio-cover--empty"
      aria-label="Cover image"
      data-over={over}
      onDragOver={(event) => {
        if (!editable) return;
        event.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        choose(event.dataTransfer.files[0]);
      }}
    >
      <button
        type="button"
        className="studio-btn"
        disabled={!editable}
        onClick={() => picker.current?.click()}
      >
        <FontAwesomeIcon icon={faImage} aria-hidden="true" /> Add a cover image
      </button>
      <p className="studio-hint">or drop or paste an image</p>
      {input}
    </section>
  );
}

function Byline({
  draft,
  patch,
  editable,
  profiles,
}: {
  draft: StoryDraft;
  patch: Patch;
  editable: boolean;
  profiles: readonly StudioProfile[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [query, setQuery] = useState('');
  const root = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const credits = draft.contributors;
  const open = openId !== null || adding;
  useEffect(() => {
    if (!open) return;
    const close = () => {
      setOpenId(null);
      setAdding(false);
      setQuery('');
    };
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close();
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [open]);
  useEffect(() => {
    if (adding) search.current?.focus();
  }, [adding]);

  const available = profiles
    .filter((p) => !credits.some((c) => c.id === p.id))
    .filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase()))
    .sort(
      (a, b) => Number(!!b.linkedToMe) - Number(!!a.linkedToMe) || a.name.localeCompare(b.name),
    );

  return (
    <div className="studio-byline" id="studio-byline" tabIndex={-1} ref={root}>
      <div className="studio-byline__row">
        <span className="studio-byline__by">By</span>
        <ul className="studio-chips">
          {credits.map((credit, index) => (
            <li key={credit.id} className="studio-chip-wrap">
              <button
                type="button"
                className="studio-chip"
                aria-haspopup="true"
                aria-expanded={openId === credit.id}
                onClick={() => {
                  setAdding(false);
                  setOpenId(openId === credit.id ? null : credit.id);
                }}
              >
                {credit.name}
              </button>
              {openId === credit.id && (
                <div
                  className="studio-popover"
                  role="group"
                  aria-label={`Credit for ${credit.name}`}
                >
                  {CREDIT_ROLES.map((role) => (
                    <label key={role} className="studio-check">
                      <input
                        type="checkbox"
                        checked={credit.roles.includes(role)}
                        disabled={!editable}
                        onChange={() => patch('contributors', toggleRole(credits, credit.id, role))}
                      />
                      {ROLE_LABELS[role]}
                    </label>
                  ))}
                  <div className="studio-popover__actions">
                    <button
                      type="button"
                      className="studio-btn studio-btn--small"
                      disabled={!editable || index === 0}
                      onClick={() => patch('contributors', moveCredit(credits, credit.id, -1))}
                    >
                      Move earlier
                    </button>
                    <button
                      type="button"
                      className="studio-btn studio-btn--small"
                      disabled={!editable || index === credits.length - 1}
                      onClick={() => patch('contributors', moveCredit(credits, credit.id, 1))}
                    >
                      Move later
                    </button>
                    <button
                      type="button"
                      className="studio-btn studio-btn--small"
                      disabled={!editable}
                      onClick={() => {
                        patch(
                          'contributors',
                          credits.filter((c) => c.id !== credit.id),
                        );
                        setOpenId(null);
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
          {editable && (
            <li className="studio-chip-wrap">
              <button
                type="button"
                className="studio-chip studio-chip--add"
                aria-haspopup="true"
                aria-expanded={adding}
                onClick={() => {
                  setOpenId(null);
                  setAdding(!adding);
                }}
              >
                <FontAwesomeIcon icon={faPlus} aria-hidden="true" /> Add
              </button>
              {adding && (
                <div className="studio-popover" role="group" aria-label="Add a person">
                  <input
                    ref={search}
                    className="studio-popover__search"
                    aria-label="Search people"
                    placeholder="Search people"
                    value={query}
                    onChange={(e) => setQuery(e.currentTarget.value)}
                  />
                  <ul className="studio-popover__list">
                    {available.map((profile) => (
                      <li key={profile.id}>
                        <button
                          type="button"
                          onClick={() => {
                            patch('contributors', [
                              ...credits,
                              {
                                id: profile.id,
                                name: profile.name,
                                kind: profile.kind,
                                roles: ['author'],
                              },
                            ]);
                            setAdding(false);
                            setQuery('');
                          }}
                        >
                          {profile.name}
                          {profile.linkedToMe && <span className="studio-you">You</span>}
                        </button>
                      </li>
                    ))}
                    {!available.length && <li className="studio-hint">No one else to add.</li>}
                  </ul>
                  <Link href="/admin/stories/contributors" target="_blank">
                    Manage people &amp; bylines
                  </Link>
                </div>
              )}
            </li>
          )}
        </ul>
      </div>
      <p className="studio-byline__preview" aria-label="Byline as published">
        {storyBylineLines(credits).join(' · ')}
      </p>
    </div>
  );
}

export function ManuscriptHeader({
  draft,
  patch,
  editable,
  busy,
  profiles,
  credit,
  rights,
  setCredit,
  setRights,
  onUploadCover,
  onProblem,
}: {
  draft: StoryDraft;
  patch: Patch;
  editable: boolean;
  busy: boolean;
  profiles: readonly StudioProfile[];
  credit: string;
  rights: string;
  setCredit: (value: string) => void;
  setRights: (value: string) => void;
  onUploadCover: (file: File) => Promise<boolean>;
  onProblem: (message: string) => void;
}) {
  return (
    <div className="studio-header">
      <CoverBlock
        draft={draft}
        patch={patch}
        editable={editable}
        busy={busy}
        credit={credit}
        rights={rights}
        setCredit={setCredit}
        setRights={setRights}
        onUpload={onUploadCover}
        onProblem={onProblem}
      />
      <p className="studio-facts">
        <label>
          <span className="studio-visually-hidden">Period</span>
          <input
            id="studio-era"
            className="studio-facts__era"
            value={draft.eraLabel}
            placeholder="Period"
            maxLength={80}
            disabled={!editable}
            onChange={(e) => patch('eraLabel', e.currentTarget.value)}
          />
        </label>
        <span aria-hidden="true">·</span>
        <label>
          <span className="studio-visually-hidden">Place</span>
          <input
            id="studio-place"
            value={draft.placeLabel}
            placeholder="Place"
            maxLength={120}
            disabled={!editable}
            onChange={(e) => patch('placeLabel', e.currentTarget.value)}
          />
        </label>
      </p>
      <AutoText
        id="studio-title"
        label="Title"
        className="studio-title"
        value={draft.title}
        placeholder="Title"
        max={160}
        disabled={!editable}
        onChange={(value) => patch('title', value)}
        onEnter={() => document.getElementById('studio-summary')?.focus()}
      />
      <AutoText
        id="studio-summary"
        label="Summary"
        className="studio-summary"
        value={draft.summary}
        placeholder="The summary readers see first and in search results"
        max={600}
        disabled={!editable}
        onChange={(value) => patch('summary', value)}
      />
      <Byline draft={draft} patch={patch} editable={editable} profiles={profiles} />
    </div>
  );
}

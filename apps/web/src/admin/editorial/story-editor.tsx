'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button } from 'baseui/button';
import { Drawer } from 'baseui/drawer';
import { Notification } from 'baseui/notification';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faDownLeftAndUpRightToCenter,
  faUpRightAndDownLeftFromCenter,
} from '@fortawesome/free-solid-svg-icons';
import { RichDocument } from './rich-document';
import type { StoryDraft, EditorialStory, StoryBodyBlockDoc } from '@repo/schemas';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { staffRoleHasPermission } from '../auth/staff-permissions';
import { newBlock } from './block-editor';
import { followSelectedBlock } from './studio/follow-block';
import { ManuscriptFront, type StudioProfile } from './studio/manuscript-header';
import { StudioMargin } from './studio/margin';
import { PreviewPane } from './studio/preview-pane';
import { useMedia, useNow, useRecordMeta, useStoredState } from './studio/hooks';
import {
  readinessItems,
  type BodyIssue,
  type SectionId,
  type ShowTarget,
} from './studio/readiness';
import { slugifyTitle, uniqueSlug } from './studio/slug';
import { mentionedRecordIds, suggestTags } from './studio/tag-suggestions';

const DEFAULT_SECTIONS: Record<SectionId, boolean> = {
  readiness: true,
  address: true,
  topics: false,
  credits: false,
  sources: false,
  records: false,
  collection: false,
  history: false,
  archive: false,
};
const STATUS_WORDS: Record<string, string> = {
  draft: 'Draft',
  review: 'In review',
  published: 'Published',
  archived: 'Archived',
};
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function relativeTime(from: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - from) / 1000));
  if (seconds < 45) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} hour${hours === 1 ? '' : 's'} ago`;
}

export function StoryEditor({
  initial,
  profiles,
  relatedRecords = [],
  otherStories = [],
  tagsInUse = [],
}: {
  initial: EditorialStory;
  profiles: StudioProfile[];
  relatedRecords: readonly { id: string; display_name: string }[];
  /** Addresses of every other story, for the uniqueness check. */
  otherStories?: readonly string[];
  /** Tags already used across stories, offered as the writer types. */
  tagsInUse?: readonly string[];
}) {
  const { getIdToken, user, role, ready } = useAdminAuth();
  const router = useRouter();
  const [record, setRecord] = useState(initial);
  const [draft, setDraft] = useState(initial.draft),
    [revision, setRevision] = useState(initial.revision),
    [saved, setSaved] = useState(JSON.stringify(initial.draft));
  const [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [suspended, setSuspended] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null),
    [reason, setReason] = useState('Edit story draft'),
    [checks, setChecks] = useState({ facts: false, rights: false, prose: false });
  const [uploadCredit, setUploadCredit] = useState(''),
    [uploadRights, setUploadRights] = useState('');
  const [archiveReason, setArchiveReason] = useState(''),
    [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const [recordLabels, setRecordLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(relatedRecords.map((entity) => [entity.id, entity.display_name])),
  );
  const saving = useRef(false);
  const latestRevision = useRef(revision);
  latestRevision.current = revision;
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const now = useNow(30_000);
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  // Card moves and removals happen in the body editor; keep the panel on the same block.
  const previousBody = useRef(initial.draft.body);
  // Set when the studio inserts a block and selects it in the same update.
  const selectionPlaced = useRef(false);
  useEffect(() => {
    const previous = previousBody.current;
    previousBody.current = draft.body;
    if (selectionPlaced.current) {
      selectionPlaced.current = false;
      return;
    }
    setSelectedBlock((selected) => followSelectedBlock(previous, draft.body, selected));
  }, [draft.body]);
  // Studio layout state. Focus and open sections are remembered across visits.
  const [focus, setFocus] = useStoredState('studio:focus', false);
  const [storedSections, setStoredSections] = useStoredState<Partial<Record<SectionId, boolean>>>(
    'studio:sections',
    {},
  );
  const sections = { ...DEFAULT_SECTIONS, ...storedSections };
  const [previewOn, setPreviewOn] = useState(false),
    [sheetOpen, setSheetOpen] = useState(false),
    [slugTouched, setSlugTouched] = useState(false),
    [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set()),
    [focusSource, setFocusSource] = useState<number | null>(null);
  const [bodyIssues, setBodyIssues] = useState<readonly BodyIssue[]>([]);
  const wide = useMedia('(min-width: 1280px)'),
    narrow = useMedia('(max-width: 1099px)');
  const showSplit = previewOn && wide,
    showPreviewOnly = previewOn && !wide,
    marginAsSheet = narrow || showSplit;
  const editable =
      !record.archivedAt && role !== null && staffRoleHasPermission(role, 'research:write'),
    canReview =
      !record.archivedAt && role !== null && staffRoleHasPermission(role, 'publication:publish');
  const canManage =
    role !== null &&
    staffRoleHasPermission(
      role,
      record.activePublicReleaseId ? 'publication:retract' : 'research:write',
    );
  const serialized = JSON.stringify(draft),
    dirty = serialized !== saved;
  const currentDraft = useRef(draft);
  currentDraft.current = draft;
  const currentSerialized = useRef(serialized);
  currentSerialized.current = serialized;
  const storageKey = user ? `editorial:${user.uid}:${draft.id}` : null;
  async function request(path: string, method: string, body: unknown) {
    const token = await getIdToken();
    if (!token)
      throw new Error('Your session expired. Sign in again; your edits remain in this tab.');
    let response: Response;
    try {
      response = await fetch(path, {
        method,
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    } catch {
      // The browser's own wording ("Failed to fetch") says nothing a writer can act on.
      throw new Error('The archive could not be reached. Check the connection and save again.');
    }
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'The request failed.');
    return data;
  }
  async function refreshRecord() {
    try {
      const token = await getIdToken();
      if (!token) return;
      const response = await fetch(`/admin/api/stories/${draft.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Status refresh failed');
      const latest: EditorialStory = await response.json();
      setRecord(latest);
      // Mutations must also invalidate prefetched library and editor route snapshots.
      router.refresh();
      return latest;
    } catch {
      setError(
        'Your change was saved, but the latest status could not be loaded. Your edits remain here.',
      );
    }
  }
  useEffect(() => {
    if (!storageKey) return;
    try {
      const local = sessionStorage.getItem(storageKey);
      if (local && local !== JSON.stringify(initial.draft)) setRecovery(local);
    } catch {
      /* Browser storage may be disabled. */
    }
  }, [storageKey]);
  useEffect(() => {
    if (!storageKey || !dirty) return;
    try {
      sessionStorage.setItem(storageKey, serialized);
    } catch {
      /* The visible save status remains authoritative. */
    }
  }, [storageKey, dirty, serialized]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function save(): Promise<boolean> {
    if (saving.current || !editable) return false;
    saving.current = true;
    setBusy(true);
    setError('');
    const sent = JSON.stringify(draft);
    try {
      const data = await request(
        revision ? `/admin/api/stories/${draft.id}` : '/admin/api/stories',
        revision ? 'PUT' : 'POST',
        { draft, revision, reason },
      );
      setRevision(data.revision);
      setSaved(sent);
      setSavedAt(Date.now());
      setSuspended(false);
      setMessage(`Saved revision ${data.revision}.`);
      if (storageKey && sessionStorage.getItem(storageKey) === sent)
        sessionStorage.removeItem(storageKey);
      // Updating the address without a route transition keeps keystrokes typed during save.
      window.history.replaceState(null, '', `/admin/stories/${data.slug}`);
      await refreshRecord();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSuspended(true);
      return false;
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  useEffect(() => {
    if (!dirty || !editable || suspended || recovery) return;
    const timeout = setTimeout(() => {
      void save();
    }, 1500);
    return () => clearTimeout(timeout);
  });
  function patch<K extends keyof StoryDraft>(key: K, value: StoryDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage('');
  }
  async function decide(decision: string) {
    setBusy(true);
    setError('');
    try {
      await request(`/admin/api/stories/${draft.id}/review`, 'POST', {
        revision,
        decision,
        reason,
        checks,
      });
      setMessage(`Review recorded for revision ${revision}.`);
      await refreshRecord();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Review failed.');
    } finally {
      setBusy(false);
    }
  }
  async function restore(target: number) {
    const beforeRestore = serialized;
    setBusy(true);
    setError('');
    try {
      await request(`/admin/api/stories/${draft.id}/restore`, 'POST', {
        restoreRevision: target,
        revision,
        reason,
      });
      const latest = await refreshRecord();
      if (latest) {
        setRevision(latest.revision);
        setSaved(JSON.stringify(latest.draft));
        window.history.replaceState(null, '', `/admin/stories/${latest.draft.slug}`);
        if (currentSerialized.current === beforeRestore) {
          setDraft(latest.draft);
          setMessage(`Restored as draft revision ${latest.revision}.`);
        } else {
          setSuspended(true);
          setError(
            'History was restored. Edits you typed during restoration remain here; compare them with the saved revision before saving.',
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Restore failed.');
    } finally {
      setBusy(false);
    }
  }
  async function manageArchive() {
    const before = currentSerialized.current;
    setBusy(true);
    setError('');
    try {
      await request(
        record.archivedAt
          ? `/admin/api/stories/${draft.id}/unarchive`
          : `/admin/api/stories/${draft.id}`,
        record.archivedAt ? 'POST' : 'DELETE',
        {
          revision,
          reason: archiveReason,
          publicReleaseId: record.activePublicReleaseId ?? null,
          confirmed: archiveConfirmed,
        },
      );
      const latest = await refreshRecord();
      if (latest) {
        setRevision(latest.revision);
        setSaved(JSON.stringify(latest.draft));
        if (currentSerialized.current === before) {
          setDraft(latest.draft);
          setMessage(
            latest.archivedAt
              ? 'Story archived. Its revisions remain available.'
              : 'Story restored to drafts. Review is required before publication.',
          );
        } else {
          setSuspended(true);
          setError(
            'The library state changed. Text you typed during the request remains here; compare it with the saved version.',
          );
        }
      }
      setArchiveConfirmed(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'The library change failed.');
    } finally {
      setBusy(false);
    }
  }
  async function upload(
    file: File,
    target?: Extract<StoryBodyBlockDoc, { type: 'image' }>,
  ): Promise<boolean> {
    setBusy(true);
    setError('');
    try {
      const token = await getIdToken(),
        data = new FormData();
      data.set('file', file);
      data.set('credit', target?.image.credit ?? uploadCredit);
      data.set('rights', target?.image.rightsStatus ?? uploadRights);
      const response = await fetch(`/admin/api/stories/${draft.id}/media`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: data,
      });
      const image = await response.json();
      if (!response.ok) throw new Error(image.error);
      if (target) {
        if (!currentDraft.current.body.includes(target))
          throw new Error(
            'The image uploaded privately, but its block changed. Select the block and upload again. Your edits remain here.',
          );
        setDraft((current) => ({
          ...current,
          body: current.body.map((block) =>
            block === target ? { ...target, image: { ...image, alt: target.image.alt } } : block,
          ),
        }));
      } else patch('heroImage', image);
      setMessage('Image uploaded privately. Add its description and save the story.');
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
      return false;
    } finally {
      setBusy(false);
    }
  }
  /** The upload API needs a saved story, so a first cover saves the draft before uploading. */
  async function uploadCover(file: File): Promise<boolean> {
    while (saving.current) await sleep(100);
    if (!latestRevision.current && !(await save())) return false;
    return upload(file);
  }
  async function publish() {
    setBusy(true);
    setError('');
    try {
      const data = await request(`/admin/api/stories/${draft.id}/publish`, 'POST', {
        revision,
        reason,
      });
      setMessage(`Published in release ${data.releaseId}.`);
      await refreshRecord();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Publication failed.');
    } finally {
      setBusy(false);
    }
  }
  async function rollback() {
    setBusy(true);
    setError('');
    try {
      const data = await request(`/admin/api/stories/${draft.id}/rollback`, 'POST', {
        releaseId: record.publication?.releaseId,
        reason,
      });
      setMessage(
        `Previous public story restored in release ${data.releaseId}. The current draft remains available.`,
      );
      await refreshRecord();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Rollback failed.');
    } finally {
      setBusy(false);
    }
  }
  function move(index: number, delta: number) {
    const next = [...draft.body],
      other = index + delta;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other]!, next[index]!];
    patch('body', next);
  }

  // Before the first save the address follows the title; the writer can take it over.
  const taken = useMemo(() => new Set(otherStories), [otherStories]);
  useEffect(() => {
    if (revision || slugTouched || !editable) return;
    const base = uniqueSlug(slugifyTitle(draft.title), taken);
    if (base && base !== draft.slug) setDraft((d) => ({ ...d, slug: base }));
  }, [draft.title, draft.slug, revision, slugTouched, editable, taken]);

  // Records the story links to, by text and by list, drive suggestions and the "mentioned" list.
  const mentioned = useMemo(() => mentionedRecordIds(draft.body), [draft.body]);
  const linkedIds = useMemo(
    () => [...new Set([...mentioned, ...draft.relatedEntityIds])],
    [mentioned, draft.relatedEntityIds],
  );
  const meta = useRecordMeta(linkedIds, getIdToken);
  const suggestions = useMemo(
    () =>
      suggestTags(
        linkedIds.flatMap((id) => (meta[id] ? [meta[id]] : [])),
        { existing: draft.tags, dismissed },
      ),
    [linkedIds, meta, draft.tags, dismissed],
  );
  const mentionedUnlinked = mentioned
    .filter((id) => !draft.relatedEntityIds.includes(id))
    .map((id) => ({ id, label: recordLabels[id] ?? meta[id]?.displayName ?? id }));
  const readiness = useMemo(() => {
    const items = readinessItems(draft, record.blockers, bodyIssues);
    if (taken.has(draft.slug))
      items.push({
        key: 'slug-taken',
        text: 'Another story already uses this address.',
        target: { kind: 'section', section: 'address' },
      });
    return items;
  }, [draft, record.blockers, bodyIssues, taken]);

  // Opening a margin section from anywhere: leave focus mode, open the sheet if the margin is one.
  const openMargin = useCallback(
    (id: SectionId) => {
      setFocus(false);
      if (marginAsSheet) setSheetOpen(true);
      setStoredSections({ ...storedSections, [id]: true });
      setTimeout(
        () =>
          document
            .getElementById(`studio-section-${id}`)
            ?.scrollIntoView({ block: 'start', behavior: motion() }),
        80,
      );
    },
    [marginAsSheet, setFocus, setStoredSections, storedSections],
  );
  function show(target: ShowTarget) {
    if (target.kind === 'section') return openMargin(target.section);
    if (target.kind === 'block') {
      setSelectedBlock(target.index);
      return openMargin('sources');
    }
    setSheetOpen(false);
    if (showPreviewOnly) setPreviewOn(false);
    setTimeout(() => {
      const el = document.getElementById(target.id);
      el?.scrollIntoView({ block: 'center', behavior: motion() });
      el?.focus({ preventScroll: true });
    }, 80);
  }
  function addReference() {
    const taken = new Set(draft.references.map((ref) => ref.id));
    let n = draft.references.length + 1;
    while (taken.has(`source-${n}`)) n += 1;
    patch('references', [...draft.references, { id: `source-${n}`, label: '', url: '' }]);
    setFocusSource(draft.references.length);
    openMargin('sources');
  }
  function linkRecords(items: readonly { id: string; label: string }[]) {
    setRecordLabels((previous) => ({
      ...previous,
      ...Object.fromEntries(items.map((item) => [item.id, item.label])),
    }));
    const add = items.map((i) => i.id).filter((id) => !draft.relatedEntityIds.includes(id));
    if (add.length) patch('relatedEntityIds', [...draft.relatedEntityIds, ...add]);
  }

  // Focus mode hides the admin sidebar through a root attribute that the shell styles read.
  useEffect(() => {
    const root = document.documentElement;
    if (focus) root.dataset.adminFocus = 'true';
    else delete root.dataset.adminFocus;
    return () => {
      delete root.dataset.adminFocus;
    };
  }, [focus]);
  useEffect(() => {
    const keys = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === '.') {
        event.preventDefault();
        setFocus(!focus);
      } else if (event.key === 'Escape' && focus && !event.defaultPrevented) setFocus(false);
    };
    window.addEventListener('keydown', keys);
    return () => window.removeEventListener('keydown', keys);
  }, [focus, setFocus]);

  const wordCount = draft.body
    .flatMap((block) =>
      block.type === 'paragraph' || block.type === 'pullquote'
        ? [block.text]
        : block.type === 'list'
          ? block.items
          : [],
    )
    .join(' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

  const saveState = !editable
    ? null
    : busy
      ? 'Saving…'
      : suspended
        ? 'Not saved'
        : dirty
          ? 'Unsaved changes'
          : revision
            ? 'Saved'
            : 'Nothing to save yet';
  const status = record.archivedAt ? 'Archived' : (STATUS_WORDS[record.status] ?? 'Draft');
  const margin = (
    <StudioMargin
      draft={draft}
      patch={patch}
      record={record}
      revision={revision}
      editable={editable}
      busy={busy}
      dirty={dirty}
      canReview={canReview}
      canManage={canManage}
      profiles={profiles}
      otherStories={otherStories}
      tagsInUse={tagsInUse}
      suggestions={suggestions}
      onDismissSuggestion={(tag) => setDismissed(new Set([...dismissed, tag.toLowerCase()]))}
      readiness={readiness}
      onShow={show}
      sections={sections}
      onToggleSection={(id) => setStoredSections({ ...storedSections, [id]: !sections[id] })}
      onSlugEdit={(value) => {
        setSlugTouched(true);
        patch('slug', value.toLowerCase().replace(/\s+/g, '-'));
      }}
      reason={reason}
      setReason={setReason}
      checks={checks}
      setChecks={setChecks}
      decide={decide}
      publish={publish}
      rollback={rollback}
      restore={restore}
      archiveReason={archiveReason}
      setArchiveReason={setArchiveReason}
      archiveConfirmed={archiveConfirmed}
      setArchiveConfirmed={setArchiveConfirmed}
      manageArchive={manageArchive}
      recordLabels={recordLabels}
      onLinkRecords={linkRecords}
      mentionedUnlinked={mentionedUnlinked}
      selectedBlock={selectedBlock}
      setSelectedBlock={(updater) => setSelectedBlock(updater)}
      moveBlock={move}
      uploadBlockImage={(file, target) => void upload(file, target)}
      onProblem={setError}
      addReference={addReference}
      focusSource={focusSource}
      clearFocusSource={() => setFocusSource(null)}
    />
  );
  const manuscript = (
    <div className="studio-manuscript" aria-label="Story composition">
      <ManuscriptFront
        draft={draft}
        patch={patch}
        editable={editable}
        busy={busy}
        profiles={profiles}
        credit={uploadCredit}
        rights={uploadRights}
        setCredit={setUploadCredit}
        setRights={setUploadRights}
        onUploadCover={uploadCover}
        onProblem={setError}
      />
      <RichDocument
        body={draft.body}
        onChange={(body) => patch('body', body)}
        editable={editable}
        references={draft.references}
        onEditBlock={(index) => {
          setSelectedBlock(index);
          openMargin('sources');
        }}
        onInsertBlock={(type, index) => {
          // Placed after the block the cursor was in; appended when the cursor never was.
          const at = index === null ? draft.body.length : index;
          const next = [...draft.body];
          next.splice(at, 0, newBlock(type));
          selectionPlaced.current = true;
          setSelectedBlock(at);
          patch('body', next);
          openMargin('sources');
        }}
        onError={(message) => {
          setError(message);
          setSuspended(true);
        }}
        onWarning={setMessage}
        onAddReference={addReference}
        onIssues={setBodyIssues}
        onShowIssues={() => openMargin('readiness')}
        onImageFile={(_file, index) => {
          // Uploads need a credit and rights first (the media API refuses without them), so a
          // pasted image becomes an image block whose details ask for both before the upload.
          const next = [...draft.body];
          next.splice(index, 0, newBlock('image'));
          patch('body', next);
          selectionPlaced.current = true;
          setSelectedBlock(index);
          openMargin('sources');
          setMessage(
            'Image block added. Give it a credit and rights in the details, then add the file there to upload it.',
          );
        }}
      />
      <p className="studio-wordcount">
        {wordCount.toLocaleString()} {wordCount === 1 ? 'word' : 'words'} · about{' '}
        {Math.max(1, Math.round(wordCount / 230))} min read · {draft.references.length}{' '}
        {draft.references.length === 1 ? 'source' : 'sources'} · {draft.relatedEntityIds.length}{' '}
        related {draft.relatedEntityIds.length === 1 ? 'record' : 'records'}
      </p>
    </div>
  );
  return (
    <div className="studio" data-focus={focus} data-split={showSplit}>
      <header className="studio-bar">
        <div className="studio-bar__start">
          <Link href="/admin/stories">Stories</Link>
          <span className="studio-bar__status">{status}</span>
        </div>
        <div className="studio-bar__end">
          {saveState ? (
            <p
              className="studio-bar__save"
              role="status"
              aria-live="polite"
              title={
                suspended && error
                  ? error
                  : savedAt
                    ? `Saved ${relativeTime(savedAt, now)}`
                    : undefined
              }
            >
              {saveState}
            </p>
          ) : (
            <p className="studio-bar__save">Read only</p>
          )}
          {marginAsSheet && !focus && (
            <button type="button" className="studio-btn" onClick={() => setSheetOpen(true)}>
              Details
            </button>
          )}
          <button
            type="button"
            className="studio-btn studio-btn--icon"
            aria-pressed={focus}
            aria-label="Focus mode"
            aria-keyshortcuts="Control+. Meta+."
            title="Focus mode (Ctrl or Cmd and period)"
            onClick={() => setFocus(!focus)}
          >
            <FontAwesomeIcon
              icon={focus ? faDownLeftAndUpRightToCenter : faUpRightAndDownLeftFromCenter}
              aria-hidden="true"
            />
          </button>
          <button
            type="button"
            className="studio-btn"
            aria-pressed={previewOn}
            onClick={() => setPreviewOn(!previewOn)}
          >
            Preview
          </button>
          {editable && (
            <button
              type="button"
              className="studio-btn studio-btn--solid"
              onClick={() => openMargin('readiness')}
            >
              Publish…
            </button>
          )}
        </div>
      </header>
      <div className="studio-notices">
        {record.archivedAt && (
          <p role="status" className="studio-notice">
            Archived story. Restore it from the Archive section to resume editing.
          </p>
        )}
        {ready && !user && (
          <Notification closeable={false}>
            Your session ended.{' '}
            <Link href="/admin/login" target="_blank">
              Sign in again
            </Link>{' '}
            to continue. Your edits remain in this tab.
          </Notification>
        )}
        {error && (
          <div role="alert">
            <Notification closeable={false}>
              {error} Your edits remain here.
              {suspended && (
                <Button kind="tertiary" href={`/admin/stories/${draft.id}`} target="_blank">
                  Compare saved version
                </Button>
              )}
            </Notification>
          </div>
        )}
        {message && (
          <p role="status" className="studio-notice">
            {message}
          </p>
        )}
        {recovery && (
          <section className="studio-notice studio-recovery" aria-label="Recover edits">
            <h2>Recover your work</h2>
            <p>This tab has unsaved edits from an earlier session.</p>
            <div className="admin-base-actions">
              <Button
                onClick={() => {
                  try {
                    setDraft(JSON.parse(recovery));
                    setRecovery(null);
                  } catch {
                    setError('The recovery copy could not be read.');
                  }
                }}
              >
                Recover my edits
              </Button>
              <Button
                kind="secondary"
                onClick={() => {
                  setRecovery(null);
                  if (storageKey) sessionStorage.removeItem(storageKey);
                }}
              >
                Use saved version
              </Button>
            </div>
          </section>
        )}
      </div>
      <div className="studio-body" data-margin={!marginAsSheet && !focus}>
        {!showPreviewOnly && manuscript}
        {previewOn && (
          <PreviewPane slug={record.draft.slug} revision={revision} pending={dirty || busy} />
        )}
        {!marginAsSheet && !focus && <aside className="studio-aside">{margin}</aside>}
      </div>
      {marginAsSheet && (
        <Drawer
          isOpen={sheetOpen}
          onClose={() => setSheetOpen(false)}
          anchor="right"
          size="min(420px, 100vw)"
          animate={false}
          overrides={{
            DrawerContainer: {
              props: { role: 'dialog', 'aria-modal': true, 'aria-label': 'Story details' },
            },
          }}
        >
          {margin}
        </Drawer>
      )}
    </div>
  );
}

/** Smooth scrolling unless the reader asked for less motion. */
function motion(): ScrollBehavior {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}

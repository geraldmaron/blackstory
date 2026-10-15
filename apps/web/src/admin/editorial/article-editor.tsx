'use client';
import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { Button } from 'baseui/button';
import { Drawer } from 'baseui/drawer';
import { Checkbox } from 'baseui/checkbox';
import { Select } from 'baseui/select';
import { Notification } from 'baseui/notification';
import { FileUploaderBasic as FileUploader } from 'baseui/file-uploader-basic';
import { ARTICLE_THEME_IDS } from '@repo/schemas/public-articles';
import { TextField, TextAreaField, ChoiceField } from '../design-system/fields';
import { AdminRecordPicker } from '@/components/patterns/admin-record-picker';
import { RichDocument } from './rich-document';
import type {
  ArticleDraft,
  EditorialArticle,
  EditorialContributor,
  ArticleBodyBlockDoc,
} from '@repo/schemas';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { staffRoleHasPermission } from '../auth/staff-permissions';
import { BlockEditor, newBlock } from './block-editor';
const sections = [
  'Writing',
  'Sources',
  'Contributors',
  'Records',
  'Cover',
  'History',
  'Review',
] as const;
type Section = (typeof sections)[number];
export function ArticleEditor({
  initial,
  profiles,
  relatedRecords = [],
}: {
  initial: EditorialArticle;
  profiles: EditorialContributor[];
  relatedRecords: readonly { id: string; display_name: string }[];
}) {
  const { getIdToken, user, role, ready } = useAdminAuth();
  const [record, setRecord] = useState(initial);
  const [draft, setDraft] = useState(initial.draft),
    [revision, setRevision] = useState(initial.revision),
    [saved, setSaved] = useState(JSON.stringify(initial.draft));
  const [section, setSection] = useState<Section>('Writing'),
    [message, setMessage] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [suspended, setSuspended] = useState(false);
  const [recovery, setRecovery] = useState<string | null>(null),
    [reason, setReason] = useState('Edit article draft'),
    [checks, setChecks] = useState({ facts: false, rights: false, prose: false });
  const [uploadCredit, setUploadCredit] = useState(''),
    [uploadRights, setUploadRights] = useState('public_domain');
  const [archiveReason, setArchiveReason] = useState(''),
    [archiveConfirmed, setArchiveConfirmed] = useState(false);
  const [recordLabels, setRecordLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(relatedRecords.map((entity) => [entity.id, entity.display_name])),
  );
  const saving = useRef(false);
  const [compact, setCompact] = useState(false),
    [inspectorOpen, setInspectorOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1000px)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);
  function openInspector(next: Section) {
    setSection(next);
    setInspectorOpen(true);
  }
  const [selectedBlock, setSelectedBlock] = useState<number | null>(null);
  const inspectorPanel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inspectorPanel.current) inspectorPanel.current.scrollTop = 0;
  }, [section]);
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
    const response = await fetch(path, {
      method,
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error ?? 'The request failed.');
    return data;
  }
  async function refreshRecord() {
    try {
      const token = await getIdToken();
      if (!token) return;
      const response = await fetch(`/admin/api/articles/${draft.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Status refresh failed');
      const latest: EditorialArticle = await response.json();
      setRecord(latest);
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
  async function save() {
    if (saving.current || !editable) return;
    saving.current = true;
    setBusy(true);
    setError('');
    const sent = JSON.stringify(draft);
    try {
      const data = await request(
        revision ? `/admin/api/articles/${draft.id}` : '/admin/api/articles',
        revision ? 'PUT' : 'POST',
        { draft, revision, reason },
      );
      setRevision(data.revision);
      setSaved(sent);
      setSuspended(false);
      setMessage(`Saved revision ${data.revision}.`);
      if (storageKey && sessionStorage.getItem(storageKey) === sent)
        sessionStorage.removeItem(storageKey);
      // Updating the address without a route transition keeps keystrokes typed during save.
      window.history.replaceState(null, '', `/admin/stories/articles/${data.slug}`);
      await refreshRecord();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.');
      setSuspended(true);
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
  function patch<K extends keyof ArticleDraft>(key: K, value: ArticleDraft[K]) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage('');
  }
  async function decide(decision: string) {
    setBusy(true);
    setError('');
    try {
      await request(`/admin/api/articles/${draft.id}/review`, 'POST', {
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
      await request(`/admin/api/articles/${draft.id}/restore`, 'POST', {
        restoreRevision: target,
        revision,
        reason,
      });
      const latest = await refreshRecord();
      if (latest) {
        setRevision(latest.revision);
        setSaved(JSON.stringify(latest.draft));
        window.history.replaceState(null, '', `/admin/stories/articles/${latest.draft.slug}`);
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
          ? `/admin/api/articles/${draft.id}/unarchive`
          : `/admin/api/articles/${draft.id}`,
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
              ? 'Article archived. Its revisions remain available.'
              : 'Article restored to drafts. Review is required before publication.',
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
  async function upload(file: File, target?: Extract<ArticleBodyBlockDoc, { type: 'image' }>) {
    setBusy(true);
    setError('');
    try {
      const token = await getIdToken(),
        data = new FormData();
      data.set('file', file);
      data.set('credit', target?.image.credit ?? uploadCredit);
      data.set('rights', target?.image.rightsStatus ?? uploadRights);
      const response = await fetch(`/admin/api/articles/${draft.id}/media`, {
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
      setMessage('Image uploaded privately. Add its description and save the article.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  }
  async function publish() {
    setBusy(true);
    setError('');
    try {
      const data = await request(`/admin/api/articles/${draft.id}/publish`, 'POST', {
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
      const data = await request(`/admin/api/articles/${draft.id}/rollback`, 'POST', {
        releaseId: record.publication?.releaseId,
        reason,
      });
      setMessage(
        `Previous public article restored in release ${data.releaseId}. The current draft remains available.`,
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
  const metadataField = (
    key: 'title' | 'summary' | 'eraLabel' | 'placeLabel' | 'slug' | 'publishedAt' | 'updatedAt',
    label: string,
    area = false,
  ) =>
    area ? (
      <TextAreaField
        label={label}
        value={draft[key] ?? ''}
        onChange={(value) => patch(key, value)}
        disabled={!editable}
        rows={key === 'title' ? 2 : 3}
      />
    ) : (
      <TextField
        label={label}
        value={draft[key] ?? ''}
        onChange={(value) => patch(key, key === 'updatedAt' && !value ? undefined : value)}
        disabled={!editable}
      />
    );
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
  const inspector = (
    <aside className="editorial-inspector" aria-label="Article management">
      <nav className="editorial-inspector__tabs" aria-label="Article settings">
        {sections.map((s) => (
          <Button
            key={s}
            size="compact"
            kind={section === s ? 'primary' : 'tertiary'}
            isSelected={section === s}
            aria-pressed={section === s}
            onClick={() => setSection(s)}
          >
            {s === 'Writing'
              ? 'Settings'
              : s === 'Contributors'
                ? 'Credits'
                : s === 'Cover'
                  ? 'Media'
                  : s}
          </Button>
        ))}
      </nav>
      <div className="editorial-inspector__panel" ref={inspectorPanel}>
        {section === 'Writing' && (
          <section>
            <h2>Article settings</h2>
            {metadataField('slug', 'URL slug')}
            {metadataField('eraLabel', 'Historical period')}
            {metadataField('placeLabel', 'Place')}
            <ChoiceField
              label="Format"
              value={draft.kind}
              options={[
                { id: 'article', label: 'Article' },
                { id: 'chapter', label: 'Chapter' },
              ]}
              onChange={(value) => patch('kind', value as ArticleDraft['kind'])}
              disabled={!editable}
            />
            {metadataField('publishedAt', 'Publication date (YYYY-MM-DD)')}
            {metadataField('updatedAt', 'Correction date (optional)')}
            <TextAreaField
              label="Tags"
              value={draft.tags.join('\n')}
              onChange={(value) => patch('tags', value.split('\n').filter(Boolean))}
              disabled={!editable}
              caption="One tag per line"
            />
            <ChoiceField
              label="Theme"
              value={draft.themeId ?? ''}
              options={[
                { id: '', label: 'No theme' },
                ...ARTICLE_THEME_IDS.map((id) => ({ id, label: id.replaceAll('_', ' ') })),
              ]}
              onChange={(value) =>
                patch('themeId', value ? (value as ArticleDraft['themeId']) : undefined)
              }
              disabled={!editable}
            />
            {draft.series ? (
              <section className="editorial-inspector__group">
                <h3>Collection</h3>
                {(['id', 'label', 'positionLabel'] as const).map((key) => (
                  <TextField
                    key={key}
                    label={`Collection ${key}`}
                    value={draft.series?.[key] ?? ''}
                    onChange={(value) =>
                      patch('series', { ...draft.series!, [key]: value || undefined })
                    }
                    disabled={!editable}
                  />
                ))}
                <TextField
                  label="Collection position"
                  type="number"
                  min={0}
                  value={String(draft.series.position)}
                  onChange={(value) =>
                    patch('series', { ...draft.series!, position: Number(value) })
                  }
                  disabled={!editable}
                />
                <Button
                  kind="tertiary"
                  onClick={() => patch('series', undefined)}
                  disabled={!editable}
                >
                  Remove collection
                </Button>
              </section>
            ) : (
              <Button
                kind="secondary"
                onClick={() => patch('series', { id: 'new-collection', label: '', position: 0 })}
                disabled={!editable}
              >
                Add to collection
              </Button>
            )}
            {!!revision && (
              <section className="editorial-inspector__group">
                <h3>{record.archivedAt ? 'Archived article' : 'Archive article'}</h3>
                <p>
                  {record.archivedAt
                    ? 'Restore this article to edit it. Its history is preserved.'
                    : record.activePublicReleaseId
                      ? 'Archiving removes this article from public stories in a new signed release. Saved revisions remain available.'
                      : 'Remove this draft from the active library. You can restore it from Archived articles.'}
                </p>
                {!canManage && (
                  <p>
                    Your role cannot change this article’s library state. Removing a public article
                    requires publication authority.
                  </p>
                )}
                <TextAreaField
                  label="Reason for library change"
                  value={archiveReason}
                  onChange={setArchiveReason}
                  disabled={busy}
                  rows={2}
                />
                {record.activePublicReleaseId && !record.archivedAt && (
                  <Checkbox
                    checked={archiveConfirmed}
                    onChange={(event) => setArchiveConfirmed(event.currentTarget.checked)}
                    disabled={busy}
                  >
                    Remove the current public article
                  </Checkbox>
                )}
                <Button
                  kind="secondary"
                  disabled={
                    busy ||
                    dirty ||
                    !archiveReason.trim() ||
                    !canManage ||
                    (!!record.activePublicReleaseId && !archiveConfirmed)
                  }
                  onClick={() => void manageArchive()}
                >
                  {record.archivedAt ? 'Restore to drafts' : 'Archive article'}
                </Button>
              </section>
            )}
          </section>
        )}
        {section === 'Sources' && (
          <section>
            <h2>Sources and evidence</h2>
            <p>
              Attach the sources supporting the prose. Insert citations from the writing toolbar.
            </p>
            {selectedBlock !== null && draft.body[selectedBlock] && (
              <div className="editorial-inspector__group">
                <h3>Selected block</h3>
                <BlockEditor
                  disabled={!editable || busy}
                  block={draft.body[selectedBlock]!}
                  index={selectedBlock}
                  onChange={(block) =>
                    patch(
                      'body',
                      draft.body.map((b, i) => (i === selectedBlock ? block : b)),
                    )
                  }
                  move={(delta) => {
                    move(selectedBlock, delta);
                    setSelectedBlock((index) =>
                      index === null
                        ? null
                        : Math.max(0, Math.min(draft.body.length - 1, index + delta)),
                    );
                  }}
                  remove={() => {
                    patch(
                      'body',
                      draft.body.filter((_, i) => i !== selectedBlock),
                    );
                    setSelectedBlock(null);
                  }}
                />
                {draft.body[selectedBlock]!.type === 'image' && (
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
                          draft.body[selectedBlock] as Extract<
                            ArticleBodyBlockDoc,
                            { type: 'image' }
                          >
                        ).image.credit.trim()
                      }
                      onDrop={(files) => {
                        const target = draft.body[selectedBlock];
                        if (files[0] && target?.type === 'image') void upload(files[0], target);
                      }}
                      onDropRejected={() =>
                        setError('Choose a PNG, JPEG or WebP image up to 5 MB.')
                      }
                    />
                  </div>
                )}
              </div>
            )}
            {draft.references.map((reference, index) => (
              <section className="editorial-inspector__group" key={index}>
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
                    onChange={(value) =>
                      patch(
                        'references',
                        draft.references.map((ref, i) =>
                          i === index ? { ...ref, [key]: value } : ref,
                        ),
                      )
                    }
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
                          patch(
                            'references',
                            draft.references.map((ref, i) =>
                              i === index
                                ? {
                                    ...ref,
                                    scholarlyCitation: {
                                      ...ref.scholarlyCitation!,
                                      [key]: value,
                                    },
                                  }
                                : ref,
                            ),
                          )
                        }
                        disabled={!editable}
                      />
                    ))}
                    <Button
                      kind="tertiary"
                      onClick={() =>
                        patch(
                          'references',
                          draft.references.map((ref, i) =>
                            i === index ? { ...ref, scholarlyCitation: undefined } : ref,
                          ),
                        )
                      }
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
                      patch(
                        'references',
                        draft.references.map((ref, i) =>
                          i === index
                            ? {
                                ...ref,
                                scholarlyCitation: {
                                  doi: '',
                                  title: '',
                                  firstAuthorSurname: '',
                                  venue: '',
                                },
                              }
                            : ref,
                        ),
                      )
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
              </section>
            ))}
            <Button
              kind="secondary"
              onClick={() =>
                patch('references', [
                  ...draft.references,
                  { id: `source-${draft.references.length + 1}`, label: '', url: '' },
                ])
              }
              disabled={!editable}
            >
              Add source
            </Button>
            <p>
              <Link href="/admin/sources" target="_blank">
                Open source library
              </Link>
            </p>
          </section>
        )}
        {section === 'Contributors' && (
          <section>
            <h2>Contributor credits</h2>
            <p>Credits belong to this revision. Neo is the house editorial identity.</p>
            {draft.contributors.map((credit, index) => (
              <section className="editorial-inspector__group" key={credit.id}>
                <h3>
                  {index + 1}. {credit.name}
                </h3>
                {(['author', 'researcher', 'editor'] as const).map((role) => (
                  <Checkbox
                    key={role}
                    checked={credit.roles.includes(role)}
                    disabled={!editable}
                    onChange={(event) =>
                      patch(
                        'contributors',
                        draft.contributors.map((c, i) =>
                          i === index
                            ? {
                                ...c,
                                roles: event.currentTarget.checked
                                  ? [...c.roles, role]
                                  : c.roles.filter((r) => r !== role),
                              }
                            : c,
                        ),
                      )
                    }
                  >
                    {role}
                  </Checkbox>
                ))}
                <div className="admin-base-actions">
                  <Button
                    kind="tertiary"
                    size="compact"
                    disabled={!editable || index === 0}
                    onClick={() => {
                      const next = [...draft.contributors];
                      [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                      patch('contributors', next);
                    }}
                  >
                    Move up
                  </Button>
                  <Button
                    kind="tertiary"
                    size="compact"
                    disabled={!editable}
                    onClick={() =>
                      patch(
                        'contributors',
                        draft.contributors.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Remove
                  </Button>
                </div>
              </section>
            ))}
            <Select
              aria-label="Add contributor"
              placeholder="Add contributor"
              value={[]}
              clearable={false}
              disabled={!editable}
              options={profiles
                .filter((profile) => !draft.contributors.some((c) => c.id === profile.id))
                .map((profile) => ({ id: profile.id, label: profile.name }))}
              onChange={({ value }) => {
                const profile = profiles.find((p) => p.id === value[0]?.id);
                if (profile)
                  patch('contributors', [
                    ...draft.contributors,
                    {
                      id: profile.id,
                      name: profile.name,
                      kind: profile.kind,
                      roles: ['author'],
                    },
                  ]);
              }}
            />
            <p>
              <Link href="/admin/stories/contributors" target="_blank">
                Manage contributors
              </Link>
            </p>
          </section>
        )}
        {section === 'Records' && (
          <section>
            <h2>Related records</h2>
            <p>Editorial associations are separate from historical relationships.</p>
            {draft.relatedEntityIds.map((id) => (
              <div key={id} className="editorial-inspector__group">
                <Link href={`/admin/catalog/${encodeURIComponent(id)}`} target="_blank">
                  {recordLabels[id] ?? id}
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
              onSelect={(entity) => {
                setRecordLabels((previous) => ({ ...previous, [entity.id]: entity.display_name }));
                if (!draft.relatedEntityIds.includes(entity.id))
                  patch('relatedEntityIds', [...draft.relatedEntityIds, entity.id]);
              }}
            />
            <p>
              <Link href="/admin/quick-add" target="_blank">
                Propose a new record
              </Link>
            </p>
          </section>
        )}
        {section === 'Cover' && (
          <section>
            <h2>Cover and media</h2>
            <p>
              Uploads stay private until publication. Record credit and rights before uploading.
            </p>
            <TextField
              label="Image credit"
              value={uploadCredit}
              onChange={setUploadCredit}
              disabled={!editable}
            />
            <ChoiceField
              label="Rights"
              value={uploadRights}
              options={[
                { id: 'public_domain', label: 'Public domain' },
                { id: 'licensed', label: 'Licensed' },
                { id: 'fair_use', label: 'Fair use' },
              ]}
              onChange={setUploadRights}
              disabled={!editable}
            />
            <FileUploader
              accept="image/png,image/jpeg,image/webp"
              maxSize={5242880}
              disabled={!editable || busy || !revision || !uploadCredit.trim()}
              onDrop={(files) => {
                if (files[0]) void upload(files[0]);
              }}
              onDropRejected={() => setError('Choose a PNG, JPEG or WebP image up to 5 MB.')}
            />
            {!revision && <p>Save the draft before uploading media.</p>}
            {draft.heroImage && (
              <div className="editorial-inspector__group">
                <Image
                  unoptimized
                  width={draft.heroImage.width ?? 800}
                  height={draft.heroImage.height ?? 600}
                  style={{ width: '100%', height: 'auto' }}
                  src={draft.heroImage.url}
                  alt={draft.heroImage.alt || 'Private cover preview'}
                />
                <TextAreaField
                  label="Image description"
                  value={draft.heroImage.alt}
                  onChange={(value) => patch('heroImage', { ...draft.heroImage!, alt: value })}
                  disabled={!editable}
                />
                <p>{draft.heroImage.credit}</p>
                <Button
                  kind="tertiary"
                  onClick={() => patch('heroImage', undefined)}
                  disabled={!editable}
                >
                  Remove cover
                </Button>
              </div>
            )}
          </section>
        )}
        {section === 'History' && (
          <section>
            <h2>Revision history</h2>
            <p>
              Restoring creates a new draft. Public content stays unchanged until review and
              publication.
            </p>
            {record.history.map((history) => (
              <div key={history.revision} className="editorial-inspector__group">
                <h3>Revision {history.revision}</h3>
                <p>{new Date(history.createdAt).toLocaleString()}</p>
                <p>{history.reason}</p>
                <Button
                  kind="secondary"
                  size="compact"
                  disabled={!editable || busy || dirty}
                  onClick={() => void restore(history.revision)}
                >
                  Restore revision {history.revision}
                </Button>
              </div>
            ))}
          </section>
        )}
        {section === 'Review' && (
          <section>
            <h2>Review and publication</h2>
            <p>
              {dirty
                ? 'Save the current edits before review.'
                : `Review applies to saved revision ${revision}.`}
            </p>
            {!!record.blockers?.length && (
              <div className="editorial-inspector__group">
                <h3>Needs attention</h3>
                <ul>
                  {record.blockers.map((blocker, index) => (
                    <li key={index}>{blocker}</li>
                  ))}
                </ul>
              </div>
            )}
            <p>Latest decision: {record.review?.decision ?? 'Not reviewed'}</p>
            {canReview && (
              <>
                <TextAreaField
                  label="Reason for changes or review"
                  value={reason}
                  onChange={setReason}
                />
                {(['facts', 'rights', 'prose'] as const).map((key) => (
                  <Checkbox
                    key={key}
                    checked={checks[key]}
                    disabled={busy || dirty || !revision}
                    onChange={(event) =>
                      setChecks({ ...checks, [key]: event.currentTarget.checked })
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
                      !checks.facts ||
                      !checks.rights ||
                      !checks.prose ||
                      !reason.trim() ||
                      !!record.blockers?.length
                    }
                    onClick={() => void decide('approved')}
                  >
                    Approve revision
                  </Button>
                  <Button
                    kind="tertiary"
                    disabled={busy || dirty || !revision}
                    onClick={() => void decide('needs_evidence')}
                  >
                    Needs evidence
                  </Button>
                  <Button
                    kind="tertiary"
                    disabled={busy || dirty || !revision}
                    onClick={() => void decide('rejected')}
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
                  onClick={() => void publish()}
                >
                  Publish approved revision
                </Button>
              </>
            )}
            {record.publication && (
              <div className="editorial-inspector__group">
                <h3>Publication history</h3>
                <p>Last published revision {record.publication.revision}</p>
                {record.activePublicReleaseId ? (
                  <Link href={`/stories/${draft.slug}`} target="_blank">
                    Open public article
                  </Link>
                ) : (
                  <p>No current public article.</p>
                )}
                {canReview && record.publication.canRollback && (
                  <Button
                    kind="secondary"
                    disabled={busy || dirty || !reason.trim()}
                    onClick={() => void rollback()}
                  >
                    Restore previous public article
                  </Button>
                )}
              </div>
            )}
            <p className="editorial-inspector__note">
              Publication creates a signed release. A failed operation leaves the public version
              intact.
            </p>
          </section>
        )}
      </div>
    </aside>
  );
  return (
    <div className="editorial-editor">
      <header className="editorial-editor__header">
        <div>
          <nav aria-label="Breadcrumb">
            <Link href="/admin/stories/articles">Articles</Link>
            <span aria-hidden="true"> / </span>
            <span>{draft.title || 'Untitled article'}</span>
          </nav>
          <p className="editorial-editor__save-status" role="status">
            {busy
              ? 'Saving or processing…'
              : dirty
                ? 'Unsaved changes'
                : revision
                  ? `Saved · revision ${revision}`
                  : 'New draft'}
            {!editable
              ? ' · Read only'
              : suspended
                ? ' · Automatic saving paused'
                : ' · Automatic saving on'}
          </p>
        </div>
        <div className="admin-base-actions">
          <Button
            kind="secondary"
            disabled={busy || !editable || !dirty}
            onClick={() => void save()}
          >
            Save draft
          </Button>
          <Button
            kind="secondary"
            href={
              revision ? `/admin/stories/articles/${draft.slug}/preview?revision=${revision}` : null
            }
            target="_blank"
            disabled={!revision}
          >
            Preview
          </Button>
          <Button onClick={() => openInspector('Review')}>Review and publish</Button>
        </div>
      </header>
      {record.archivedAt && (
        <p role="status" className="editorial-editor__message">
          Archived article. Restore it from Settings to resume editing.
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
              <Button kind="tertiary" href={`/admin/stories/articles/${draft.id}`} target="_blank">
                Compare saved version
              </Button>
            )}
          </Notification>
        </div>
      )}
      {message && (
        <p role="status" className="editorial-editor__message">
          {message}
        </p>
      )}
      {recovery && (
        <section className="admin-base-panel" aria-label="Recover edits">
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
      {compact && (
        <Button kind="secondary" onClick={() => setInspectorOpen(true)}>
          Article settings, sources and review
        </Button>
      )}
      <div className="editorial-compose">
        <section className="editorial-compose__document" aria-label="Article composition">
          <div className="editorial-compose__masthead">
            <div className="editorial-editor__title">{metadataField('title', 'Title', true)}</div>
            {metadataField('summary', 'Summary', true)}
          </div>
          <RichDocument
            body={draft.body}
            onChange={(body) => patch('body', body)}
            editable={editable}
            references={draft.references}
            onEditBlock={(index) => {
              setSelectedBlock(index);
              openInspector('Sources');
            }}
            onError={(message) => {
              setError(message);
              setSuspended(true);
            }}
          />
          <div className="editorial-compose__insert">
            <Select
              aria-label="Add evidence block"
              placeholder="Add an evidence block"
              value={[]}
              clearable={false}
              searchable={true}
              disabled={!editable}
              options={[
                'image',
                'mapInset',
                'figure',
                'stat',
                'primaryDocument',
                'timeline',
                'dispute',
              ].map((id) => ({
                id,
                label: {
                  image: 'Image',
                  mapInset: 'Record map',
                  figure: 'Figure',
                  stat: 'Statistic',
                  primaryDocument: 'Primary document',
                  timeline: 'Timeline',
                  dispute: 'Disputed account',
                }[id],
              }))}
              onChange={({ value }) => {
                const type = value[0]?.id;
                if (type) {
                  setSelectedBlock(draft.body.length);
                  patch('body', [...draft.body, newBlock(type as ArticleBodyBlockDoc['type'])]);
                  openInspector('Sources');
                }
              }}
            />
            <p>
              {wordCount} {wordCount === 1 ? 'word' : 'words'} · {draft.references.length}{' '}
              {draft.references.length === 1 ? 'source' : 'sources'} ·{' '}
              {draft.relatedEntityIds.length} related{' '}
              {draft.relatedEntityIds.length === 1 ? 'record' : 'records'}
            </p>
          </div>
        </section>
        {compact ? (
          <Drawer
            isOpen={inspectorOpen}
            onClose={() => setInspectorOpen(false)}
            anchor="right"
            size="full"
            animate={false}
            overrides={{
              DrawerContainer: {
                props: { role: 'dialog', 'aria-modal': true, 'aria-label': 'Article management' },
              },
            }}
          >
            <h2>Article management</h2>
            {inspector}
          </Drawer>
        ) : (
          inspector
        )}
      </div>
    </div>
  );
}

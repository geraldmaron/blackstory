'use client';
import { useState } from 'react';
import { Button } from 'baseui/button';
import { TextField, TextAreaField, ChoiceField } from '../design-system/fields';
import { useRouter } from 'next/navigation';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { slugFromName } from './contributor-slug';
import type { ContributorListing } from './store';

const BIOGRAPHY_MAX = 2000;
const KIND_LABEL = { person: 'Person', editorial: 'House editorial identity' } as const;

type Draft = { id: string; name: string; kind: string; biography: string; linkToMe: boolean };
const BLANK: Draft = { id: '', name: '', kind: 'person', biography: '', linkToMe: false };
const fromProfile = (p: ContributorListing): Draft => ({
  id: p.id,
  name: p.name,
  kind: p.kind,
  biography: p.biography,
  linkToMe: false,
});

export function Contributors({ profiles }: { profiles: ContributorListing[] }) {
  const router = useRouter();
  const { getIdToken, role } = useAdminAuth();
  const canEdit = role === 'admin';
  const [selected, setSelected] = useState<string>(profiles[0]?.id ?? '');
  const [draft, setDraft] = useState<Draft>(profiles[0] ? fromProfile(profiles[0]) : BLANK);
  const [message, setMessage] = useState<{ text: string; failed: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  const existing = profiles.find((p) => p.id === selected);
  const isNew = !existing;
  const id = isNew ? slugFromName(draft.name) : draft.id;
  const linked = existing?.linkedToMe ?? false;
  const overLimit = draft.biography.length > BIOGRAPHY_MAX;
  const ready = canEdit && !busy && !!id && !!draft.name.trim() && !overLimit;

  function select(profile: ContributorListing | null) {
    setSelected(profile?.id ?? '');
    setDraft(profile ? fromProfile(profile) : BLANK);
    setMessage(null);
  }

  async function save() {
    setBusy(true);
    setMessage(null);
    try {
      const token = await getIdToken();
      const r = await fetch('/admin/api/contributors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile: { ...draft, id },
          reason: 'Manage editorial contributor profile',
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setSelected(id);
      setDraft({ ...draft, id, linkToMe: false });
      setMessage({ text: 'Saved.', failed: false });
      router.refresh();
    } catch (e) {
      setMessage({
        text: e instanceof Error ? e.message : 'Could not save this profile.',
        failed: true,
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="contributors">
      <div className="contributors__list">
        <ul className="contributors__rows">
          {profiles.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                className="contributors__row"
                aria-current={p.id === selected ? 'true' : undefined}
                onClick={() => select(p)}
              >
                <span className="contributors__name">{p.name}</span>
                <span className="contributors__quiet">
                  {KIND_LABEL[p.kind as keyof typeof KIND_LABEL] ?? p.kind}
                  {p.credited > 0
                    ? ` · credited on ${p.credited} ${p.credited === 1 ? 'story' : 'stories'}`
                    : ''}
                  {p.linkedToMe ? ' · Linked to your account' : ''}
                </span>
                {p.biography.trim() ? null : (
                  <span className="contributors__quiet">No biography yet</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <Button kind="secondary" size="compact" onClick={() => select(null)}>
          New profile
        </Button>
      </div>

      <div className="contributors__editor">
        {canEdit ? null : (
          <p className="contributors__note" role="status">
            Only an admin can edit profiles. You can read them here.
          </p>
        )}
        <fieldset disabled={!canEdit || busy} className="contributors__fields">
          <legend className="ds-visually-hidden">{isNew ? 'New profile' : draft.name}</legend>
          <TextField
            label="Name"
            value={draft.name}
            onChange={(name) => setDraft({ ...draft, name })}
          />
          <p className="contributors__slug">
            {id ? (
              <>
                Credited as <span className="ds-mono">{id}</span>
                {isNew ? '' : ' (fixed once saved)'}
              </>
            ) : (
              'The credit ID is made from the name.'
            )}
          </p>
          <TextAreaField
            label="Biography"
            value={draft.biography}
            onChange={(biography) => setDraft({ ...draft, biography })}
            caption="Shown under the byline on published stories."
          />
          <p
            className="contributors__count"
            data-over={overLimit ? 'true' : undefined}
            aria-live="polite"
          >
            {draft.biography.length.toLocaleString()} / {BIOGRAPHY_MAX.toLocaleString()}
          </p>
          <ChoiceField
            label="Identity"
            value={draft.kind}
            onChange={(kind) => setDraft({ ...draft, kind, linkToMe: false })}
            options={[
              { id: 'person', label: KIND_LABEL.person },
              { id: 'editorial', label: KIND_LABEL.editorial },
            ]}
          />
          {draft.kind === 'person' ? (
            linked ? (
              <p className="contributors__slug">Linked to your account. Only you see this link.</p>
            ) : (
              <Button
                kind={draft.linkToMe ? 'primary' : 'secondary'}
                size="compact"
                aria-pressed={draft.linkToMe}
                onClick={() => setDraft({ ...draft, linkToMe: !draft.linkToMe })}
              >
                This is me
              </Button>
            )
          ) : null}
          <div className="contributors__actions">
            <Button isLoading={busy} disabled={!ready} onClick={() => void save()}>
              Save profile
            </Button>
            {message ? (
              <p
                className="contributors__status"
                data-failed={message.failed ? 'true' : undefined}
                role={message.failed ? 'alert' : 'status'}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </fieldset>
      </div>
    </div>
  );
}

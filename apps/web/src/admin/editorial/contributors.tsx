'use client';
import { useState } from 'react';
import { Button } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { Notification } from 'baseui/notification';
import { TextField, TextAreaField, ChoiceField } from '../design-system/fields';
import { useRouter } from 'next/navigation';
import type { EditorialContributor } from '@repo/schemas';
import { useAdminAuth } from '../auth/AdminAuthProvider';
export function Contributors({ profiles }: { profiles: EditorialContributor[] }) {
  const router = useRouter();
  const { getIdToken, role } = useAdminAuth();
  const [profile, setProfile] = useState({
    id: '',
    name: '',
    kind: 'person',
    biography: '',
    linkToMe: false,
  });
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      const token = await getIdToken();
      const r = await fetch('/admin/api/contributors', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile, reason: 'Manage editorial contributor profile' }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setMessage('Contributor saved. Reopen the story contributor list to select it.');
      router.refresh();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'Could not save contributor.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="admin-base-master-detail">
      <div>
        <Button
          kind="secondary"
          size="compact"
          onClick={() =>
            setProfile({ id: '', name: '', kind: 'person', biography: '', linkToMe: false })
          }
        >
          New contributor
        </Button>
        <ul className="admin-base-profile-list">
          {profiles.map((p) => (
            <li key={p.id}>
              <Button
                kind="tertiary"
                size="compact"
                isSelected={profile.id === p.id}
                onClick={() => setProfile({ ...p, linkToMe: false })}
              >
                {p.name}
              </Button>{' '}
              · {p.kind}
              <p>{p.biography}</p>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <fieldset disabled={role !== 'admin' || busy}>
          <legend>Contributor profile</legend>
          <TextField
            label="Profile ID"
            value={profile.id}
            onChange={(id) => setProfile({ ...profile, id })}
            disabled={role !== 'admin' || busy || profiles.some((p) => p.id === profile.id)}
            caption="A stable identifier used in story credits."
          />
          <TextField
            label="Name"
            value={profile.name}
            onChange={(name) => setProfile({ ...profile, name })}
            disabled={role !== 'admin' || busy}
          />
          <TextAreaField
            label="Biography"
            value={profile.biography}
            onChange={(biography) => setProfile({ ...profile, biography })}
            disabled={role !== 'admin' || busy}
          />
          <ChoiceField
            label="Identity"
            value={profile.kind}
            onChange={(kind) => setProfile({ ...profile, kind })}
            disabled={role !== 'admin' || busy}
            options={[
              { id: 'person', label: 'Person' },
              { id: 'editorial', label: 'Editorial identity' },
            ]}
          />
          <Checkbox
            checked={profile.linkToMe}
            disabled={role !== 'admin' || busy || profile.kind !== 'person'}
            onChange={(event) => setProfile({ ...profile, linkToMe: event.currentTarget.checked })}
          >
            Link this person to my signed-in account privately
          </Checkbox>
          <Button isLoading={busy} disabled={role !== 'admin'} onClick={() => void save()}>
            Save profile
          </Button>
        </fieldset>
        {message && <Notification>{message}</Notification>}
      </div>
    </div>
  );
}

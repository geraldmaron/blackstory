/**
 * Canonical entity detail — an editable record, not a read-only card.
 *
 * Server-rendered: the record, the operator's role, and whether that role may edit are all
 * resolved before the first byte. The previous version was a client page that fetched a token,
 * then fetched the entity, then rendered — and offered no way to fix anything it displayed, so
 * corrections happened in ad hoc scripts with no audit trail.
 *
 * Edit affordances are hidden for roles without `canonical:write`, but that is presentation only:
 * every save re-checks the role server-side in `commitCanonicalWrite`.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { SENSITIVITY_CLASSES } from '@repo/domain';
import { readVerifiedAdminIdentity } from '../../../auth/supabase-server';
import { staffRoleHasPermission } from '../../../auth/staff-permissions';
import { readEntityDetail } from '../../../lib/entity-detail';
import { readPostgresOrDegrade } from '../../../lib/postgres-client';
import { formatLivingStatusLabel } from '../living-status-label';
import { EntityRecordEditor } from './EntityRecordEditor';

function formatWhen(iso: string): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default async function CatalogEntityDetailPage({
  params,
}: {
  readonly params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const entityId = decodeURIComponent(id);

  const [identity, outcome] = await Promise.all([
    readVerifiedAdminIdentity(),
    readPostgresOrDegrade(() => readEntityDetail(entityId), 'entity detail'),
  ]);

  if (outcome.status === 'degraded') {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <h1 className="ds-page__title">{entityId}</h1>
        <p className="story-review__alert" role="alert">
          The catalog database did not answer, so this record could not be loaded. Reload to retry.{' '}
          <span className="ds-mono">{outcome.reason}</span>
        </p>
        <p className="story-review__notice">
          <Link href="/catalog">← Back to catalog</Link>
        </p>
      </main>
    );
  }

  const entity = outcome.value;
  if (!entity) notFound();

  const canEdit = identity ? staffRoleHasPermission(identity.role, 'canonical:write') : false;

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Canonical catalog</p>
          <h1 className="ds-page__title">{entity.displayName}</h1>
          <p className="ds-page__lede">
            The canonical record itself. Edits here change what the archive holds; they do not
            publish. The next release build reads canonical, and the signed manifest is still what
            makes anything live.
          </p>
          <p className="story-review__notice">
            <Link href="/catalog">← Back to catalog</Link>
            {' · '}
            <Link href="/inbox">Open inbox</Link>
            {' · '}
            <Link href="/audit">Audit log</Link>
          </p>
        </div>
      </header>

      {entity.mergedIntoId ? (
        <p className="story-review__alert" role="alert">
          This record was merged away. Edit{' '}
          <Link href={`/catalog/${encodeURIComponent(entity.mergedIntoId)}`}>the survivor</Link>{' '}
          instead — changes here will not reach the archive.
        </p>
      ) : null}

      <section className="story-review__detail" aria-label="Record">
        <p className="story-review__detail-meta ds-mono">
          {entity.id} · {entity.kind}
          {entity.entityClass ? ` · ${entity.entityClass}` : ''} ·{' '}
          {formatLivingStatusLabel(entity.livingStatus)} · {entity.claimCount} claims · updated{' '}
          {formatWhen(entity.updatedAt)}
        </p>

        {canEdit ? (
          <EntityRecordEditor entity={entity} sensitivityClasses={SENSITIVITY_CLASSES} />
        ) : (
          <>
            <p className="story-review__notice ds-sans">
              {identity
                ? `Your role (${identity.role}) can read this record but not edit it. Editing canonical fields needs canonical:write.`
                : 'Sign in to edit this record.'}
            </p>

            <h2 className="ds-section__title">Aliases</h2>
            {entity.aliases.length === 0 ? (
              <p className="ds-sans">No aliases recorded.</p>
            ) : (
              <ul className="story-review__anchors">
                {entity.aliases.map((alias) => (
                  <li key={alias}>{alias}</li>
                ))}
              </ul>
            )}

            <h2 className="ds-section__title">Sensitivity</h2>
            {entity.sensitivity.length === 0 ? (
              <p className="ds-sans">No sensitivity classes recorded.</p>
            ) : (
              <ul className="story-review__anchors">
                {entity.sensitivity.map((entry) => (
                  <li key={entry.class}>
                    <span className="ds-mono">{entry.class}</span>
                    {entry.source ? ` (${entry.source})` : ''}
                  </li>
                ))}
              </ul>
            )}

            <h2 className="ds-section__title">Identifiers</h2>
            {entity.identifiers.length === 0 ? (
              <p className="ds-sans">No identifiers recorded.</p>
            ) : (
              <ul className="story-review__anchors">
                {entity.identifiers.map((identifier) => (
                  <li key={identifier.id}>
                    <span className="ds-mono">{identifier.namespace}</span> — {identifier.value}
                    {identifier.trusted ? ' · trusted' : ''}
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        <h2 className="ds-section__title">Locations</h2>
        {entity.locations.length === 0 ? (
          <p className="ds-sans">No locations recorded.</p>
        ) : (
          <div className="story-review__table-wrap">
            <table className="story-review__table">
              <thead>
                <tr>
                  <th scope="col">Label</th>
                  <th scope="col">Role</th>
                  <th scope="col">Precision</th>
                  <th scope="col">Coordinates</th>
                </tr>
              </thead>
              <tbody>
                {entity.locations.map((location) => (
                  <tr key={location.id}>
                    <td>{location.label ?? '—'}</td>
                    <td className="ds-mono">{location.role}</td>
                    <td className="ds-mono">{location.precision ?? '—'}</td>
                    <td className="ds-mono">
                      {location.lat !== undefined && location.lng !== undefined
                        ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="entity-edit__hint ds-sans">
          Locations are read-only here. Each row carries geometry, geohash, jurisdiction, and
          validity fields that need a geocoding flow rather than a text box — tracked separately.
        </p>
      </section>
    </main>
  );
}

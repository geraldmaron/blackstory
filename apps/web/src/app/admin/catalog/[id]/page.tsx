/**
 * Canonical entity detail · an editable record, not a read-only card.
 *
 * Server-rendered: the record, the operator's role, and whether that role may edit are all
 * resolved before the first byte. The previous version was a client page that fetched a token,
 * then fetched the entity, then rendered · and offered no way to fix anything it displayed, so
 * corrections happened in ad hoc scripts with no audit trail.
 *
 * Edit affordances are hidden for roles without `canonical:write`, but that is presentation only:
 * every save re-checks the role server-side in `commitCanonicalWrite`.
 */
import Link from 'next/link';
import { ManagementTabs } from '@/admin/design-system/management-tabs';
import { readEntityEditorial } from '@/admin/editorial/entities';
import { EntityEditorialEditor } from '@/admin/editorial/entity-editor';
import '../../stories/stories.css';
import { notFound } from 'next/navigation';
import { SENSITIVITY_CLASSES } from '@repo/domain';
import { DetailField, DetailPanel } from '@repo/ui';
import { readVerifiedAdminIdentity } from '../../../../admin/auth/supabase-server';
import { staffRoleHasPermission } from '../../../../admin/auth/staff-permissions';
import { readEntityDetail } from '../../../../admin/lib/entity-detail';
import { readActiveMergesFor } from '../../../../admin/lib/entity-merge';
import { readPostgresOrDegrade } from '../../../../admin/lib/canonical-postgres-client';
import { formatLivingStatusLabel } from '../living-status-label';
import { EntityRecordEditor } from './EntityRecordEditor';
import { ReverseMergeForm } from './ReverseMergeForm';

function formatWhen(iso: string): string {
  if (!iso) return 'Not recorded';
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

  const [identity, outcome, mergesOutcome] = await Promise.all([
    readVerifiedAdminIdentity(),
    readPostgresOrDegrade(() => readEntityDetail(entityId), 'entity detail'),
    readPostgresOrDegrade(() => readActiveMergesFor(entityId), 'entity merges'),
  ]);

  if (outcome.status === 'degraded') {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <h1 className="admin-base-title">{entityId}</h1>
        <p className="story-review__alert" role="alert">
          The catalog database did not answer, so this record could not be loaded. Reload to retry.{' '}
          <span className="ds-mono">{outcome.reason}</span>
        </p>
        <p className="story-review__notice">
          <Link href="/admin/catalog">← Back to catalog</Link>
        </p>
      </main>
    );
  }

  const entity = outcome.value;
  if (!entity) notFound();

  const canEdit = identity ? staffRoleHasPermission(identity.role, 'canonical:write') : false;
  const canMerge = identity ? staffRoleHasPermission(identity.role, 'canonical:merge') : false;
  const merges = mergesOutcome.status === 'ok' ? mergesOutcome.value : [];

  const editorial = identity ? await readEntityEditorial(entityId) : null;
  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="admin-base-page-header">
        <div>
          <p className="ds-page__eyebrow">Canonical catalog</p>
          <h1 className="admin-base-title">{entity.displayName}</h1>
          <p className="ds-page__lede">
            Manage identity, prose and evidence. Canonical changes enter the next reviewed release.
          </p>
          <p className="story-review__notice">
            <Link href="/admin/catalog">← Back to catalog</Link>
            {' · '}
            <Link href="/admin/inbox">Open inbox</Link>
            {' · '}
            <Link href="/admin/audit">Audit log</Link>
          </p>
        </div>
      </header>

      {entity.mergedIntoId ? (
        <p className="story-review__alert" role="alert">
          This record was merged away. Edit{' '}
          <Link href={`/admin/catalog/${encodeURIComponent(entity.mergedIntoId)}`}>
            the survivor
          </Link>{' '}
          instead · changes here will not reach the archive.
        </p>
      ) : null}

      <section className="story-review__detail" aria-label="Record">
        <p className="story-review__detail-meta ds-mono">
          {entity.id} · {entity.kind}
          {entity.entityClass ? ` · ${entity.entityClass}` : ''} ·{' '}
          {formatLivingStatusLabel(entity.livingStatus)} · {entity.claimCount} claims · updated{' '}
          {formatWhen(entity.updatedAt)}
        </p>

        <ManagementTabs
          panels={[
            {
              id: 'editorial',
              label: 'Prose and evidence',
              content: editorial ? (
                <EntityEditorialEditor entityId={entityId} details={editorial} />
              ) : (
                <p>Editorial information unavailable.</p>
              ),
            },
            {
              id: 'identity',
              label: 'Identity',
              content: (
                <>
                  {' '}
                  {canEdit ? (
                    <EntityRecordEditor entity={entity} sensitivityClasses={SENSITIVITY_CLASSES} />
                  ) : (
                    <>
                      <p className="story-review__notice ds-sans">
                        {identity
                          ? `Your role (${identity.role}) can read this record but not edit it. Editing canonical fields needs canonical:write.`
                          : 'Sign in to edit this record.'}
                      </p>

                      {/* Read-only view. Each empty case says which field is empty rather than going
                blank, so "no aliases" cannot be mistaken for "aliases failed to load". */}
                      <DetailPanel title="Record fields">
                        <DetailField label="Aliases" emptyLabel="No aliases recorded">
                          {entity.aliases.length === 0 ? null : (
                            <ul className="story-review__anchors">
                              {entity.aliases.map((alias) => (
                                <li key={alias}>{alias}</li>
                              ))}
                            </ul>
                          )}
                        </DetailField>

                        <DetailField
                          label="Sensitivity"
                          emptyLabel="No sensitivity classes recorded"
                        >
                          {entity.sensitivity.length === 0 ? null : (
                            <ul className="story-review__anchors">
                              {entity.sensitivity.map((entry) => (
                                <li key={entry.class}>
                                  <span className="ds-mono">{entry.class}</span>
                                  {entry.source ? ` (${entry.source})` : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </DetailField>

                        <DetailField label="Identifiers" emptyLabel="No identifiers recorded">
                          {entity.identifiers.length === 0 ? null : (
                            <ul className="story-review__anchors">
                              {entity.identifiers.map((identifier) => (
                                <li key={identifier.id}>
                                  <span className="ds-mono">{identifier.namespace}</span> —{' '}
                                  {identifier.value}
                                  {identifier.trusted ? ' · trusted' : ''}
                                </li>
                              ))}
                            </ul>
                          )}
                        </DetailField>
                      </DetailPanel>
                    </>
                  )}
                </>
              ),
            },
            {
              id: 'locations',
              label: 'Locations',
              content: (
                <>
                  {' '}
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
                              <td>{location.label ?? 'Not recorded'}</td>
                              <td className="ds-mono">{location.role}</td>
                              <td className="ds-mono">{location.precision ?? 'Not recorded'}</td>
                              <td className="ds-mono">
                                {location.lat !== undefined && location.lng !== undefined
                                  ? `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
                                  : 'Not recorded'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                  <p className="entity-edit__hint ds-sans">
                    Locations are read-only here. Each row carries geometry, geohash, jurisdiction,
                    and validity fields that need a geocoding flow rather than a text box.
                  </p>
                </>
              ),
            },
            {
              id: 'merges',
              label: 'Merge history',
              content: (
                <>
                  {' '}
                  {merges.length > 0 ? (
                    <>
                      <h2 className="ds-section__title">Absorbed records</h2>
                      <p className="ds-sans">
                        This record survived{' '}
                        {merges.length === 1 ? 'a merge' : `${merges.length} merges`}. The absorbed
                        records are still in the archive, marked absorbed, and everything that could
                        move is now here.
                      </p>
                      {merges.map((merge) => (
                        <div key={merge.mergeId} className="entity-merge__record">
                          <p className="ds-sans">
                            {merge.absorbedIds.map((absorbedId, index) => (
                              <span key={absorbedId}>
                                {index > 0 ? ', ' : ''}
                                <Link href={`/admin/catalog/${encodeURIComponent(absorbedId)}`}>
                                  {absorbedId}
                                </Link>
                              </span>
                            ))}
                            {' · '}
                            {merge.reason}
                          </p>
                          <p className="entity-edit__hint ds-sans">
                            <span className="ds-mono">{merge.mergeId}</span> ·{' '}
                            {formatWhen(merge.createdAt)}
                          </p>
                          {merge.leftBehind.length > 0 ? (
                            <ul className="story-review__anchors">
                              {merge.leftBehind.map((entry, index) => (
                                <li key={`${merge.mergeId}-${index}`}>
                                  <span className="ds-mono">{entry.table}</span> · {entry.reason}
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {canMerge && merge.reversible ? (
                            <ReverseMergeForm mergeId={merge.mergeId} />
                          ) : canMerge ? (
                            <p className="entity-edit__hint ds-sans">
                              This merge predates the console&rsquo;s reversal record, so it cannot
                              be undone from here.
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </>
                  ) : null}
                  {!merges.length && <p>No merges recorded.</p>}
                </>
              ),
            },
          ]}
        />
      </section>
    </main>
  );
}

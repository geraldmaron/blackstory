/** Approved changes are applied with a complete immutable catalog and one atomic activation. */
import { createHash, createPrivateKey, createPublicKey } from 'node:crypto';
import type { PoolClient } from 'pg';
import {
  buildReleaseEntityArtifacts,
  buildReleaseManifest,
  signReleaseManifest,
  verifySignedReleaseManifest,
  sha256Json,
  type JsonValue,
  type CanonicalPromotionRecord,
} from '@repo/domain';
import { mapPostgresSearchIndexRow } from '@repo/schemas';
import { buildReleaseCatalogArtifacts } from '@repo/ops-data';
import {
  type ManagementWorkStore,
  WorkConflict,
  validateWorkProposal,
  workDigest,
} from '@repo/ops-data/management';
import { managementEntitySnapshot } from '@repo/ops-data/management/catalog';
import type { WorkItem, RecordChange } from '@repo/ops-data/management/contracts';
import {
  ensureNoCatalogDuplicate,
  insertCanonicalRecord,
  insertSourceAndEvidence,
} from '../cases/promote-case';
import { uploadArtifactJson } from '../../../../../packages/ops-data/scripts/lib/release-catalog-publish-upload';
import { toSearchIndexRow } from '../../../../../packages/ops-data/scripts/lib/incremental-publish';

type Json = Record<string, unknown>;
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
};
const quoteIdentifier = (value: string) => `"${value.replaceAll('"', '""')}"`;
const byteHash = (value: string) => createHash('sha256').update(value).digest('hex');

/** SQL identifier inputs come only from pg_catalog, never a research proposal. */
async function copyRelease(db: PoolClient, before: string, after: string): Promise<void> {
  const tables = await db.query<{
    table_name: string;
    columns: { name: string; type: string }[];
  }>(`SELECT table_name,
    jsonb_agg(jsonb_build_object('name',column_name,'type',udt_name) ORDER BY ordinal_position) AS columns
    FROM information_schema.columns WHERE table_schema='published' AND is_generated='NEVER'
      AND table_name IN (SELECT table_name FROM information_schema.tables WHERE table_schema='published' AND table_type='BASE TABLE')
      AND table_name IN (SELECT table_name FROM information_schema.columns
        WHERE table_schema='published' AND column_name='release_id' AND table_name<>'active_release') GROUP BY table_name`);
  for (const table of tables.rows) {
    const expressions = table.columns.map((column) => {
      const name = quoteIdentifier(column.name);
      if (column.name === 'release_id') return '$2::text';
      if (table.table_name === 'search_index' && column.name === 'id')
        return "$2 || ':' || entity_id";
      // Only the entity projection's release envelope changes. Other JSON may contain
      // historical release references or signed payloads whose bytes must remain intact.
      if (table.table_name === 'release_entities' && column.name === 'projection')
        return `jsonb_set(${name},'{releaseId}',to_jsonb($2::text))`;
      return name;
    });
    await db.query(
      `INSERT INTO published.${quoteIdentifier(table.table_name)} (${table.columns.map((c) => quoteIdentifier(c.name)).join(',')})
      SELECT ${expressions.join(',')} FROM published.${quoteIdentifier(table.table_name)} WHERE release_id=$1`,
      [before, after],
    );
  }
}

/** Locks owner and delegations until activation, making revocation serialize with execution. */
async function assertAuthority(db: PoolClient, work: WorkItem): Promise<void> {
  const owner = await db.query('SELECT research.management_owner_can_publish($1) AS allowed', [
    work.ownerId,
  ]);
  if (!owner.rows[0]?.allowed)
    throw new WorkConflict('Owner publication permission is no longer active');
  for (const entityId of work.approvedEntityIds) {
    const approval = await db.query(
      `SELECT d.*,p.proposal FROM research.management_work_decisions d
      JOIN research.management_work_proposals p ON p.work_id=d.work_id AND p.version=d.version AND p.proposal_hash=d.proposal_hash
      WHERE d.work_id=$1 AND d.owner_id=$2 AND $3=ANY(d.entity_ids) ORDER BY d.created_at DESC,d.id DESC LIMIT 1`,
      [work.id, work.ownerId, entityId],
    );
    const row = approval.rows[0];
    if (!row || row.action !== 'approve')
      throw new WorkConflict('Selected change has no current approval');
    const approved = validateWorkProposal(row.proposal).changes.find(
      (c) => c.entityId === entityId,
    );
    const selected = work.proposal!.changes.find((c) => c.entityId === entityId);
    if (workDigest(approved) !== workDigest(selected))
      throw new WorkConflict('Approved content changed');
    if (row.basis === 'agent_relay') {
      const delegation = await db.query(
        `SELECT id FROM research.management_delegations WHERE id=$1 AND owner_id=$2
        AND session_id=$3 AND revoked_at IS NULL AND expires_at>now() FOR SHARE`,
        [row.delegation_id, work.ownerId, row.session_id],
      );
      if (!delegation.rows.length) throw new WorkConflict('Agent approval was revoked or expired');
    }
  }
}

async function writeChange(
  db: PoolClient,
  change: RecordChange,
  work: WorkItem,
  now: string,
): Promise<void> {
  const record = change.record as CanonicalPromotionRecord;
  await db.query('SELECT id FROM canonical.entities WHERE id=$1 FOR UPDATE', [change.entityId]);
  const snapshot = await managementEntitySnapshot(db, change.entityId);
  if (change.operation === 'create') {
    if (snapshot) throw new WorkConflict('A proposed new record already exists');
    await ensureNoCatalogDuplicate(db, record);
    await insertCanonicalRecord(
      db,
      {
        caseId: work.id,
        record,
        approverUid: work.ownerId,
        approverEmail: '',
        reason: 'Approved management proposal',
      },
      'minimum_record',
      now,
    );
  } else {
    if (!snapshot || workDigest(snapshot) !== change.beforeHash)
      throw new WorkConflict('The canonical record changed after review');
    // Locations and existing claims need explicit changes, not replacement as a side effect of copy editing.
    if (record.location) {
      const matches = snapshot.locations.some(
        (location: Json) =>
          location.lat === record.location!.lat &&
          location.lng === record.location!.lng &&
          location.precision === record.location!.precision,
      );
      if (!matches)
        throw new WorkConflict(
          'A changed location requires a separately reviewed location revision',
        );
    }
    await db.query(
      `UPDATE canonical.entities SET display_name=$2,aliases=$3::jsonb,
      kind_detail=jsonb_set(jsonb_set(jsonb_set(kind_detail,'{editorial}',COALESCE(kind_detail->'editorial','{}'::jsonb)||$4::jsonb),
        '{classification}',COALESCE(kind_detail->'classification','{}'::jsonb)||$5::jsonb),'{jurisdiction}',COALESCE(kind_detail->'jurisdiction','{}'::jsonb)||$6::jsonb),updated_at=now() WHERE id=$1`,
      [
        record.entityId,
        record.displayName,
        JSON.stringify(record.aliases ?? snapshot.entity.aliases),
        JSON.stringify({ summary: record.summary }),
        JSON.stringify({
          topicIds: record.topicIds,
          topicTags: record.topicTags,
          eraBuckets: record.eraBuckets,
        }),
        JSON.stringify({ label: record.jurisdiction }),
      ],
    );
  }
  for (const assertion of change.assertions.filter((a) =>
    ['supported', 'qualified'].includes(a.finding),
  )) {
    const claimId = `management_${byteHash(`${work.id}:${change.entityId}:${assertion.id}`).slice(0, 32)}`;
    const versionId = `${claimId}_${byteHash(assertion.statement).slice(0, 16)}`;
    await db.query(
      `INSERT INTO canonical.claims(id,entity_id,claim_class,workflow_status,publication_status,procedural_status,confidence,verification)
      VALUES($1,$2,'standard','accepted','published','reviewed',$3::jsonb,$4::jsonb)`,
      [
        claimId,
        change.entityId,
        JSON.stringify({ level: 'unknown', basis: change.reviewBasis }),
        JSON.stringify({
          finding: assertion.finding,
          reasoning: assertion.reasoning,
          reviewBasis: change.reviewBasis,
          producer: change.producerActorId,
          reviewer: change.reviewerActorId,
          owner: work.ownerId,
        }),
      ],
    );
    await db.query(
      `INSERT INTO canonical.claim_versions(id,claim_id,predicate,object,workflow_status,publication_status,body,created_by)
      VALUES($1,$2,'documented_site',$3::jsonb,'accepted','published',$4::jsonb,$5)`,
      [
        versionId,
        claimId,
        JSON.stringify(assertion.statement),
        JSON.stringify({ workId: work.id, version: work.version, assertion }),
        work.ownerId,
      ],
    );
    await db.query('UPDATE canonical.claims SET current_version_id=$2 WHERE id=$1', [
      claimId,
      versionId,
    ]);
    for (const source of assertion.evidence) {
      const { evidenceId } = await insertSourceAndEvidence(
        db,
        {
          url: source.sourceUrl,
          title: source.title,
          excerpt: source.quote,
          fitness: source.fitness === 'conditional' ? 'weak' : source.fitness,
        },
        work.ownerId,
        now,
      );
      await db.query(
        `INSERT INTO canonical.claim_evidence_links(id,claim_id,claim_version_id,evidence_id,role,quality,asserted_value)
        VALUES($1,$2,$3,$4,'supporting',$5::jsonb,$6::jsonb) ON CONFLICT(id) DO NOTHING`,
        [
          `${versionId}_${byteHash(evidenceId).slice(0, 12)}`,
          claimId,
          versionId,
          evidenceId,
          JSON.stringify(source),
          JSON.stringify(assertion.statement),
        ],
      );
    }
  }
}

export async function publishManagementWork(
  store: ManagementWorkStore,
  work: WorkItem,
  lease: string,
): Promise<void> {
  const proposal = validateWorkProposal(work.proposal);
  if (workDigest(proposal) !== work.proposalHash || !work.approvedEntityIds.length)
    throw new WorkConflict('No exact approved proposal');
  const publishedIds = Array.isArray(work.outcome?.publishedEntityIds)
    ? (work.outcome.publishedEntityIds as string[])
    : [];
  const changes = proposal.changes.filter(
    (c) => work.approvedEntityIds.includes(c.entityId) && !publishedIds.includes(c.entityId),
  );
  if (changes.some((c) => c.blockers.length) || !changes.length)
    throw new WorkConflict('Approved selection is invalid');
  // Signing and deployment configuration must be available before making canonical changes.
  const privateKey = createPrivateKey(required('RELEASE_SIGNING_PRIVATE_KEY'));
  const publicPem = required('RELEASE_SIGNING_PUBLIC_KEY');
  const publicKey = createPublicKey(publicPem);
  if (
    privateKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1' ||
    publicKey.asymmetricKeyDetails?.namedCurve !== 'prime256v1' ||
    byteHash(publicPem) !== required('EXPECTED_RELEASE_SIGNING_PUBLIC_KEY_SHA256')
  )
    throw new Error('Release signing identity does not match the trusted registry');
  const storage = {
    supabaseUrl: required('SUPABASE_URL'),
    secretKey: required('SUPABASE_SECRET_KEY'),
    bucket: 'public-media',
    cacheControl: '31536000, immutable',
    immutable: true,
  };
  const keyId = required('RELEASE_SIGNING_KEY_ID');
  let releaseId =
    work.outcome?.verified === false && typeof work.outcome.releaseId === 'string'
      ? work.outcome.releaseId
      : '';
  if (!releaseId) {
    const base = await store.pool.query(
      "SELECT release_id FROM published.active_release WHERE id='active'",
    );
    const baseId = String(base.rows[0]?.release_id ?? '');
    const saved = work.outcome?.preparation as
      { baseId?: string; generatedAt?: string } | undefined;
    const generatedAt =
      saved?.baseId === baseId && saved.generatedAt ? saved.generatedAt : new Date().toISOString();
    releaseId = `rel_work_${work.id.replaceAll('-', '')}_${work.version}_${workDigest([work.approvedEntityIds, baseId]).slice(0, 8)}`;
    await store.pool.query(
      `UPDATE research.management_work SET outcome=COALESCE(outcome,'{}'::jsonb)||$3::jsonb
      WHERE id=$1 AND lease_token=$2`,
      [work.id, lease, JSON.stringify({ preparation: { baseId, generatedAt } })],
    );
    await store.transaction(async (db) => {
      await db.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE');
      await db.query(
        "SELECT pg_advisory_xact_lock(hashtextextended('publication-release-pointer',0))",
      );
      const locked = await db.query(
        `SELECT id FROM research.management_work WHERE id=$1 AND lease_token=$2 AND lease_until>now() AND state='publishing' FOR UPDATE`,
        [work.id, lease],
      );
      if (!locked.rows.length) throw new WorkConflict('Publication lease expired');
      await assertAuthority(db, work);
      const active = await db.query(
        "SELECT release_id FROM published.active_release WHERE id='active' FOR UPDATE",
      );
      const previous = active.rows[0]?.release_id;
      if (!previous) throw new Error('An existing catalog release is required');
      if (previous !== baseId)
        throw new WorkConflict(
          'The catalog changed during preparation; retry against the current release',
        );
      const now = generatedAt;
      await db.query(
        `INSERT INTO publication.releases(id,status,search_index_version,created_by,created_at)
        VALUES($1,'preview',$2,$3,$4)`,
        [releaseId, `search_${releaseId}`, work.ownerId, now],
      );
      await copyRelease(db, previous, releaseId);
      for (const change of changes) {
        const flags = await db.query(
          'SELECT decision FROM ops.catalog_decisions WHERE entity_id=$1 FOR SHARE',
          [change.entityId],
        );
        if (flags.rows[0] && flags.rows[0].decision !== 'clear_flag')
          throw new WorkConflict('An existing catalog hold requires resolution');
        await writeChange(db, change, work, now);
        const record = change.record;
        const old = await db.query(
          'SELECT projection FROM published.release_entities WHERE release_id=$1 AND entity_id=$2',
          [previous, change.entityId],
        );
        const existing = old.rows[0]?.projection ?? {};
        const oldSearch = await db.query(
          'SELECT * FROM published.search_index WHERE release_id=$1 AND entity_id=$2',
          [previous, change.entityId],
        );
        const claims = change.assertions
          .filter((a) => ['supported', 'qualified'].includes(a.finding))
          .map((assertion) => ({
            id: `management_${byteHash(`${work.id}:${change.entityId}:${assertion.id}`).slice(0, 32)}`,
            predicate: 'documented_site',
            object: assertion.statement,
            confidenceLevel: 'low' as const,
            citationSource: new URL(assertion.evidence[0]!.sourceUrl).hostname,
            citationHref: assertion.evidence[0]!.sourceUrl,
            citationLabel: assertion.evidence[0]!.title,
          }));
        const built = buildReleaseEntityArtifacts(
          {
            id: record.entityId,
            kind: existing.kind ?? 'place',
            displayName: record.displayName,
            summary: record.summary,
            jurisdictionLabel: record.jurisdiction,
            locationLabel: record.location?.label ?? record.jurisdiction,
            locationPrecision: record.location?.precision ?? 'unknown',
            ...(record.location ? { lat: record.location.lat, lng: record.location.lng } : {}),
            eraBuckets: record.eraBuckets,
            topicIds: record.topicIds,
            topicTags: record.topicTags,
            claims,
          },
          {
            releaseId,
            generatedAt: now,
            ...(record.location
              ? { locationOverride: { ...record.location, locationLabel: record.location.label } }
              : {}),
          },
        );
        if (!built.ok) throw new WorkConflict(built.message);
        const projection = {
          ...built.projection,
          ...existing,
          id: record.entityId,
          releaseId,
          displayName: record.displayName,
          nameLower: record.displayName.toLowerCase(),
          summary: record.summary,
          jurisdictionLabel: record.jurisdiction,
          topicTags: record.topicTags,
          topicIds: record.topicIds,
          eraBuckets: record.eraBuckets,
          generatedAt: now,
          recordUpdatedAt: now,
          claims: [...(existing.claims ?? []), ...built.projection.claims],
          claimIds: [...(existing.claimIds ?? []), ...built.projection.claimIds],
          related: existing.related ?? [],
          ...(record.location ? {} : existing.location ? { location: existing.location } : {}),
        };
        const search = toSearchIndexRow(
          {
            ...built.searchIndex,
            ...(existing.status ? { status: existing.status } : {}),
            claimCount: projection.claims.length,
            relatedCount: projection.related.length,
          },
          projection.location?.geohash ?? null,
        );
        await db.query(
          `INSERT INTO published.release_entities(release_id,entity_id,projection) VALUES($1,$2,$3::jsonb)
          ON CONFLICT(release_id,entity_id) DO UPDATE SET projection=EXCLUDED.projection`,
          [releaseId, change.entityId, JSON.stringify(projection)],
        );
        await db.query('DELETE FROM published.search_index WHERE release_id=$1 AND entity_id=$2', [
          releaseId,
          change.entityId,
        ]);
        await db.query(
          `INSERT INTO published.search_index(id,release_id,entity_id,name,name_lower,aliases,topics,kind,status,geohash,related_count,claim_count,facets)
          VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
          [
            search.id,
            releaseId,
            change.entityId,
            search.name,
            search.name_lower,
            record.aliases ?? oldSearch.rows[0]?.aliases ?? [],
            search.topics,
            search.kind,
            search.status,
            search.geohash,
            search.related_count,
            search.claim_count,
            JSON.stringify({
              ...(search.facets as Json),
              ...oldSearch.rows[0]?.facets,
              eraBuckets: record.eraBuckets,
              topicIds: record.topicIds,
              jurisdictionState: record.jurisdiction,
              evidenceInputs: (search.facets as Json).evidenceInputs,
            }),
          ],
        );
      }
      const rows = await db.query<{ projection: JsonValue }>(
        'SELECT projection FROM published.release_entities WHERE release_id=$1 ORDER BY entity_id',
        [releaseId],
      );
      const search = await db.query(
        'SELECT * FROM published.search_index WHERE release_id=$1 ORDER BY id',
        [releaseId],
      );
      const artifacts = buildReleaseCatalogArtifacts({
        releaseId,
        generatedAt: now,
        projections: rows.rows.map((r) => r.projection),
        searchDocs: search.rows.map((r) => {
          const mapped = mapPostgresSearchIndexRow(r);
          if (!mapped) throw new Error('Invalid search projection');
          return mapped as unknown as JsonValue;
        }),
      });
      const manifest = signReleaseManifest(
        buildReleaseManifest({
          releaseId,
          generatedAt: now,
          searchIndexVersion: `search_${releaseId}`,
          artifacts: rows.rows.map(({ projection }) => ({
            entityId: String((projection as Json).id),
            revision: sha256Json(projection).digest,
            projection,
            snapshot: { schemaVersion: 1, releaseId, entity: projection },
          })),
        }),
        { privateKey, keyId },
      );
      if (!verifySignedReleaseManifest(manifest, publicKey))
        throw new Error('Release signature verification failed');
      for (const [path, artifact] of [
        [artifacts.entitiesListPath, artifacts.entitiesList],
        [artifacts.searchIndexPath, artifacts.searchIndex],
        ...rows.rows.flatMap(({ projection }) => {
          const entry = manifest.manifest.entries.find(
            (entry) => entry.entityId === String((projection as Json).id),
          );
          if (!entry) throw new Error('Entity is missing from the release manifest');
          return [
            [entry.snapshotPath, { schemaVersion: 1, releaseId, entity: projection }],
            [entry.projectionPath, projection],
          ] as const;
        }),
      ] as const) {
        const body = `${JSON.stringify(artifact)}\n`;
        await uploadArtifactJson(path, body, storage);
        const readback = await fetch(
          `${storage.supabaseUrl}/storage/v1/object/public/${storage.bucket}/${path}`,
          { signal: AbortSignal.timeout(60000) },
        );
        if (!readback.ok || byteHash(await readback.text()) !== byteHash(body))
          throw new Error('Release artifact readback failed');
      }
      await db.query('UPDATE publication.releases SET signed_manifest=$2::jsonb WHERE id=$1', [
        releaseId,
        JSON.stringify({
          manifest: manifest.manifest,
          signature: manifest.signature,
          manifestHash: manifest.manifestHash.digest,
          manifestHashAlgorithm: 'sha256',
        }),
      ]);
      // Never mutate an existing signed manifest to invent a mobile bootstrap.
      const mobile = await db.query(
        "SELECT name FROM published.materialized_snapshots WHERE name='mobileReleasePointer'",
      );
      if (mobile.rows.length)
        throw new WorkConflict(
          'Configured mobile release requires a compatible signed mobile artifact',
        );
      await assertAuthority(db, work);
      await db.query('SELECT publication.activate_release($1)', [releaseId]);
      await db.query(
        `UPDATE research.management_work SET outcome=$3::jsonb,lease_until=now()+interval '5 minutes'
        WHERE id=$1 AND lease_token=$2`,
        [
          work.id,
          lease,
          JSON.stringify({
            releaseId,
            previousReleaseId: previous,
            entityIds: changes.map((c) => c.entityId),
            publishedEntityIds: publishedIds,
            links: work.outcome?.links ?? [],
            verified: false,
          }),
        ],
      );
    });
  }
  try {
    await verifyPublicResult(releaseId, changes);
    await store.pool.query(
      `UPDATE research.management_work SET state=$4,outcome=outcome||$3::jsonb,
      error=NULL,lease_token=NULL,lease_until=NULL,updated_at=now() WHERE id=$1 AND lease_token=$2`,
      [
        work.id,
        lease,
        JSON.stringify({
          verified: true,
          verifiedAt: new Date().toISOString(),
          publishedEntityIds: [...publishedIds, ...changes.map((c) => c.entityId)],
          links: [
            ...(Array.isArray(work.outcome?.links) ? work.outcome.links : []),
            ...changes.map((c) => ({
              entityId: c.entityId,
              title: c.record.displayName,
              url: `https://blackstory.app/entity/${encodeURIComponent(c.entityId)}`,
            })),
          ],
          heldEntityIds: proposal.changes
            .filter((c) => !work.approvedEntityIds.includes(c.entityId))
            .map((c) => c.entityId),
        }),
        proposal.changes.some(
          (c) =>
            !publishedIds.includes(c.entityId) &&
            !work.approvedEntityIds.includes(c.entityId) &&
            !c.blockers.length,
        )
          ? 'awaiting_review'
          : 'published',
      ],
    );
  } catch {
    await store.fail(
      work.id,
      lease,
      'The release was activated, but public verification failed. Retry verification from this request.',
      true,
    );
  }
}

async function verifyPublicResult(
  releaseId: string,
  changes: readonly RecordChange[],
): Promise<void> {
  const headers = { 'X-BlackStory-Client': 'management/1.0.0; api=1' };
  const mapResponse = await fetch('https://api.blackstory.app/v1/map', {
    headers,
    cache: 'no-store',
    signal: AbortSignal.timeout(30000),
  });
  if (!mapResponse.ok) throw new Error('Public map unavailable');
  const map = await mapResponse.json();
  if (map.releaseId !== releaseId || !Array.isArray(map.features))
    throw new Error('Public map has not served the approved release');
  for (const change of changes) {
    const api = await fetch(
      `https://api.blackstory.app/v1/entity/${encodeURIComponent(change.entityId)}`,
      { headers, cache: 'no-store', signal: AbortSignal.timeout(30000) },
    );
    if (!api.ok) throw new Error('Public entity API unavailable');
    const body = await api.json();
    if (body.revision?.releaseId !== releaseId || body.summary !== change.record.summary)
      throw new Error('Public API has not served the approved revision');
    const feature = map.features.find(
      (row: { properties?: { entityId?: string } }) => row.properties?.entityId === change.entityId,
    );
    if (body.geoAnchor) {
      if (
        !feature ||
        feature.properties.displayName !== change.record.displayName ||
        feature.properties.precision !== body.locationPrecision ||
        feature.geometry?.coordinates?.[0] !== body.geoAnchor.lng ||
        feature.geometry?.coordinates?.[1] !== body.geoAnchor.lat
      )
        throw new Error('Public map does not match the approved public location');
    } else if (feature) throw new Error('An unlocated record has a public map point');
    const searchResponse = await fetch(
      `https://api.blackstory.app/v1/search?q=${encodeURIComponent(change.record.displayName)}&pageSize=100`,
      {
        headers,
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      },
    );
    if (!searchResponse.ok) throw new Error('Public search unavailable');
    const search = await searchResponse.json();
    const found = search.results?.find((row: { id: string }) => row.id === change.entityId);
    if (
      !found ||
      found.displayName !== change.record.displayName ||
      found.summary !== change.record.summary
    )
      throw new Error('Public search does not contain the approved record');
    const page = await fetch(
      `https://blackstory.app/entity/${encodeURIComponent(change.entityId)}`,
      { cache: 'no-store', signal: AbortSignal.timeout(30000) },
    );
    if (!page.ok) throw new Error('Public page unavailable');
    const html = await page.text();
    if (
      !html.includes(change.record.displayName) ||
      !html.includes(
        change.record.summary
          .replaceAll('&', '&amp;')
          .replaceAll('<', '&lt;')
          .replaceAll('>', '&gt;'),
      )
    )
      throw new Error('Public page does not contain the record');
  }
}

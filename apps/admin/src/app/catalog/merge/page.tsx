/**
 * Merge review — what the operator sees before two records become one.
 *
 * Reached from the workbench with a selection (`/catalog/merge?ids=a,b,c`). The page is a preview:
 * it shows the weight of each candidate so the survivor is chosen on evidence, and it names the
 * collisions up front, because those are the rows that will *not* move and an operator who finds
 * that out afterwards has already lost the thread.
 */
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readVerifiedAdminIdentity } from '../../../auth/supabase-server';
import { staffRoleHasPermission } from '../../../auth/staff-permissions';
import { readMergeCandidates } from '../../../lib/entity-merge';
import { MAX_ABSORBED_PER_MERGE } from '../../../lib/entity-merge-plan';
import { readPostgresOrDegrade } from '../../../lib/postgres-client';
import { MergeForm } from './MergeForm';

function parseIds(raw: string | string[] | undefined): readonly string[] {
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return [
    ...new Set(
      values
        .flatMap((value) => value.split(','))
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];
}

export default async function MergePage({
  searchParams,
}: {
  readonly searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const ids = parseIds(params.ids);

  const identity = await readVerifiedAdminIdentity();
  if (!identity) notFound();

  if (!staffRoleHasPermission(identity.role, 'canonical:merge')) {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <h1 className="ds-page__title">Merge records</h1>
        <p className="story-review__alert" role="alert">
          Your role ({identity.role}) cannot merge canonical records. Merging needs canonical:merge.
        </p>
        <p className="story-review__notice">
          <Link href="/catalog">← Back to catalog</Link>
        </p>
      </main>
    );
  }

  if (ids.length < 2) {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <h1 className="ds-page__title">Merge records</h1>
        <p className="ds-sans">
          Select two or more records in the catalog, then choose Merge. A merge needs at least one
          record to absorb and one to survive.
        </p>
        <p className="story-review__notice">
          <Link href="/catalog">← Back to catalog</Link>
        </p>
      </main>
    );
  }

  const outcome = await readPostgresOrDegrade(() => readMergeCandidates(ids), 'merge candidates');
  if (outcome.status === 'degraded') {
    return (
      <main className="story-review ds-container ds-page" id="main">
        <h1 className="ds-page__title">Merge records</h1>
        <p className="story-review__alert" role="alert">
          The catalog database did not answer, so these records could not be loaded. Reload to
          retry. <span className="ds-mono">{outcome.reason}</span>
        </p>
      </main>
    );
  }

  const candidates = outcome.value;
  const missing = ids.filter((id) => !candidates.some((candidate) => candidate.id === id));
  // Candidates come back heaviest first, which is the survivor an operator picks most of the time.
  const defaultSurvivor = candidates.find((candidate) => !candidate.absorbedBy);

  return (
    <main className="story-review ds-container ds-page" id="main">
      <header className="story-review__header">
        <div>
          <p className="ds-page__eyebrow">Canonical catalog</p>
          <h1 className="ds-page__title">Merge {candidates.length} records</h1>
          <p className="ds-page__lede">
            The survivor keeps its own name, kind, and sensitivity. Everything the absorbed records
            own — claims, relationships, event participation, identifiers, locations, aliases —
            moves to it. Nothing is deleted: the absorbed records stay in the archive, marked
            absorbed, and the merge can be reversed from the survivor&rsquo;s page.
          </p>
          <p className="story-review__notice">
            <Link href="/catalog">← Back to catalog</Link>
          </p>
        </div>
      </header>

      {missing.length > 0 ? (
        <p className="story-review__alert" role="alert">
          Not in the catalog and dropped from this merge:{' '}
          <span className="ds-mono">{missing.join(', ')}</span>
        </p>
      ) : null}

      {ids.length > MAX_ABSORBED_PER_MERGE + 1 ? (
        <p className="story-review__alert" role="alert">
          A single merge absorbs at most {MAX_ABSORBED_PER_MERGE} records. Narrow the selection.
        </p>
      ) : null}

      <section className="story-review__detail" aria-label="Choose survivor">
        {candidates.length < 2 ? (
          <p className="story-review__alert" role="alert">
            Fewer than two of the selected records exist, so there is nothing to merge.
          </p>
        ) : (
          <MergeForm candidates={candidates} defaultSurvivorId={defaultSurvivor?.id ?? ''} />
        )}
      </section>
    </main>
  );
}

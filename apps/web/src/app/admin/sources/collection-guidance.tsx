/** Versioned collection profiles follow docs/ui/patterns-source-library.md. Server-only. */
import type { SourceLibraryResult } from '@repo/ops-data/source-library';
export function CollectionGuidance({ result }: { result: SourceLibraryResult }) {
  const offset = result.query.offset ?? 0,
    limit = result.query.limit ?? 20;
  const pageHref = (next: number) => {
    const params = new URLSearchParams(
      Object.entries({ ...result.query, offset: next }).map(([key, value]) => [key, String(value)]),
    );
    return `/admin/sources?${params}`;
  };
  return (
    <section aria-labelledby="collections-title" className="story-review__queue">
      <h2 id="collections-title">Collections for research</h2>
      <p>
        Choose collections for the evidence you need. Inspect each document and its context before
        using it to support an assertion.
      </p>
      <form
        className="ds-toolbar"
        action="/admin/sources"
        method="get"
        role="search"
        aria-label="Find collections"
      >
        <label className="ds-toolbar__field">
          <span className="ds-toolbar__field-label">Research question</span>
          <input
            name="question"
            type="search"
            defaultValue={result.query.question ?? ''}
            placeholder="School buildings, community memory, legal records…"
          />
        </label>
        <label className="ds-toolbar__field">
          <span className="ds-toolbar__field-label">Evidence need</span>
          <select name="assertionClass" defaultValue={result.query.assertionClass ?? ''}>
            <option value="">Any evidence need</option>
            {[
              'record_fact',
              'technical_identity',
              'community_identity',
              'biographical_fact',
              'chronology',
              'place',
              'relationship',
              'legal_status',
              'lived_experience',
              'historical_synthesis',
              'superlative',
            ].map((value) => (
              <option key={value} value={value}>
                {value.replaceAll('_', ' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="ds-toolbar__field">
          <span className="ds-toolbar__field-label">Geography</span>
          <input
            name="geography"
            defaultValue={result.query.geography ?? ''}
            placeholder="State, city or region"
          />
        </label>
        <div className="ds-toolbar__actions">
          <button className="ds-button ds-button--secondary" type="submit">
            Find collections
          </button>
          <a className="ds-button ds-button--secondary" href="/admin/sources">
            Clear
          </a>
        </div>
      </form>
      <p role="status">
        {result.total.toLocaleString()} matching collections. Citation usage is shown separately
        below.
      </p>
      {!result.items.length ? (
        <p>No matching collection guidance. Broaden the query and search beyond the library.</p>
      ) : (
        result.items.map((item) => (
          <article key={`${item.policyId}:${item.policyVersion}`} className="story-review__notice">
            <h3>{item.collection}</h3>
            <p>
              {item.publisher ?? 'Publisher association not established'} ·{' '}
              {item.guidance.reviewStatus.replaceAll('_', ' ')} · Version {item.policyVersion}
            </p>
            {!!item.matchReasons.length && <p>{item.matchReasons.join('. ')}.</p>}
            <p>
              <strong>Useful for:</strong>{' '}
              {item.guidance.suitableEvidenceNeeds
                .map((need) => need.replaceAll('_', ' '))
                .join(', ')}
            </p>
            <p>
              <strong>Limits:</strong> {item.guidance.limitations.join(' ')}
            </p>
            <details>
              <summary>Search methods, coverage and provenance</summary>
              <p>
                <strong>Coverage:</strong> {item.guidance.subjects.join(', ')}.{' '}
                {item.guidance.geography.join(', ')}. {item.guidance.periods.join(', ')}.
              </p>
              <ul>
                {item.guidance.searchMethods.map((method) => (
                  <li key={method}>{method}</li>
                ))}
              </ul>
              <p>
                <strong>Access:</strong> {item.guidance.accessConditions}
              </p>
              <p>
                <strong>Preservation:</strong> {item.guidance.preservationConditions}
              </p>
              <ul>
                {item.guidance.provenance.map((url) => (
                  <li key={url}>
                    <a href={url} rel="noreferrer">
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
              <p className="ds-mono">
                {item.policyId} · {item.guidance.reviewedAt ?? 'No completed profile review'}
              </p>
            </details>
          </article>
        ))
      )}
      <nav aria-label="Collection pages" className="ds-toolbar__actions">
        {offset > 0 && (
          <a
            className="ds-button ds-button--secondary"
            href={pageHref(Math.max(0, offset - limit))}
          >
            Previous collections
          </a>
        )}
        {result.nextOffset !== null && (
          <a className="ds-button ds-button--secondary" href={pageHref(result.nextOffset)}>
            Next collections
          </a>
        )}
      </nav>
    </section>
  );
}

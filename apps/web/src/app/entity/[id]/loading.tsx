/**
 * Pending UI while an entity record streams (including story → related entity).
 */
export default function EntityRecordLoading() {
  return (
    <main className="ds-container ds-page" id="main" aria-busy="true" aria-live="polite">
      <p className="ds-page__eyebrow">Record</p>
      <h1 className="ds-page__title">Opening record…</h1>
      <div className="ds-loading" aria-hidden="true">
        <div className="ds-loading__bar ds-loading__bar--wide" />
        <div className="ds-loading__bar" />
        <div className="ds-loading__bar" />
      </div>
    </main>
  );
}

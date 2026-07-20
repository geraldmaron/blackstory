/**
 * Pending UI while a story article streams.
 */
export default function StoryArticleLoading() {
  return (
    <main className="ds-container ds-page" id="main" aria-busy="true" aria-live="polite">
      <p className="ds-page__eyebrow">Story</p>
      <h1 className="ds-page__title">Opening story…</h1>
      <div className="ds-loading" aria-hidden="true">
        <div className="ds-loading__bar ds-loading__bar--wide" />
        <div className="ds-loading__bar" />
        <div className="ds-loading__bar" />
      </div>
    </main>
  );
}

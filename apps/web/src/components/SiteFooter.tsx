/**
 * Public site footer — inverse news masthead close.
 */

export function SiteFooter() {
  return (
    <footer className="bb-shell-footer">
      <div className="bb-container bb-shell-footer__inner">
        <p className="bb-shell-footer__brand">Black Book</p>
        <p className="bb-shell-footer__tagline bb-sans">
          Place-connected Black history — released projections only, with visible provenance and
          confidence.
        </p>
        <nav aria-label="Footer">
          <ul className="bb-shell-footer__links">
            <li>
              <a href="/methodology">Methodology</a>
            </li>
            <li>
              <a href="/about">About</a>
            </li>
            <li>
              <a href="/corrections">Corrections</a>
            </li>
            <li>
              <a href="/design-system">Design system</a>
            </li>
          </ul>
        </nav>
        <p className="bb-shell-footer__meta bb-mono">
          Public shell · BB-048 · no authentication required
        </p>
      </div>
    </footer>
  );
}

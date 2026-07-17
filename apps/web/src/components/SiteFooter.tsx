/**
 * Public site footer — inverse news masthead close.
 */

import { FOOTER_NAV } from '../lib/nav';

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
            {FOOTER_NAV.map((item) => (
              <li key={item.href}>
                <a href={item.href}>{item.label}</a>
              </li>
            ))}
          </ul>
        </nav>
        <p className="bb-shell-footer__meta bb-mono">
          Public shell · sample seed data · BB-048 · no authentication required
        </p>
      </div>
    </footer>
  );
}

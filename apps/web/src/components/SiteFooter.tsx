/**
 * Public site footer — Black Ink always, independent of the reader's light/dark theme.
 */

import { FOOTER_NAV_COLUMNS } from '../lib/nav';

export function SiteFooter() {
  return (
    <footer className="bb-shell-footer">
      <div className="bb-container bb-shell-footer__inner">
        <div className="bb-shell-footer__mast">
          <img
            className="bb-shell-footer__mark"
            src="/brand/black-book-mark-dark.svg"
            alt=""
            aria-hidden="true"
          />
          <div>
            <p className="bb-shell-footer__core">History, pinned to place.</p>
            <p className="bb-shell-footer__support">People. Places. Evidence. Context.</p>
          </div>
        </div>

        <nav aria-label="Footer" className="bb-shell-footer__columns">
          {FOOTER_NAV_COLUMNS.map((column) => (
            <div key={column.title} className="bb-shell-footer__column">
              <p className="bb-shell-footer__column-title">{column.title}</p>
              <ul className="bb-shell-footer__links">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <a href={item.href}>{item.label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <p className="bb-shell-footer__meta bb-mono">
          Public shell · released projections only, with visible provenance and confidence · no
          authentication required
        </p>
      </div>
    </footer>
  );
}

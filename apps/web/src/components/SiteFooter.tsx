/**
 * Public site footer — Black Ink always, closed by the kit lockup at
 * landmark scale (the page signs off with the brand, not a fine-print row).
 * Admin login lives in the shared island "More" menu for consistent traversal.
 */

import Link from 'next/link';
import { FOOTER_NAV_COLUMNS } from '../lib/nav';

export function SiteFooter() {
  return (
    <footer className="ds-shell-footer">
      <div className="ds-container ds-shell-footer__inner">
        <div className="ds-shell-footer__mast">
          <p className="ds-shell-footer__support">People. Places. Evidence. Context.</p>
          <p className="ds-shell-footer__core">History, pinned to place.</p>
        </div>

        <nav aria-label="Footer" className="ds-shell-footer__columns">
          {FOOTER_NAV_COLUMNS.map((column) => (
            <div key={column.title} className="ds-shell-footer__column">
              <p className="ds-shell-footer__column-title">{column.title}</p>
              <ul className="ds-shell-footer__links">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="ds-shell-footer__wordmark-slot">
          <img
            className="ds-shell-footer__wordmark"
            src="/brand/lockup-dark.png"
            alt=""
            aria-hidden="true"
          />
        </div>

        <p className="ds-shell-footer__meta ds-mono">
          Public shell · released projections only, with visible provenance and confidence · no
          authentication required
        </p>
      </div>
    </footer>
  );
}

/**
 * Public site footer — Black Ink always, independent of the reader's light/dark theme.
 */

import Link from 'next/link';
import { FOOTER_NAV_COLUMNS } from '../lib/nav';

export function SiteFooter() {
  return (
    <footer className="bp-shell-footer">
      <div className="bp-container bp-shell-footer__inner">
        <div className="bp-shell-footer__mast">
          <img
            className="bp-shell-footer__mark"
            src="/brand/blap-mark-dark.svg"
            alt=""
            aria-hidden="true"
          />
          <div>
            <p className="bp-shell-footer__core">History, pinned to place.</p>
            <p className="bp-shell-footer__support">People. Places. Evidence. Context.</p>
          </div>
        </div>

        <nav aria-label="Footer" className="bp-shell-footer__columns">
          {FOOTER_NAV_COLUMNS.map((column) => (
            <div key={column.title} className="bp-shell-footer__column">
              <p className="bp-shell-footer__column-title">{column.title}</p>
              <ul className="bp-shell-footer__links">
                {column.items.map((item) => (
                  <li key={item.href}>
                    <Link href={item.href}>{item.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <p className="bp-shell-footer__meta bp-mono">
          Public shell · released projections only, with visible provenance and confidence · no
          authentication required
        </p>
      </div>
    </footer>
  );
}

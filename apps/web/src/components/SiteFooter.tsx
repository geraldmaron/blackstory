/**
 * Public site footer — theme-aware Surface card with typographic wordmark, three job
 * columns (Explore / Trust / Contribute from shared shell IA), hairline link rows, and
 * maker credit. Follows v6 home edition card law sitewide; not a fixed-ink band.
 */

import Link from 'next/link';
import React from 'react';
import { PRODUCT_NAME } from '@repo/config';
import { footerColumns } from '../lib/nav/destination-registry';
import { MakerCredit } from './MakerCredit';

void React;

export function SiteFooter() {
  const year = new Date().getFullYear();
  // Derived from the destination registry, not authored here. The hand-written list is why this
  // footer went on linking `/history` for months after that route became a redirect — every page
  // on the site shipped a link into a 308. A route now joins the footer by having a group.
  const columns = footerColumns();

  return (
    <footer className="ds-shell-footer">
      <div className="ds-shell-footer__card">
        <div className="ds-shell-footer__inner">
          <div className="ds-shell-footer__mast">
            <p className="ds-shell-footer__wordmark">{PRODUCT_NAME}</p>
            <p className="ds-shell-footer__tagline">People. Places. Evidence. Context.</p>
          </div>

          <nav aria-label="Footer" className="ds-shell-footer__columns">
            {columns.map((column) => (
              <div key={column.title} className="ds-shell-footer__column">
                <p className="ds-shell-footer__column-title">{column.title}</p>
                <ul className="ds-shell-footer__links">
                  {column.items.map((item) => (
                    <li key={item.href}>
                      {/* Footer nav mounts on every route; skip the default viewport prefetch
                          so it doesn't compete with whatever the current page actually needs. */}
                      <Link href={item.href} prefetch={false}>
                        {item.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="ds-shell-footer__meta-row">
            <p className="ds-shell-footer__meta ds-mono">
              © {year} {PRODUCT_NAME} · History, pinned to place.
            </p>
            <MakerCredit variant="footer" className="ds-shell-footer__maker" />
          </div>
        </div>
      </div>
    </footer>
  );
}

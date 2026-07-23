/**
 * Public site footer — theme-aware Surface card with typographic wordmark, three job
 * columns (Explore / Trust / Contribute from shared shell IA), hairline link rows, and
 * maker credit. Follows v6 home edition card law sitewide; not a fixed-ink band.
 */

import Link from 'next/link';
import React from 'react';
import { PRODUCT_NAME } from '@repo/config';
import { FOOTER_NAV_COLUMNS } from '../lib/nav';
import { MakerCredit } from './MakerCredit';

void React;

export function SiteFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="ds-shell-footer">
      <div className="ds-shell-footer__card">
        <div className="ds-shell-footer__inner">
          <div className="ds-shell-footer__mast">
            <p className="ds-shell-footer__wordmark">{PRODUCT_NAME}</p>
            <p className="ds-shell-footer__tagline">People. Places. Evidence. Context.</p>
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

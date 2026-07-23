/**
 * Public site footer — fixed-ink band sign-off with paper copy and the kit lockup at
 * landmark scale (the page closes with the brand, not a fine-print row).
 * Maker credit links to geralddagher.com with dark-canvas GD marks.
 * Admin login lives in the shared island "More" menu for consistent traversal.
 */

import Link from 'next/link';
import React from 'react';
import { BRAND_ASSETS } from '@repo/config';
import { FOOTER_NAV_COLUMNS } from '../lib/nav';
import { MakerCredit } from './MakerCredit';

void React;

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
          {/* Brand lockup is served as static PNG artwork, not next/image. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ds-shell-footer__wordmark ds-shell-footer__wordmark--theme-light"
            src={BRAND_ASSETS.lockup.light}
            alt=""
            aria-hidden="true"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="ds-shell-footer__wordmark ds-shell-footer__wordmark--theme-dark"
            src={BRAND_ASSETS.lockup.dark}
            alt=""
            aria-hidden="true"
          />
        </div>

        <div className="ds-shell-footer__meta-row">
          <p className="ds-shell-footer__meta ds-mono">
            Public shell · released projections only, with visible provenance and confidence · no
            authentication required
          </p>
          <MakerCredit variant="footer" className="ds-shell-footer__maker" />
        </div>
      </div>
    </footer>
  );
}

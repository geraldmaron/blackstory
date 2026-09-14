/**
 * Public site footer — theme-aware Surface card with typographic wordmark, the
 * same three room groups as `/about`, hairline link rows, and maker credit.
 */

import Link from 'next/link';
import React from 'react';
import { PRODUCT_NAME } from '@repo/config';
import { footerColumns, policyLinks } from '../lib/nav/destination-registry';
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
            <p className="ds-shell-footer__wordmark">
              <Link href="/" prefetch={false} aria-label="BlackStory">
                {PRODUCT_NAME}
              </Link>
            </p>
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
            {/* Policy links ride the fine-print row rather than the nav columns above: they are
                the conventional place a reader looks for them, and a policy page is not somewhere
                the archive sends anyone browsing. Before this they were in no chrome at all. */}
            <nav aria-label="Policies" className="ds-shell-footer__policy ds-mono">
              {policyLinks().map((item) => (
                <Link key={item.href} href={item.href} prefetch={false}>
                  {item.label}
                </Link>
              ))}
            </nav>
            <MakerCredit variant="footer" className="ds-shell-footer__maker" />
            <Link
              className="ds-shell-footer__operator ds-shell-footer__staff ds-mono"
              href="/admin/login"
              rel="nofollow"
              prefetch={false}
            >
              Staff sign-in
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}

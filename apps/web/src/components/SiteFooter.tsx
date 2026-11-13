/**
 * Public site footer: a full-bleed copper block closing on a sand band.
 *
 * The copper block carries the core line at display scale, a paper sheet holding the lockup and
 * one sentence (the site's AI disclosure), and the destination links in columns under
 * sentence-case headings. The lockup sits on paper because its copper pin would vanish on copper.
 * The sand band carries copyright, the policy pages, the maker credit and staff sign-in.
 */

import Link from 'next/link';
import React from 'react';
import { BRAND_ASSETS, PRODUCT_NAME } from '@repo/config';
import { Sheet, ShellWordmark } from '@repo/ui';
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
    <footer className="ds-shell-footer" data-ground="copper">
      <div className="ds-shell-footer__inner">
        <p className="ds-shell-footer__line">History, pinned to place.</p>
        <div className="ds-shell-footer__top">
          <Sheet className="ds-shell-footer__mast">
            <Link
              className="ds-shell-footer__brand ds-shell-wordmark"
              href="/"
              prefetch={false}
              aria-label={`${PRODUCT_NAME}, home`}
            >
              <ShellWordmark lockup={BRAND_ASSETS.lockup} />
            </Link>
            {/* The one place the site says AI is part of the research and the checking. Record
                pages carry no per-record note about it; this line, the FAQ and the methodology
                say it for every page. */}
            <p className="ds-shell-footer__note">
              AI helps with the research and drafting here, and for most records a model from
              another company checks proposed claims against the sources they link to.{' '}
              <Link href="/methodology#how-a-record-gets-in" prefetch={false}>
                How a record gets in
              </Link>
            </p>
          </Sheet>

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
        </div>
      </div>

      <div className="ds-shell-footer__legal" data-ground="sand">
        <div className="ds-shell-footer__meta-row">
          <p className="ds-shell-footer__meta">
            © {year} {PRODUCT_NAME}
          </p>
          <nav aria-label="Policies" className="ds-shell-footer__policy">
            {policyLinks().map((item) => (
              <Link key={item.href} href={item.href} prefetch={false}>
                {item.label}
              </Link>
            ))}
          </nav>
          <MakerCredit variant="footer" />
          <Link
            className="ds-shell-footer__operator"
            href="/admin/login"
            rel="nofollow"
            prefetch={false}
          >
            Staff sign-in
          </Link>
        </div>
      </div>
    </footer>
  );
}

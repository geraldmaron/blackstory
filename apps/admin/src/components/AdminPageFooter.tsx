/**
 * Admin shell footer — console destinations plus public-site handoff links.
 */
import Link from 'next/link';
import { adminPublicSiteHref } from '../lib/sibling-origins';

export type AdminPageFooterProps = {
  /** When true, show signed-in destinations; when false, show Sign in. */
  readonly signedIn?: boolean;
};

export function AdminPageFooter({ signedIn = false }: AdminPageFooterProps) {
  const publicHome = adminPublicSiteHref('/');
  const publicStories = adminPublicSiteHref('/stories');
  const publicExplore = adminPublicSiteHref('/explore');

  return (
    <footer className="admin-footer">
      <div className="admin-footer__inner">
        <p className="admin-footer__brand">
          BlackStory Admin · History, pinned to place.
        </p>
        <nav className="admin-footer__nav" aria-label="Admin footer">
          <ul className="admin-footer__links">
            {signedIn ? (
              <>
                <li>
                  <Link href="/stories/review">Story review</Link>
                </li>
                <li>
                  <Link href="/quick-add">Quick add</Link>
                </li>
                <li>
                  <Link href="/">Admin home</Link>
                </li>
              </>
            ) : (
              <li>
                <Link href="/login">Sign in</Link>
              </li>
            )}
            {publicExplore ? (
              <li>
                <a href={publicExplore}>Explore</a>
              </li>
            ) : null}
            {publicStories ? (
              <li>
                <a href={publicStories}>Public stories</a>
              </li>
            ) : null}
            {publicHome ? (
              <li>
                <a href={publicHome}>Public site</a>
              </li>
            ) : null}
          </ul>
        </nav>
      </div>
    </footer>
  );
}

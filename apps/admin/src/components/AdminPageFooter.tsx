/**
 * Admin shell footer — ops-first signed-in destinations, then public-site handoffs.
 * Sign in is canonical in the shell More menu, not the footer.
 */
import Link from 'next/link';
import { adminPublicSiteHref } from '../lib/sibling-origins';

export type AdminPageFooterProps = {
  /** When true, show signed-in admin destinations. */
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
                  <Link href="/">Ops</Link>
                </li>
                <li>
                  <Link href="/inbox">Inbox</Link>
                </li>
                <li>
                  <Link href="/cases">Cases</Link>
                </li>
                <li>
                  <Link href="/catalog">Catalog</Link>
                </li>
                <li>
                  <Link href="/stories/review">Stories</Link>
                </li>
                <li>
                  <Link href="/releases">Releases</Link>
                </li>
                <li>
                  <Link href="/quick-add">Quick add</Link>
                </li>
              </>
            ) : null}
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

/**
 * Admin shell footer — ops-first signed-in destinations, then public-site handoffs.
 * Sign in is canonical in the shell More menu, not the footer.
 */
import Link from 'next/link';

export type AdminPageFooterProps = {
  /** When true, show signed-in admin destinations. */
  readonly signedIn?: boolean;
};

export function AdminPageFooter({ signedIn = false }: AdminPageFooterProps) {
  return (
    <footer className="admin-footer">
      <div className="admin-footer__inner">
        <p className="admin-footer__brand">BlackStory Admin · History, pinned to place.</p>
        <nav className="admin-footer__nav" aria-label="Admin footer">
          <ul className="admin-footer__links">
            {signedIn ? (
              <>
                <li>
                  <Link href="/admin">Ops</Link>
                </li>
                <li>
                  <Link href="/admin/inbox">Inbox</Link>
                </li>
                <li>
                  <Link href="/admin/cases">Cases</Link>
                </li>
                <li>
                  <Link href="/admin/catalog">Catalog</Link>
                </li>
                <li>
                  <Link href="/admin/stories/review">Stories</Link>
                </li>
                <li>
                  <Link href="/admin/releases">Releases</Link>
                </li>
                <li>
                  <Link href="/admin/quick-add">Quick add</Link>
                </li>
              </>
            ) : null}
            <li>
              <Link href="/explore">Explore</Link>
            </li>
            <li>
              <Link href="/stories">Public stories</Link>
            </li>
            <li>
              <Link href="/">Public site</Link>
            </li>
          </ul>
        </nav>
      </div>
    </footer>
  );
}

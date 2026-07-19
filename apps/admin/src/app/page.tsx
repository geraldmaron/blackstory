/**
 * Admin home — branded landing with session-aware CTA.
 * Shell navbar/footer come from the root AdminShellChrome.
 */
'use client';

import Link from 'next/link';
import { useAdminAuth } from '../auth/AdminAuthProvider';
import { adminPublicSiteHref } from '../lib/sibling-origins';

export default function AdminHomePage() {
  const { ready, user } = useAdminAuth();
  const publicHome = adminPublicSiteHref('/');
  const publicStories = adminPublicSiteHref('/stories');

  return (
    <main className="admin-home" id="main">
      <section className="admin-home__panel" aria-labelledby="admin-home-title">
        <p className="admin-home__eyebrow">Administration</p>
        <h1 className="admin-home__title" id="admin-home-title">
          BlackStory Admin
        </h1>
        <p className="admin-home__lede">
          Private console for research triage and story packet review. Use the
          shared navbar to move between the public archive and this console.
        </p>

        {!ready ? (
          <p className="admin-home__status" role="status">
            Checking session…
          </p>
        ) : user ? (
          <div className="admin-home__actions">
            <Link className="ds-button ds-button--primary" href="/stories/review">
              Open story review
            </Link>
            {publicStories ? (
              <a className="ds-button ds-button--secondary" href={publicStories}>
                View public stories
              </a>
            ) : null}
            {publicHome ? (
              <a className="ds-button ds-button--secondary" href={publicHome}>
                Open public site
              </a>
            ) : null}
          </div>
        ) : (
          <div className="admin-home__actions">
            <Link className="ds-button ds-button--primary" href="/login">
              Sign in
            </Link>
            {publicHome ? (
              <a className="ds-button ds-button--secondary" href={publicHome}>
                Open public site
              </a>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}

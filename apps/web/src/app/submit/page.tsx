/**
 * Public "submit a lead" entry point. Covers channels with no compliant automated
 * API — Facebook Groups, Discord, closed forums, family papers, oral memory — by accepting a
 * human-submitted lead into the moderated quarantine queue. Nothing submitted here is
 * public. It only ever seeds research after independent-reviewer consensus
 * (`packages/domain/src/consensus-review/`) and the standard research pipeline —
 * see `../corrections/page.tsx` for the related correction-intake surface and
 * `docs/runbooks/moderator-wellbeing.md` for how the review queue is staffed.
 */
import { EmptyState, Notice } from '@blap/ui';
import { SeedDataNotice } from '../../components/SeedDataNotice';
import { SubmitLeadForm } from './SubmitLeadForm';

export const metadata = {
  title: 'Submit a lead',
  description:
    'Point Blap toward a lead — a closed group post, a family paper, an oral account — for moderated review.',
};

export default function SubmitLeadPage() {
  return (
    <main className="bp-container bp-page" id="main">
      <p className="bp-page__eyebrow">Contribute</p>
      <h1 className="bp-page__title">Submit a lead</h1>
      <p className="bp-page__lede">
        Some of the most important sources for this history live where no compliant automated
        search can reach — closed Facebook groups, Discord servers, private forums, family
        papers, oral memory. If you know of one, tell us here.
      </p>

      <div className="bp-stack" style={{ marginTop: 'var(--bp-space-6)' }}>
        <SeedDataNotice compact />

        <Notice tone="warning" title="This is not a public post">
          Leads submitted here are never published as-is. Every submission enters a moderated
          quarantine queue (BB-029), is reviewed independently by multiple reviewers, and — only
          if reviewers agree it is worth pursuing — seeds a private research case. It still has
          to pass the full research and fact-checking process before anything about it is ever
          public. Please do not include anyone's home address or other sensitive personal
          details about a living person.
        </Notice>

        <SubmitLeadForm />

        <EmptyState title="What happens after you submit">
          A lead is never auto-published. It is reviewed independently by several moderators
          (the Zooniverse/Caesar pattern — see{' '}
          <a href="/methodology">how disputes and review are handled</a>); if they agree it is
          legitimate, it becomes a private research candidate. If they disagree, a human expert
          resolves it — disagreement is never silently averaged away. Only the standard research
          and promotion pipeline can ever make anything from this lane public.
        </EmptyState>
      </div>
    </main>
  );
}

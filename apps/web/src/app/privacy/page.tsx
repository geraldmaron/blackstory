/**
 * Public privacy policy for BlackStory web and mobile store gates. Honest inventory of what
 * each surface processes, explicit non-collection rules, and owner placeholders until legal
 * entity and support contact are resolved.
 */
import { PrivacySections } from './PrivacySections';

export const metadata = {
  title: 'Privacy policy',
  description:
    'How BlackStory handles information on the public website and native mobile reader — no accounts at launch, no ad or tracking SDKs, optional location only.',
};

export default function PrivacyPage() {
  return (
    <main className="ds-container ds-page" id="main">
      <p className="ds-page__eyebrow">Trust</p>
      <h1 className="ds-page__title">Privacy policy</h1>
      <p className="ds-page__lede">
        An honest inventory of what BlackStory&apos;s public website and native reader may process —
        and what they deliberately do not collect. No accounts at launch. No advertising or tracking
        SDKs. Location is optional on the web and not requested by the mobile app at launch.
      </p>
      <PrivacySections />
    </main>
  );
}

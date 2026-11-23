/**
 * Public "submit a lead" entry point: the form, and beside it what happens next. Moderated
 * quarantine intake; nothing submitted here is public.
 */
import type { Metadata } from 'next';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import { parentCrumb, Room } from '../../components/room';
import { TrustMast, TrustSheet } from '../../components/trust';
import { FormLayout, NextSteps } from '../../components/forms/FormKit';
import { SUPPORT_CONTACT } from '../../lib/config/contact';
import '../utility.css';
import '../../components/forms/form-kit.css';
import { SubmitLeadForm } from './SubmitLeadForm';

export const revalidate = 86400;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/submit',
  title: 'Submit a lead',
  description:
    'Point BlackStory toward a lead, such as a closed group post, a family paper or an oral account. Moderated review, and nothing public on arrival.',
});

export default function SubmitLeadPage() {
  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast art={['tools']}>
          <PageHeader
            display
            crumb={parentCrumb('/submit')}
            linkAs={Link}
            title="Tell the archive what it's missing"
            dek="A closed group post, a family paper, an account nobody wrote down. These are the sources no automated search can reach."
          />
        </TrustMast>
      }
    >
      <TrustSheet>
        <FormLayout
          aside={
            <NextSteps
              steps={[
                'I read it, after a screen that holds likely hate aside.',
                'If it’s worth pursuing, it becomes a private research candidate.',
                'It reaches the site only after the same source checks as every record.',
              ]}
            >
              <p>Leave out anyone’s home address or other private details about a living person.</p>
              <p>
                A form the wrong shape for what you have? Write to{' '}
                <a href={`mailto:${SUPPORT_CONTACT}`}>{SUPPORT_CONTACT}</a>.
              </p>
              <p>
                <Link href="/faq#does-ai-read-what-i-send">Does AI read what I send?</Link>
              </p>
            </NextSteps>
          }
        >
          <SubmitLeadForm contact={SUPPORT_CONTACT} />
        </FormLayout>
      </TrustSheet>
    </Room>
  );
}

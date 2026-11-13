/**
 * `/methodology`: how a record gets in, and the one place the evidence grades are defined.
 */
import type { Metadata } from 'next';
import React from 'react';
import Link from 'next/link';
import { PageHeader } from '@repo/ui';
import {
  PublishingPrinciplesJsonLdScript,
  TrustMast,
  TrustSheet,
  TrustSiteJsonLdScript,
} from '../../components/trust/index';
import { TRUST_PATHS } from '../../lib/trust/site-identity';
import { buildStaticPageMetadata } from '../../lib/seo/metadata-builders';
import { MethodologySections } from './MethodologySections';
import { parentCrumb, Room } from '../../components/room';
import { ADMISSION_STEPS, METHODOLOGY_INTRO_LEDE } from './methodology-copy';
import '../reading-room.css';
import '../../components/trust/trust.css';
import './methodology.css';

void React;

export const revalidate = 3600;

export const metadata: Metadata = buildStaticPageMetadata({
  path: '/methodology',
  title: 'Methodology',
  description:
    'How BlackStory decides what qualifies as a record, checks it against independent sources, grades how sure the evidence is, keeps the addresses of living people off the map, and corrects itself in the open.',
});

export default function MethodologyPage() {
  return (
    <Room
      width="wide"
      className="ds-trust-room"
      masthead={
        <TrustMast
          tone="sand"
          numeral={{
            value: String(ADMISSION_STEPS.length),
            label: 'steps from a lead to a public page',
          }}
        >
          <PageHeader
            display
            crumb={parentCrumb('/methodology')}
            linkAs={Link}
            title="How the archive works"
            dek={METHODOLOGY_INTRO_LEDE}
          />
        </TrustMast>
      }
    >
      <TrustSiteJsonLdScript />
      <PublishingPrinciplesJsonLdScript
        pagePath={TRUST_PATHS.methodology}
        pageTitle="Methodology"
      />
      <TrustSheet>
        <MethodologySections />
      </TrustSheet>
    </Room>
  );
}

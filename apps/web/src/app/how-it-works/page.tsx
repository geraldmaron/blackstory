/**
 * `/how-it-works` — retired merged trust hub. Redirects to the individual room for `?s=`,
 * or to About when the section is missing.
 */
import {
  redirectRetiredTrustHub,
  type RawTrustHubSearchParams,
} from './redirect-retired-trust-hub';

export default async function HowItWorksRedirectPage({
  searchParams,
}: {
  readonly searchParams: Promise<RawTrustHubSearchParams>;
}) {
  redirectRetiredTrustHub(await searchParams);
}

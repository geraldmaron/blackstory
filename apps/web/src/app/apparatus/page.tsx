/**
 * `/apparatus` — retired jargon slug for the merged trust hub. Same query-aware redirect as
 * `/how-it-works`.
 */
import {
  redirectRetiredTrustHub,
  type RawTrustHubSearchParams,
} from '../how-it-works/redirect-retired-trust-hub';

export default async function ApparatusRedirectPage({
  searchParams,
}: {
  readonly searchParams: Promise<RawTrustHubSearchParams>;
}) {
  redirectRetiredTrustHub(await searchParams);
}

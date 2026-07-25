/**
 * Citation-trail helpers for corroboration: extract outbound and inline URLs from
 * a fetched page, keep only Tier-1 or curated secondary hosts, reject same-lineage
 * links as the primary source, and rank preferred federal/archive hosts (NPS, LoC,
 * planning.dc.gov, etc.).
 */
import { extractOutboundLinks, extractUrlsFromText } from './fetch-page.ts';
import {
  hostLineageKey,
  isReputableSecondaryHost,
  isTier1Host,
  isWikipediaHost,
  rankTier1Links,
} from './tier1-sources.ts';

export function collectTier1TrailLinks(
  html: string,
  baseUrl: string,
  options: { readonly excludeUrls?: readonly string[]; readonly text?: string } = {},
): readonly string[] {
  const excludeHosts = new Set(
    [baseUrl, ...(options.excludeUrls ?? [])]
      .map(hostLineageKey)
      .filter((host): host is string => host !== undefined),
  );
  const seen = new Set<string>();
  const inlineSource = options.text ?? html.replace(/<[^>]+>/gu, ' ');
  const candidates = [
    ...extractOutboundLinks(html, baseUrl),
    ...extractUrlsFromText(inlineSource),
  ];
  const independent = candidates.filter((url) => {
    if (!isTier1Host(url)) return false;
    const host = hostLineageKey(url);
    if (!host || excludeHosts.has(host)) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
  return rankTier1Links(independent);
}

export function collectTier2TrailLinks(
  html: string,
  baseUrl: string,
  options: { readonly excludeUrls?: readonly string[]; readonly text?: string } = {},
): readonly string[] {
  const excludeHosts = new Set(
    [baseUrl, ...(options.excludeUrls ?? [])]
      .map(hostLineageKey)
      .filter((host): host is string => host !== undefined),
  );
  const seen = new Set<string>();
  const inlineSource = options.text ?? html.replace(/<[^>]+>/gu, ' ');
  const candidates = [
    ...extractOutboundLinks(html, baseUrl),
    ...extractUrlsFromText(inlineSource),
  ];
  return candidates.filter((url) => {
    if (isWikipediaHost(url)) return false;
    if (!isReputableSecondaryHost(url)) return false;
    const host = hostLineageKey(url);
    if (!host || excludeHosts.has(host)) return false;
    if (seen.has(url)) return false;
    seen.add(url);
    return true;
  });
}

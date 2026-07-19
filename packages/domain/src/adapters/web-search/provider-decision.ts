/**
 * Records the SearXNG-vs-Brave-vs-Exa provider decision. Plain module (not a new ADR) —
 * locks a config default, not an irreversible architecture. Brave/Exa remain in the
 * `WebSearchProvider` union; flipping the preferred provider is a call-site / dispatcher change.
 *
 * `storageTermsConfirmedInWriting` stays `false` until a human records an operator policy
 * for the engines enabled on the self-hosted SearXNG instance (or purchases Brave storage
 * rights). Campaign code never derives that flag from this constant.
 */
export const WEB_SEARCH_PROVIDER_DECISION = {
  chosenProvider: 'searxng' as const,
  decidedAt: '2026-07-19',
  reasoning: [
    'Prefer open-source, self-hosted meta-search (SearXNG on Corsair via Tailscale) over ' +
      'commercial Brave/Exa subscription keys for BlackStory research discovery.',
    'Landscape: Bing Search API retired Aug 2025; Google Programmable Search JSON API is ' +
      'closed to new customers — commercial keyword search narrowed to Brave vs Exa; SearXNG ' +
      'avoids that market entirely for the research lane.',
    'Cost/control: SearXNG is free to run (~120MiB RAM on Corsair) and keeps query/egress ' +
      'policy under operator control. Brave remains available as a fallback provider.',
    'Storage-rights: self-hosted SearXNG removes Brave storage-tier purchase, but upstream ' +
      'engine ToS still require an explicit operator confirmation before persisting result ' +
      'metadata — enforced by storageTermsConfirmed (same fail-closed gate as Brave).',
  ],
  storageTermsConfirmedInWriting: false,
  note:
    'Default provider is SearXNG. storageTermsConfirmedInWriting stays false until a human ' +
    'records engine-policy acceptance for the Corsair instance (or confirms Brave storage ' +
    'rights if falling back). Both registry approval and storageTermsConfirmed must be flipped ' +
    'independently after that review.',
} as const;

/**
 * BB-075 acceptance criterion 1 (decision half): records the Brave-vs-Exa provider decision and
 * the reasoning behind it. Deliberately a plain module rather than a new `docs/adr/` entry — the
 * only thing actually being locked in here is a config default (which provider this codebase
 * builds a concrete client for first), not an irreversible architectural commitment; Exa can be
 * added later behind the same `WebSearchProvider` union (./types.ts) without revisiting this
 * decision's structure.
 *
 * IMPORTANT — what this constant does NOT claim: `storageTermsConfirmedInWriting` is `false` and
 * must stay that way until a human obtains real written confirmation from Brave's storage-rights
 * tier (or renegotiates with Exa) outside of this repository. No code path in this adapter
 * derives or flips that value from this record; see ./types.ts's `WebSearchProviderConfig` and
 * ./normalizer.ts's `assertStorageTermsConfirmed` for the actual enforcement.
 */

export const WEB_SEARCH_PROVIDER_DECISION = {
  chosenProvider: 'brave' as const,
  decidedAt: '2026-07-17',
  reasoning: [
    'Landscape constraint that narrows the field first: Bing Search API retired Aug 2025 and ' +
      'Google Programmable Search JSON API is closed to new customers and sunsets Jan 2027 — ' +
      'neither is buildable-on, leaving Brave vs Exa as the only live candidates.',
    'Cost: Brave is roughly $5/1k queries vs Exa\'s ~$7/1k. Discovery workloads are inherently ' +
      'exploratory and high-volume (many queries per campaign, most of which will not pan out), ' +
      'so the ~30% unit-cost gap compounds under BB-033\'s per-campaign query budgets and monthly ' +
      'spend caps — a cheaper per-query cost buys more discovery surface for the same cap.',
    'Storage-rights mechanism clarity: Brave sells an explicit, purchasable "storage rights" tier ' +
      'as a contractual add-on to the base API — a concrete, checkable artifact ops can point to ' +
      'as the "written confirmation" this bead\'s acceptance criterion 1 requires once purchased. ' +
      'Exa\'s advertised "zero-data-retention" posture describes what Exa retains of OUR queries, ' +
      'not our right to retain THEIR results — it does not by itself resolve the storage question, ' +
      'so written confirmation from Exa sales would still be a separate, undocumented negotiation ' +
      'either way.',
    'Coverage fit: this bead exists to find the obscure personal blog or church-history page no ' +
      'curated feed list already knows about. General keyword web search (Brave) plausibly covers ' +
      'that need directly from the BB-038 query-pack terms; Exa\'s semantic/"similar meaning" ' +
      'retrieval mode is a genuine strength for some discovery shapes but is not obviously better ' +
      'suited to name/place lookups built from a structured query pack than a well-formed keyword ' +
      'query, so it does not offset the cost and storage-mechanism gaps above.',
  ],
  storageTermsConfirmedInWriting: false,
  note:
    'Code-default decision only — no storage-rights confirmation has been obtained, and nothing ' +
    'in this codebase may claim otherwise. The adapter ships registered "disabled" in the BB-037 ' +
    'registry (../gates.ts) AND with WebSearchProviderConfig.storageTermsConfirmed defaulting to ' +
    'false (../normalizer.ts assertStorageTermsConfirmed) — both gates require a human to flip ' +
    'them independently after real written confirmation from Brave.',
} as const;

/** Search-provider defaults. Endpoint configuration and storage permission are independent. */
export const WEB_SEARCH_PROVIDER_DECISION = {
  chosenProvider: 'searxng' as const,
  reasoning: [
    'SearXNG supports an explicitly configured operator-owned search endpoint.',
    'Brave supports managed search when operating a search service is not cost effective.',
    'Self-hosting does not waive upstream engine terms. Persisting result metadata requires storage permission.',
  ],
  storageTermsConfirmedInWriting: false,
  note: 'Provider availability does not establish source fitness or storage rights.',
} as const;

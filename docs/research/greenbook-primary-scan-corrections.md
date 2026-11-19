# Green Book primary-scan discrepancies

The NYPL structured transcription is derived evidence. Exact agreement with that file is not independent verification of a printed page. When a scan contradicts it, retain the original file, capture, imported `sourceCategory`, and verbatim quotations.

## Prepare without database access

`packages/ops-data/scripts/prepare-greenbook-primary-scan-corrections.ts <packet.json>` reads a local JSON packet and emits an offline proposal. It has no database, network, credential or publication capability. Input is `{rows, corrections}`, using `CandidateSnapshot` and `ScanCorrection` in `lib/greenbook-primary-scan-plan.ts`.

Supply exact candidate snapshot fields (id, display_name, status, updated_at, provenance, payload). Compute `expectedSnapshotSha256` with `candidateSnapshotSha256`, not a different JSON serialization. Bind each correction to the independently captured scan SHA-256, HTTPS source, printed page and one-based PDF page, exact listing name/address, section heading, and actual reviewer/rationale/time. A checksum is identity evidence, not proof that someone reviewed the scan. Never invent reviewer approval. OCR/address corrections require separate review and are deliberately excluded from this category-only planner.

The output proposes separate `provenance.primaryScanCorrection` metadata and archives invalidated `payload.listingReview` within it. It does not rewrite sourceCategory or evidence quotations and does not grant a new listing approval. The corrected category is used only in the separately proposed editorial text. Staging, registry-exact review, and restatement eligibility fail closed for any recorded correction marker, including malformed markers. Management publication does not erase that guard.

## Apply with exact review and audit

No live apply command is supplied. An authorized operator must re-read and lock each candidate inside a transaction, recompute the complete snapshot digest, require the expected status/version, and reject any mismatch. Apply only the proposed provenance/payload changes, leave summary/status/coordinates untouched, update updated_at, and insert an audit event containing actual actor, before/after hashes, evidence identity, rationale, and exact correction. Preserve original evidence indefinitely. Do not blindly apply the complete proposedCandidate as a row replacement.

For existing public records, prepare a management Work proposal with exact current claim/version IDs, `claimRevisions` superseding the incorrect restaurant assertions, replacement assertions supported by the primary scan, and corrected summaries. Existing historical context and unrelated claims stay unchanged. Obtain exact proposal approval and publish through authenticated `pnpm work:publish`; never fabricate an approval or copy credentials. Five unpublished candidates remain pending unless separately reviewed and approved for publication. Candidate corrections and public claim revisions are distinct operations; one does not complete the other.

After publication, verify active canonical claim supersession, release projections, search, public API/map and published artifacts. Recorded scan corrections prevent this specific derived-source discrepancy from re-entering the exact-match lane; they do not automatically discover other transcription errors or invalidate already recorded review decisions. Those must be explicitly superseded by management revisions. A future automated primary-scan review lane must bind scan evidence and reviewed claim/version before it can remove this hold.

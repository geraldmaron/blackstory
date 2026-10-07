---
name: blackstory-triage-graylist
description: Use when walking parked, weak-signal research candidates that have cleared intake screening and deciding whether to strengthen with corroboration or recommend rejection. Also covers graylist-read. Triggers on "triage the graylist", "what's stuck in quarantine", "review parked research leads".
---

# Triage graylist

Canonical how-to (`graylist-read` read path, `attach-evidence` corroboration/recommendation,
Do/Never) lives in
[`docs/research/research-operations.md`](../../../../docs/research/research-operations.md#triage-graylist).
Read that section before triaging anything. This file is a CLI pointer. It carries no
command detail of its own.

Strengthening a weak claim with an independent source is `blackstory-claim-corroborate`.

Raw submissions, abuse reports and prompt-injection-bearing mail first use
`blackstory-intake-review`. Graylist research must not bypass that screen.

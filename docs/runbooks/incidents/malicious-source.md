# Malicious source

## Trigger and triage

- Trigger on source-host compromise, malicious payload/URL, rights change, schema drift, or abnormal adapter output.
- Identify adapter id, source domains, captures, parser versions, campaigns, and downstream lineage.

## Contain

1. Engage only `source-adapter-{adapterId}` first; engage research/LLM if cross-source processing is unsafe.
2. Pause affected queues without purge and quarantine all captures from the suspected window.
3. Engage `publication`; roll back BB-019 if source-derived content reached public output.

## Recover

- Revalidate source ownership, rights, URL safety, parser fixtures, and expected volume/schema.
- Replay quarantined material only into an isolated preview with provenance checks.
- Canary a new parser/source contract and monitor before restoring the adapter.

# D-009 — Research isolation

Use distinct research credentials and lower-layer isolation inside `black-book-efaaf` now; a
dedicated research project is the deferred migration target (D-013). Research cannot publish; LLMs
cannot publish/approve; public render never calls LLM. Quarantine/private-evidence are not public.

Formal: `docs/adr/ADR-009-research-isolation.md`  
Scaffold: worker package only; same-project SA/bucket/DB isolation is designed, **not** configured.

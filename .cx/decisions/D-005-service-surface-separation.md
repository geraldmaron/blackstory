# D-005 — Service surface separation

Deploy only bead security boundaries: web, api-public, api-submissions, api-internal (private), admin (+IAP), workers research/publication/security. No further app microservices.

Formal: `docs/adr/ADR-005-service-surface-separation.md`  
Scaffold: directories match; runtime isolation **not** configured (BB-021).
All surfaces currently target the one production project `black-book-efaaf`; distinct SAs and
resource/database IAM remain mandatory (D-013).

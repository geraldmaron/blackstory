# Storage bucket matrix (BB-005)

Four distinct production buckets are designed in `black-book-efaaf`. None is considered provisioned
until BB-011 verifies it. All use Uniform Bucket-Level Access; object ACLs are disabled.

| Bucket | PAP | Publicly servable | Writers | Readers |
|--------|-----|-------------------|---------|---------|
| `black-book-efaaf-public-media` | inherited only if direct public delivery is approved; otherwise enforce | yes, vetted objects only | `publication`, `api-internal`; `security` create | CDN/public delivery, `web-runtime`, `api-public`, `admin` |
| `black-book-efaaf-private-evidence` | enforced | no | `research`, `security` | `publication`, `admin`, `api-internal` |
| `black-book-efaaf-exports` | enforced | no; short-TTL signed URLs only | `publication`, `api-internal` | approved signed-URL flow |
| `black-book-efaaf-quarantine` | enforced | no | `api-submissions` create only; `security` admin | `security` only |

Project-level storage roles are forbidden for runtime identities because they would bypass this
same-project bucket separation.

## Invariants

- Public services have no IAM binding on private-evidence or quarantine.
- Research has no write grant on public-media or exports.
- Submissions can create but cannot read quarantine objects.
- Quarantine has no CDN, Firebase Storage public rule, or signed-URL issuer.
- Objects reach public-media only through security/publication promotion.

## Promotion flow

```text
submission -> quarantine -> security scan -> private-evidence
                                             |
                                      publication review
                                             |
                                      public-media -> public
```

There is no cross-project grant in current single-project mode. The identity and bucket IAM
boundaries remain mandatory. Evidence versioning/retention lands with provenance work; quarantine
and exports receive short lifecycle policies. BB-020 decides whether backup exports require a fifth,
separately reviewed bucket.

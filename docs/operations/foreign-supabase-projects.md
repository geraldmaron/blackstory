# The two Supabase projects in this org that are not BlackStory

The Dagher Supabase org holds three active projects. One is BlackStory. The other two are not,
and `apps/web/src/lib/runtime-hardening/leftover-stack.test.ts` enforces that: it lists both by
reference and by name as projects the public web must never point at.

| Project | Reference | What it is |
|---|---|---|
| `blackstory-app` | `twykhihqkcldpreuovay` | **This application.** |
| `theadministration-app` | `ltpqfgfcvrmfctcaisuw` | A different application of the owner's. |
| `geralddagher-site` | `cqdukiktqmcoantrbxzy` | The owner's personal site. |

This file exists so the next session does not re-investigate the middle row, which has now been
asked twice.

## theadministration-app is not a BlackStory dependency (audited 2026-09-13, repo-mhyp)

Traced across the whole monorepo. Zero references: no TypeScript, JavaScript, SQL migration,
ad-hoc script or workflow touches `public.dataset_editor`, `dataset_overlay` or `cloud_save`. The
project appears exactly twice in this repo and neither is a use — the cost row in
[`../security/cost-resource-controls.md`](../security/cost-resource-controls.md), and the
forbidden-project list in `leftover-stack.test.ts`.

**The reason it was ever thought to be ours is dead.** `repo-mhyp` was filed on the premise that
"theadministration-app exists because the admin rebuild got its own database." Admin has no
database of its own. On 2026-09-11 the admin console stopped being a separate Vercel project and
became the `/admin` route group inside `apps/web`, reading `blackstory-app` — which
`apps/web/.env.local` confirms. The credential-isolation argument that justified a separate
project went with the separate project.

**What is left is not BlackStory's to decide.** Whether that project is kept, folded or retired is
a question about a different application and about the owner's Supabase bill. Two things were
found while confirming it is unrelated, and both were handed to the owner directly rather than
tracked in this backlog: it holds 38 storage objects nobody has accounted for (so "pause it" is not
a safe instruction as it stands), and two `SECURITY DEFINER` functions there are callable by
`authenticated` over PostgREST.

The only BlackStory-side consequence is the shared bill: a second and third active project each
carry their own compute charge whether or not they serve traffic.

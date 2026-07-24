# Curated figures lane notes (repo-xez5.6, part a)

Staged 27 named-person leads through the real `research-intake` verb
(`packages/operator-cli/src/bin.ts research-intake`, composed in
`packages/operator-cli/src/research-intake.ts`), landing them in the existing
quarantine pipeline exactly like repo-xez5.12's Lorde/Baldwin/hooks/Hansberry
batch. Nothing was written to `bb_canonical`; every row below is
`bb_submissions.intake_items.status = 'quarantined'` with
`payload.moderationState = 'pending_review'`, and the paired
`bb_research.cases` row is `state = 'candidate'`. No git commit/push, no
`bd dolt push`.

## Why these names

repo-xez5.12 already staged Audre Lorde, James Baldwin, bell hooks, and
Lorraine Hansberry via this same lane (not restaged). This batch fills the
same "cultural/literary/movement figures" gap the repo-xez5.6 brief calls
out, cross-checked against the current `bb_canonical.entities` person roster
(394 names as of this run) so nothing here duplicates an existing entity or
the four names above.

Reference lists were built from live Wikipedia category listing pages
(BlackPast.org returned HTTP 403 to automated fetches in this session — every
`blackpast.org` URL tried was blocked, so Wikipedia's category pages were used
as the real, fetchable reference instead):

- https://en.wikipedia.org/wiki/Category:African-American_feminists
- https://en.wikipedia.org/wiki/Category:African-American_journalists
- https://en.wikipedia.org/wiki/Category:African-American_trade_unionists
- https://en.wikipedia.org/wiki/Category:African-American_women_scientists
- https://en.wikipedia.org/wiki/Category:African-American_artists

Names were selected from those category listings for range across five
themes named in the brief (Black feminist/queer writers and organizers,
Black press figures, artists, scientists, labor leaders), then filtered
against the current person roster.

## Roster staged (27 of 27 proposed)

| # | Name | Theme | Source URL (fetched by `research-intake`) | Submission ID | Research case ID |
|---|---|---|---|---|---|
| 1 | Pauli Murray | feminist/queer writer & organizer | https://en.wikipedia.org/wiki/Pauli_Murray | 7181d1fc-bdab-4eb0-ba77-de77ae4dbcd5 | 65658864-7591-4387-bde6-1d253c4cbcab |
| 2 | Angela Davis | organizer/scholar | https://en.wikipedia.org/wiki/Angela_Davis | 375653a1-d88c-4839-a3bc-eb94bc9fcfb2 | (see case linked to this submission) |
| 3 | Claudia Jones | feminist journalist/organizer | https://en.wikipedia.org/wiki/Claudia_Jones | 28137a3c-13a9-4f87-81b6-187aded3e1b4 | " |
| 4 | Florynce Kennedy | feminist lawyer/organizer | https://en.wikipedia.org/wiki/Florynce_Kennedy | 05e112dc-d929-4dd3-bf1a-e0e32018c0f2 | " |
| 5 | Barbara Smith (feminist) | writer, Combahee River Collective | https://en.wikipedia.org/wiki/Barbara_Smith_(feminist) | 75ccbece-e33e-4a5d-bb7c-01ea8f87c788 | " |
| 6 | June Jordan | writer/poet/organizer | https://en.wikipedia.org/wiki/June_Jordan | a48d8a24-bc2c-4f67-8e9b-0d7bbfce7ea8 | " |
| 7 | Toni Cade Bambara | writer/organizer | https://en.wikipedia.org/wiki/Toni_Cade_Bambara | 0fa9dd81-ceb4-4871-93f0-ec065b78ab68 | " |
| 8 | Anna J. Cooper | feminist scholar/educator | https://en.wikipedia.org/wiki/Anna_J._Cooper | 1abd89f6-7022-47e8-8ab2-3d3bc44d63a4 | " |
| 9 | Ntozake Shange | playwright/poet | https://en.wikipedia.org/wiki/Ntozake_Shange | 3fcfd03e-79bb-4465-a55b-9ef4d493017c | " |
| 10 | Kimberlé Crenshaw | legal scholar/feminist | https://en.wikipedia.org/wiki/Kimberl%C3%A9_Crenshaw | bd049b7a-d18a-4503-9197-7e5e4eceeb44 | " |
| 11 | Patricia Hill Collins | Black feminist sociologist | https://en.wikipedia.org/wiki/Patricia_Hill_Collins | b8c6a8e0-8b8c-4131-804a-29eb552baddd | " |
| 12 | Alice Allison Dunnigan | Black press (White House correspondent) | https://en.wikipedia.org/wiki/Alice_Allison_Dunnigan | 54a8f107-402a-4367-aeab-e54c80df2d84 | " |
| 13 | Marvel Cooke | investigative journalist/labor organizer | https://en.wikipedia.org/wiki/Marvel_Cooke | cdc48084-4355-4afd-a2fb-3727e4dbe059 | " |
| 14 | Timothy Thomas Fortune | Black press pioneer | https://en.wikipedia.org/wiki/Timothy_Thomas_Fortune | 691d3ac4-8941-4c32-98be-08021ba6e60e | " |
| 15 | Claude Albert Barnett | Associated Negro Press founder | https://en.wikipedia.org/wiki/Claude_Albert_Barnett | 744fc9df-3ec1-477e-85d7-f4d70970287f | " |
| 16 | A. Philip Randolph | labor leader | https://en.wikipedia.org/wiki/A._Philip_Randolph | a3bb6950-4775-410b-a26e-c27fce6a4c57 | " |
| 17 | Addie L. Wyatt | labor/civil rights leader | https://en.wikipedia.org/wiki/Addie_L._Wyatt | 06db64e6-b4f6-4dd3-a8a2-34be6762643e | " |
| 18 | Maida Springer Kemp | labor leader | https://en.wikipedia.org/wiki/Maida_Springer_Kemp | 6f588624-1e51-4d14-ae7e-5645b9b426c0 | " |
| 19 | Dorothy Lee Bolden | domestic-workers labor organizer | https://en.wikipedia.org/wiki/Dorothy_Bolden | 9ecd4b43-e1e7-4e07-b3fe-170f70a3e063 | " |
| 20 | Hosea Hudson | labor organizer | https://en.wikipedia.org/wiki/Hosea_Hudson | 690e6fbf-7da3-4cfe-b5d5-f7df08d1fedb | " |
| 21 | Faith Ringgold | artist | https://en.wikipedia.org/wiki/Faith_Ringgold | 9fc9c605-067b-4961-955d-ae63bf40ded8 | " |
| 22 | Betye Saar | artist | https://en.wikipedia.org/wiki/Betye_Saar | 2bb43b4c-ac6b-4f71-962f-1e36b49fd58a | " |
| 23 | Augusta Savage | sculptor | https://en.wikipedia.org/wiki/Augusta_Savage | 29c8f1c6-6f7a-454c-b92f-ea408d0f218a | " |
| 24 | Jewel Plummer Cobb | scientist (cancer researcher, educator) | https://en.wikipedia.org/wiki/Jewel_Plummer_Cobb | 9f21a713-7a19-44b9-bb40-6d95427c0c65 | " |
| 25 | Annie Easley | scientist (NASA) | https://en.wikipedia.org/wiki/Annie_Easley | 10cc65a7-4bb5-4182-883e-19ecd155f82c | " |
| 26 | Alice Ball | scientist (chemist) | https://en.wikipedia.org/wiki/Alice_Ball | b71ae18b-b7c7-4ad6-9378-1594c78207dc | " |
| 27 | Roger Arliner Young | scientist (zoologist) | https://en.wikipedia.org/wiki/Roger_Arliner_Young | 49f34c40-5cb7-4569-a46c-ad482f244f3c | " |

Every row was verified after staging with:

```sql
select id, status, payload->'moderationState' as mod_state, source_url, created_at
from bb_submissions.intake_items
where source_url ilike '%en.wikipedia.org/wiki/%'
  and created_at > now() - interval '30 minutes'
order by created_at desc;
```

All 27 returned `status = 'quarantined'`, `mod_state = 'pending_review'`, matching
the shape of the existing Lorde/Baldwin/hooks/Hansberry rows staged by repo-xez5.12.
A spot-check join against `bb_research.cases` confirmed matching draft
`state = 'candidate'` research cases for the sampled submission IDs.

## How it was run

```bash
set -a && source apps/web/.env.local && set +a   # DATABASE_URL for the Postgres ops store
export OPS_DATA_SOURCE=postgres

node --conditions development --import tsx packages/operator-cli/src/bin.ts research-intake \
  --url "<wikipedia URL>" \
  --title "<name>" \
  --description "Curated figures lane (repo-xez5.6a): comparably significant Black feminist/queer writer, organizer, press figure, artist, scientist, or labor leader missing from bb_canonical.entities person roster." \
  --privacy-pepper devpepper \
  --operator-id agent-repo-xez5.6 --session-id sess-repo-xez5-6-curated \
  --identity-source claude_session --commit
```

`--commit` here writes only to the quarantine tables (`bb_submissions.intake_items`,
`bb_research.cases`) through the same audit/outbox path every operator-cli
writer uses (`commitWithAudit`) — there is no promote/publish path in this
CLI (`promotion-boundary.test.ts`). `committed: true` in the JSON output
means the audit event landed, not that anything reached `bb_canonical`.

## Failures

None. All 27 of 27 proposed figures staged successfully on the first attempt.
The only blocker encountered was BlackPast.org returning HTTP 403 to
`WebFetch` for every URL tried (root, category pages, article pages) — worked
around by using Wikipedia category listing pages instead, which are real,
citable, live-fetched reference pages.

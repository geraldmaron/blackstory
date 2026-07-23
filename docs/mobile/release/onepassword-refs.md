# 1Password refs — BlackStory mobile (Apple / EAS)

Vault: `geralddagher-development`  
Scaffolded 2026-07-22 for `repo-fsxq`. Metadata only — no API keys or `.p8` files in these items.

## Items created

| Item | UUID |
|---|---|
| BlackStory — Apple Developer (Team ID + custody) | `bhgog6bjusu7xospe4374lgs44` |
| BlackStory — EAS (project metadata) | `uuk7qg6lif6dj77pspuhi5dvxq` |
| BlackStory — Mobile Firebase configs (pointers) | `g3a7i23xd5o4moja27s7l6zwou` |
| BlackStory — Mobile secrets inventory | `nenn7egyuezak5unexj4kb4dja` |

## Local `op run` (optional)

Create a **gitignored** `apps/mobile/.env.op` (already listed in `.gitignore`):

```bash
cat > apps/mobile/.env.op <<'ENV'
APPLE_TEAM_ID=op://geralddagher-development/bhgog6bjusu7xospe4374lgs44/team_id
APPLE_ACCOUNT_TYPE=op://geralddagher-development/bhgog6bjusu7xospe4374lgs44/account_type
APPLE_LEGAL_ENTITY=op://geralddagher-development/bhgog6bjusu7xospe4374lgs44/legal_entity_name
EXPO_ORG_SLUG=op://geralddagher-development/uuk7qg6lif6dj77pspuhi5dvxq/expo_org_slug
EAS_PROJECT_ID=op://geralddagher-development/uuk7qg6lif6dj77pspuhi5dvxq/eas_project_id
EAS_MONTHLY_SPEND_CEILING_USD=op://geralddagher-development/uuk7qg6lif6dj77pspuhi5dvxq/monthly_spend_ceiling_usd
ENV
chmod 600 apps/mobile/.env.op
op run --env-file apps/mobile/.env.op -- printenv APPLE_TEAM_ID EAS_PROJECT_ID
```

## Secrets to create yourself (when you have them)

Do **not** paste into chat. Open the inventory item for full steps:

1. **BlackStory — App Store Connect API (EAS)** — Issuer ID, Key ID, `.p8` document  
2. **BlackStory — EAS token** — expo.dev access token  
3. Firebase plist/json **documents** (titles listed in the Firebase pointers item)

## Owner: fill PENDING now

In 1Password → vault **geralddagher-development**:

1. Open **BlackStory — Apple Developer (Team ID + custody)**  
   Set: Team ID `4Q2XU7D33G`, account type Individual, legal entity Gerald Dagher, support `me@geralddagher.com`.
2. Open **BlackStory — EAS (project metadata)** after `eas init`  
   Fill org slug + project ID; monthly spend ceiling **10**; alert email `me@geralddagher.com`. Stay on Expo Free plan.

---
name: black-book-locate
description: Use when resolving or correcting an entity's lat/lng via Census geocoding (no LLM). Triggers on "locate this entity", "fix this pin", "geocode the address for", "EntityLocation for".
---

# Locate entity (location resolution)

Deterministic Census Geocoder path for one entity. Writes a provenance-carrying
`EntityLocation` under `canonicalEntities/{id}/locations/{locationId}` when `--commit` is set.

## Invoke

```bash
node --conditions development --import tsx packages/operator-cli/src/bin.ts locate \
  --entity-id ent_example_001 \
  --address "1530 6th Avenue North, Birmingham, Alabama" \
  --jurisdiction "Birmingham, Alabama" \
  --precision institution \
  --operator-id "$USER" --session-id "locate-$(date +%s)" --identity-source cli
```

Add `--commit` only when ready to write Firestore (requires ADC + operator identity flags).

## Batch audit (fixtures)

```bash
node --conditions development --import tsx packages/firebase/scripts/audit-entity-locations.ts
# High-confidence street corrections only:
node --conditions development --import tsx packages/firebase/scripts/audit-entity-locations.ts \
  --apply-street-corrections
```

Report: `.cache/location-audit-report.json`. Cache: `.cache/geocode-census.json` (never re-geocode the same query).

## Precision policy (no LLM)

| Evidence | Precision | Accept drift |
| --- | --- | --- |
| Street number in label | `institution` | ≤150m |
| Named campus/place | `campus` | ≤500m |
| Neighborhood/district | `neighborhood` | ≤1600m (~1 mile) |
| City only | `city` | do not sharpen |

## Do

- Prefer street addresses; Census often cannot resolve bare place names — queue those for review.
- Never invent a sharper pin for city-only evidence.
- After locating, re-publish if projections must pick up EntityLocation overrides
  (`publish-national-catalog.ts` prefers EntityLocation over catalog lat/lng).

## Don't

- Don't use an LLM to guess coordinates.
- Don't call Nominatim from product `/locate` (research audit only).
- Don't `--commit` without reviewing `decision.action` when it is `review`.

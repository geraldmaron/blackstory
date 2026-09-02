# Visit handoff and public address

**Status:** binding for entity and place pages (2026-09).  
**Code:** `apps/web/src/lib/geography/{public-address,visit-handoff,external-maps-url}.ts`, `RecordVisitBlock.tsx`.  
**Related:** [`patterns-record-anatomy.md`](./patterns-record-anatomy.md), [`PROTECTED-EXPERIENCES.md`](./PROTECTED-EXPERIENCES.md), constitution `publicPrecisionRules`.

---

## Intent

Readers use BlackStory to **visit** documented places. Every visitable record must show:

1. The **public address line** (finest precision the evidence supports).
2. **Visit standing** when the catalog carries lifecycle status (standing, historic, inactive).
3. **Precision honesty** (never a point sharper than the source).
4. **Maps handoff** that opens the reader's maps app with a **readable place string anchored by the public pin**, not a bare lat/lng pair.

---

## Public address policy (revised)

The published **`locationLabel` is the public address line.** There is no separate hidden street field on the public wire.

| Precision | What the address line may contain | Example |
|---|---|---|
| `institution` | Named building + street when sourced | `819 West 16th Street, Indianapolis, Indiana` |
| `campus` | Campus or site name + city | `Paul Laurence Dunbar High School campus, Washington, D.C.` |
| `neighborhood` | District or neighborhood + city | `Sweet Auburn, Atlanta, Georgia` |
| `city` | City + state | `Kiowa, Kansas` |
| `county` | County + state when city is unknown | `Barber County, Kansas` |

### Moral floor / moral ceiling

- **Publish the finest precision the evidence supports** for visitable institutions, schools, markers, and documented sites. Withholding a sourced street address from a museum or NRHP-listed building is a reader failure.
- **Never publish residential street precision** for living or possibly-living people, private occupied residences, or sensitivity-reduced sites (constitution `livingPersonRules`, `sensitivityRules`).
- **Never invent** an address from coordinates alone. The `locate` verb and Census geocode stay internal until a claim backs the release label.
- Parenthetical release disclaimers like `(city-level pin)` are stripped in display copy but remain in the projection audit trail.

### Display helper

`resolvePublicAddressLine()` composes the reader-facing string from `locationLabel`, `jurisdictionLabel`, `displayName`, and `locationPrecision`. Use it everywhere a Where or Visit address appears. Cards use `placeLabelFor()` which is that composer over an explore feature.

**Where** (anatomy strip / card fact) and **Visit** (handoff block) must print the same address line. They are different jobs:

| Region | Job |
|---|---|
| Where | Orient: the public place line |
| Visit | Act: standing, visitor contact, Open in maps / Get directions |

When Visit is on the surface, Where is plain text. When Visit is omitted (people, laws, compact lists), Where may be the maps link.

### Operator audit

`auditPublicAddressCoverage()` flags visitable records with withheld labels, city-only institution precision, or generic city disclaimers. Run:

```bash
cd apps/web && node --conditions development --import tsx scripts/audit-public-address-coverage.mts
```

---

## Visit block

`RecordVisitBlock` renders:

- **Visit** heading (mono caps kicker)
- Public address line as a **supporting fact** (sans body/UI scale, regular weight, address icon) — never a hero headline
- Visit standing (when applicable)
- Optional locator inset (`showLocator` on entity rail)
- Precision footnote (full surfaces; compact sheet omits the duplicate when the sheet already states precision)
- Optional **Visitor information** (institution-only phone, website, hours from sourced claims), each row with a matching icon (phone / globe / clock) beside the visible label
- Visit standing from lifecycle status or present-day advisories when present
- Quiet text **Open in maps** + **Get directions** (external handoff)
- Optional quiet text **See on map** (Atlas deep link on place stands)

### Action economy

External maps exits and in-app camera moves are different jobs. Keep both when useful; never twin copper primaries for "go to place":

| Control | Job | Treatment |
|---|---|---|
| Open in maps / Get directions | Leave BlackStory into the reader's maps app | Quiet underlined text (`ds-record-visit__link`) |
| See on map | Atlas deep link from a place stand | Quiet underlined text |
| Fly to place (Record sheet) | Re-frame the live Atlas camera | Sheet secondary hairline (or primary only when there is no record href) |
| Open record (Record sheet) | Leave the sheet for the record page | At most one copper primary on the sheet |

Icons are decorative (`aria-hidden`); the text label remains the accessible name. Never emoji. Flat matte Font Awesome glyphs shared with record anatomy (`edition-fact-icon.ts`).

### Surfaces

| Surface | Placement |
|---|---|
| `/entity/[id]` rail | Desktop: locator + visit block |
| `/entity/[id]` main | Mobile: visit block above record body |
| `/place/{slug}` | After interactive locator |
| Explore record sheet / narrative card | Compact visit block (address, standing, contact when mapped, quiet maps text) |

Explore map features carry `jurisdictionLabel` plus a lean `visitClaims` subset (website / phone / hours predicates only) so Atlas RecordSheet and NarrativeCard can resolve the same address and contact lines as the entity page without shipping every accepted claim per pin.

### Public visit contact (institution lane)

`resolvePublicVisitContact()` reads claim predicates:

| Predicate | Field |
|---|---|
| `officialWebsite` | Website |
| `visitorPhone` | Phone |
| `publicHours` | Hours |

Published only when kind is place-like, precision is `campus` or `institution`, and the subject is not a living person. Every value carries its citation label in the UI.

### Advisories

When `placeAdvisories` is present on the projection, `resolveVisitStandingCopy()` prefers a procedural advisory sentence from `@repo/domain/advisory` over generic lifecycle standing.

### Maps URLs

`buildMapsHandoffQuery()` returns `"{address} @ {lat},{lng}"` when both exist.  
`buildExternalMapsSearchUrl()` and `buildExternalMapsDirectionsUrl()` share that destination string.

---

## Tests

| Module | File |
|---|---|
| Public address | `public-address.test.ts` |
| Visit handoff | `visit-handoff.test.ts` |
| Public visit contact | `public-visit-contact.test.ts` |
| Visit block UI | `RecordVisitBlock.test.ts` |
| Maps URLs | `external-maps-url.test.ts` |

# Location precision standard

**Status:** Adopted 2026-09-02 (owner decision, epic repo-trn4, WS1 repo-wqcn). Replaces the
precision half of the "dignity rules" that lived only in `packages/schemas/constitution/policy.v1.json`
and `packages/security/src/redaction.ts`.
**Research record:** the primary-source pass behind this document is summarised in §5; every
claim there names the page opened and the date.

## 1. The rule

BlackStory publishes the location of a place of history the way the National Register of Historic
Places does: **at full precision by default, withheld only when a named condition applies.**

The National Register's authority to withhold location is 54 U.S.C. § 307103. It is discretionary
and exception-based: the Secretary may withhold when disclosure "may cause a significant invasion
of privacy, risk harm to the historic resource, or impede the use of a traditional religious site
by practitioners." Everything else, including occupied private homes, is published with a street
address in the nomination and the weekly Federal Register list.

BlackStory previously did the reverse: it prohibited street addresses and exact coordinates at the
constitution layer and coarsened anything it did not recognise. That was a pattern of our own
making. The world already has one, and readers who want to stand where history happened are served
by it.

## 2. Tiers

Public precision is one controlled list, coarsest to finest. Every raw value that reaches the
publish path is normalised onto it by `normalizePublicPrecision` in
`packages/domain-core/src/geography/precision.ts`; unknown values fall to `city`, never sharper.

| Tier | Meaning | Coordinates published | Raw synonyms normalised here |
|---|---|---|---|
| `none` | withheld entirely | none | |
| `country` | | 0 decimals | |
| `state` | | 1 decimal | region, territory |
| `county` | | 1 decimal | |
| `city` | the NRHP "Address Restricted" tier: nearest city or town | 2 decimals | town |
| `neighborhood` | named district or community, no address | 3 decimals | community, district, block |
| `campus` | a bounded grounds: cemetery, park, campus, stadium, garrison | 3 decimals | cemetery, park, park-site, park_site, stadium, garrison, camp |
| `institution` | a named public building | 4 decimals | building |
| `site` | a verified place at building level without a house number: a former site, an intersection, a marker | 4 decimals | |
| `address` | a street address | 4 decimals (about 11 m, the same order as the NPS listings layer's stated ±12 m) | street_address |

Levels that are never public tiers: `unit`, `parcel`, `exact_coordinates`, `residence`. They
describe a residential or cadastral fact, not a precision the archive publishes. The serializer's
four-decimal cap on coordinates stays; it is the accuracy the standard itself states.

## 3. Conditions that coarsen

Each reduction records its reason on the location (`precisionReductionReason`), so a reader and a
reviewer can see why a point is coarse.

| Condition | Tier cap | Reason code | Why |
|---|---|---|---|
| A living person's residence, on the biographical axis: a `person` record, or a place whose `sensitivityClass` is `living_residence` | `city` | `living_residence` | Wikipedia BLPPRIVACY: no postal addresses of living people in biographies. NRHP does not cap occupied buildings on the architectural axis, so this fires only where the record is about the person. |
| Living status unknown | treated as living | `living_status_unknown` | Fails safe. No source argued against it. |
| Archaeological site, sacred or traditional religious site, or a listing the NPS itself marks Address Restricted | `city` | `restricted_site` | § 307103 and NRHP "Address Restricted" practice publish the nearest city or town. The previous `neighborhood` cap was more permissive than the federal tier. |
| Owner, descendant, or community request to withhold | `city` or `none` | `withheld_on_request` | The § 307103 privacy prong, exercised through the corrections path (`/corrections`). |
| Occupied private residence of a deceased person | **no cap** | | NRHP publishes the homes of deceased owners at full address. The previous `neighborhood` cap has no source. `occupied_private_residence` stays as a class so an owner request can attach to it. |
| Site of lynching, racial violence, or enslavement (`memorial_site`) | **no cap** | | EJI's Community Remembrance markers, the Texas Historical Commission atlas and the Georgia marker program publish these at the intersection, park or parcel. A vague location defeats the memorial. This class is separate from `restricted_site` on purpose. |
| Grave | `campus` for the cemetery, `site` when the plot is documented | | Find a Grave, BillionGraves and the VA gravesite locator publish cemetery plus section and plot. |

## 4. Controls

The strongest objection to adopting the NRHP posture is that the Register comes with a statutory
review process and BlackStory does not. Three controls stand in for it:

1. **Named reasons, never silent coarsening.** A location is either at its source precision or it
   carries a reason code from the table above.
2. **One engine on the publish path.** `reducePublicPrecision` in `@repo/security` runs inside the
   release builder for every `bb_public.release_entities` projection. The hand-maintained denylists
   that used to gate publish (`release-builder.ts`) are removed; a test asserts every published
   precision is a tier from §2.
3. **A request path.** Withholding on request is a class (`withheld_on_request`) any operator can
   set from a correction receipt, and it is honoured before any other rule.

## 5. Sources

Opened 2026-09-02 during the standards pass (scratch record: `address-standard-research.md`):

- 54 U.S.C. § 307103, uscode.house.gov: the statutory withholding test.
- NRHP Form 10-900 structure and NPGallery nomination forms: UTM references and verbal boundary
  descriptions are public; "Address Restricted" is the nearest-town tier for archaeological and
  sacred sites (Michigan SHPO guidance, miplace.org).
- NPS listings layer, `mapservices.nps.gov/.../nrhp_locations`: publishes `Address`, `Vicinity`,
  `IS_EXTANT` and `SRC_ACCU` ("+/- 12 meters") per listing.
- Wikipedia, Wikipedia:Privacy (BLPPRIVACY): postal addresses of living persons are omitted from
  biographies.
- Wikidata P625 precision qualifier; OpenStreetMap `addr:housenumber` and "Mapping private
  information": a legal address is public data, distinct from tagging a person to a building.
- EJI Community Remembrance Project marker list; Texas Historical Commission Atlas (Eagle Island
  Plantation, UTM coordinates published).
- Find a Grave and BillionGraves feature documentation; data.va.gov Nationwide Gravesite Locator.
- schema.org PostalAddress and GeoCoordinates; ISO 19115 positional accuracy as mandatory metadata.

Not settled from primary sources, tracked as open questions: the share of NRHP listings that are
Address Restricted; a citable Historic England statement on occupied listed houses (its list
entries do carry location as a standard field); the AP Stylebook entry on private addresses.

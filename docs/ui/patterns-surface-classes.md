# Surface classes

**Status: proposed (2026-07-30), binding when [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) is.** Law extracted from [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) sections 2 and 4. Demonstrated in [`.design-mocks/blackstory-atlas-v9.html`](../../.design-mocks/blackstory-atlas-v9.html), where the same attribute drives the room layer's `data-cls`.

---

## 1. The rule

**Every public rendered route belongs to exactly one of five classes, and the class is emitted server side as `data-surface` on the page root.**

That attribute is the single switch every shell rule, plate posture, keyboard scope and footer decision reads. It replaces two client route gates and roughly 25 ad hoc `:has()` selectors, which is the reason it exists: a route predicate evaluated in a client component cannot be read by CSS on first paint, and a `:has()` chain keyed on markers the route happens to set is a rule that silently stops applying when the markup changes.

| Class | `data-surface` | Routes | Map | Document scrolls | Single-key bindings |
|---|---|---|---|---|---|
| Instrument | `instrument` | 4 | Live, full viewport | No | Yes, while focus is in `main` |
| Door | `door` | 1 (`/`) | Ambient, full viewport: the Instrument's plate and markers, gestures locked, camera driven by the scroll chapters | Yes | Chorded only |
| Reading room | `reading` | 11 | Parked, one Framed slot at a time | Yes | Chorded only |
| Record page | `record` | 4 | Framed | Yes | Chorded only |
| Utility | `utility` | 9 | Parked and hidden | Yes | Chorded only |
| Endpoint | none | 19 | None | Not applicable | None |

47 routes, which is the whole public surface. If a new route does not fit a class, the class list is wrong, not the route.

---

## 2. Which routes are in each class

Verdicts and URL dispositions are in [`design-direction-v9-surfaces.md`](./design-direction-v9-surfaces.md) section 4. This is the class membership only.

### Instrument (4)

| Route | Note |
|---|---|
| `/` | Front door: the Atlas / map of the archive. A leftover `?atlas=1` is not a second door. |
| `/story` | New. Six chapters at `/story#chapter-{id}` inside one document. |
| `/explore` | Atlas instrument (catalog + map). Not a query on `/`. |
| `/locate` | 308 to `/?find=place`. Folds into the Lens Where group and a narrow place sheet. |

Pattern: [`patterns-atlas-instrument.md`](./patterns-atlas-instrument.md). Design law: [`design-direction-v9-atlas.md`](./design-direction-v9-atlas.md).

### Reading room (11)

| Route | Note |
|---|---|
| `/records` | New. The archive's crawlable non-spatial index. |
| `/history` | Thin server route that maps decade to era and redirects to `/records`, always. Can never be deleted: cached permanent redirects point at it. |
| `/chapters` | The publication index. |
| `/chapters/[slug]` | Chapter detail. Keeps `generateStaticParams`. |
| `/books` | Banned and challenged books catalogue. |
| `/law` | Plain language law reference. |
| `/data` | Charts on paper, plus the kind composition graph rescued from `/history`. |
| `/memorial` | The wall, with the plate Parked and hidden. |
| `/about` | Includes the destinations block, which is the adoption gate. |
| `/methodology` | Built from the live `Citation`, `Confidence` and `Notice` components. |
| `/errata` | The corrections log as a plain reverse chronological list. |

Pattern: [`patterns-reading-room.md`](./patterns-reading-room.md). `/chapters` and `/chapters/[slug]` additionally have [`design-direction-v9-chapters.md`](./design-direction-v9-chapters.md).

### Record page (4)

| Route | Note |
|---|---|
| `/entity/[id]` | Stays `force-dynamic`. Deep anchors are fragments, never query params. |
| `/books/[slug]` | Framed jurisdiction plate, never a school address. |
| `/law/[slug]` | Framed jurisdiction outline, never a point. |
| entity loading state | No URL of its own. Streams at `/entity/[id]` while the record loads. |

Pattern: [`patterns-record-page.md`](./patterns-record-page.md).

### Utility (9)

| Route | Note |
|---|---|
| `/corrections` | Needs `target` and `targetType` allowlisted or every "Suggest a correction" link forgets its target. |
| `/corrections/status/[receiptCode]` | `X-Robots-Tag: noindex`, and never a robots.txt Disallow, because that advertises the prefix. |
| `/submit` | Lead intake. No receipt code, because a lead is not a correction. |
| `/support` | Five links and a role mailbox. No form. |
| `/privacy` | Written in the methodology voice, anchored sections, nothing behind a disclosure. |
| `/chapters/mosaic-credits` | Rights clearance for every atmosphere tile. |
| `/design-system` | Publicly linked, so it must not 404. noindex with follow true. |
| `/_not-found` | Serves 404 for genuinely unknown paths only. |
| root error boundary | No URL of its own. Renders in place of whatever threw, URL preserved. |

### Endpoint (19)

No chrome by definition: redirects, JSON and text responses, feeds and crawler files.

`/facts`, `/search`, `/map`, `/explore/api`, `/history/api`, `/search/api`, `/locate/api`, `/submit/api`, `/corrections/api`, `/corrections/abuse/api`, `/corrections/appeal/api`, `/corrections/status/api`, `/api/request-integrity`, `/errata/feed.json`, `/errata/feed.xml`, `/ai.txt`, `/.well-known/security.txt`, `/robots.txt`, `/sitemap.xml`.

---

## 3. What the class decides

| Decision | Instrument | Reading room | Record page | Utility |
|---|---|---|---|---|
| Plate posture | Live | Parked, one Framed slot at a time | Framed | Parked and hidden |
| Document scroll | Locked | Yes | Yes | Yes |
| Single-key bindings | Live while focus is inside `main` | Chorded only | Chorded only | Chorded only |
| Site footer | Only at the end of Story's outro | Yes | Yes | Yes |
| Reading progress rule | No | Yes | No | No |
| Lens, Results, Time, Camera console | Yes | No | No | No |
| Record sheet posture | Over the plate | In document | In document | Not rendered |
| Mandatory exit | Palette, `A`, record open | Records off ramp | Session prev and next, Atlas return, correction path | At least one named next step |

Every class carries the command bar, the palette, the collections drawer, the toast stack and the keyboard layer, because all five mount once above every route and never unmount.

---

## 4. The single-key scope law

**An unmodified key binding may only be live while focus is inside the surface that owns it, and every such binding is additionally switchable off globally.**

A typing-target check is not a WCAG 2.1.4 mechanism and does not count. `isTypingTarget` checks `tagName` and `isContentEditable` and nothing else, which satisfies none of the three mechanisms the success criterion names. Scoping camera, time and record keys to the Instrument's `main` landmark is mechanism three, and it removes the failure on `/corrections` and `/submit` by construction rather than leaving those surfaces one forgotten setting away from firing camera moves into a half-filled form.

The global "Single-key shortcuts on/off" control still ships, in the shortcut sheet header and as a palette command, persisted beside `ds-theme`. It is the second line of defence, not the mechanism.

The `A` key is disabled on any surface with no subject, and the shortcut sheet says so.

---

## 5. No class is a dead end

- Every Reading room ends in a records off ramp into the Atlas or `/records`.
- Every Utility surface ends with at least one named next step, never a bare confirmation.
- Every Record page carries session prev and next, an Atlas return and a correction path.
- The Atlas and `/records` empty states name `/submit` rather than saying "no results".

Enforced structurally, not by review: the `/about` destinations block is the adoption gate, and a route not in the palette, the footer and that block is not shipped. A registry test fails when a public route is absent.

---

## 6. Do / Don't

**Do**

- Emit `data-surface` server side, on the page root, on every rendered route
- Read the class in CSS, the plate posture, the keyboard scope and the footer decision
- Put a new route in an existing class, or change the class list deliberately

**Don't**

- Gate shell behaviour on a client route predicate, which cannot be read on first paint
- Add a `:has()` selector keyed on a marker attribute a route happens to set
- Give a route two classes, or a class no route uses
- Let an unmodified key fire on a Reading room, a Record page or a Utility surface

---

## 7. Modules

| Concern | Module | Status |
|---|---|---|
| Class attribute | `apps/web/src/app/layout.tsx`, `shell.css` | Pending (SP-07) |
| Shell above every route | `components/SiteShell.tsx`, `components/shell/CommandBar.tsx` | Bar built, shell rework pending (SP-07) |
| Keyboard scope | `lib/keyboard/bindings.ts` | Pending (SP-17) |
| Destination registry | `lib/nav/destination-registry.ts` | Pending (SP-15) |
| Plate posture | see [`patterns-plate-posture.md`](./patterns-plate-posture.md) | Pending (SP-07, SP-08) |

---

## 8. Tests

| Contract | Assertion |
|---|---|
| Emission | `data-surface` is present server side on every rendered route |
| Coverage | Every route in the resolution map has exactly one class |
| Plate | The posture on each class matches the table in section 3 |
| Keyboard | No unmodified key fires while focus is on body in a Reading room or Utility surface |
| Registry | A public route missing from the palette, the footer, `/about` or the sitemap fails the build |

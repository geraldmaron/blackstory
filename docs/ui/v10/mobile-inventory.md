# Mobile inventory: current entry points

Source inspection: 2026-10-07. This replaces the old v10 snapshot's History and `/learn`
tab directions. Read the implementation when changing routes; this file is an orientation
record, not an independent navigation registry.

| Question                                              | Maintained source                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Tabs and More rows                                    | `apps/mobile/src/shell/mobile-nav.ts`                                                                             |
| Shared destination names, canonical paths and aliases | `packages/public-contracts` destination catalog                                                                   |
| Registered native screens                             | `apps/mobile/src/app/`                                                                                            |
| Mobile treatment and sheet guidance                   | [`../design-direction-v6-mobile.md`](../design-direction-v6-mobile.md), subject to the current navigation catalog |
| Verification                                          | `apps/mobile/README.md`                                                                                           |

The inspected primary tabs are Explore, Stories, Records and More. Legacy `/history`
and `/search` normalize to `/records`; `/learn` normalizes to `/stories`. Web `/rooms`
lands at native `/more`. A More row without a native route opens its explicit web target.
Don't reproduce the old History/Stories/More information architecture from a dated mockup.

Share discovery vocabulary, record meaning, evidence/precision honesty and public access
across platforms. Adapt layout and interaction to the platform. A desktop map panel is
not automatically a usable phone sheet. Filter coverage and current screen behavior need
inspection and task testing, not inference from a shared type or old inventory.

Use the [experience review](../README.md#task-based-experience-review) for large text,
assistive technology, back/restore behavior, network failure and native/web handoffs.
This source inspection does not assert that those interactions passed device testing.

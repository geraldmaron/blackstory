---
name: blackstory-experience-review
description: Review or change BlackStory web and native mobile flows for task success, accessible interaction and honest presentation of evidence. Use for navigation, records, map/list behavior, reading, corrections and responsive usability. Data disagreements between published layers use blackstory-surface-triage.
---

# Experience review

Requires the BlackStory checkout. See [loading and capabilities](../../../docs/research/README.md#skills-and-harness-portability)
for tool requirements and use from any harness.

Use the [UI index](../../../docs/ui/README.md), its
[task-based review](../../../docs/ui/README.md#task-based-experience-review), and
[component registry](../../../docs/ui/patterns-registry.md). Read the affected
surface's code and pattern before proposing a change. Existing conventions are candidates
for reuse, not proof of usability: challenge a rule when observed reader harm or stronger
platform evidence warrants it, and update its owning contract in the same change.

## Start with a reader task

Name the intended reader, starting state and observable outcome. Typical tasks:
find a record by name or place; understand what its pin means; inspect evidence for a
claim; return to filtered results; follow a story; submit and recover a correction receipt.
Choose the tasks affected by the request. Don't turn a local defect into a redesign.

Trace the actual route, state and data source. Shared destination semantics live in
`packages/public-contracts`; native navigation lives in
`apps/mobile/src/shell/mobile-nav.ts`. Old design snapshots are not current route tables.
Reuse the shared kit and established platform components; do not invent a parallel
navigation vocabulary, bottom sheet, dialog or filter-state system.

## Review by risk

1. **Task completion:** clear labels, discoverable actions, preserved filters/selection
   on back, deep links and sensible focus restoration. Search/list must offer a usable
   alternative to a map. Nearby is not related; absent data is not an empty result set.
2. **Evidence comprehension:** essential qualifiers visible in summaries and cards;
   source links reachable; confidence labels don't promise truth; city-scale pins aren't
   exact sites. Don't hide a material caveat in a collapsed note or truncated mobile line.
3. **Accessibility:** semantics, keyboard and screen-reader order, focus visibility,
   contrast in both themes, enlarged text/reflow, reduced motion and adequate targets.
   Do not rely on color, hover, dragging or canvas alone. Use WCAG 2.2 AA for web and
   native platform guidance for native controls; these use different units and tests.
4. **Native interaction:** safe areas, large text, keyboard avoidance, sheet scrolling
   and dismissal, back behavior, interrupted sessions and native/web handoffs. Preserve
   shared meaning without shrinking a desktop layout onto a phone.
5. **Failure and recovery:** loading, empty, timeout, offline, permission denied and
   successful states. Keep entered correction text on recoverable failure. Don't report
   success before the response or use a spinner with no recovery path. Location denial
   must leave manual search available.
6. **Performance:** test a production-like build with realistic record counts and long
   content. Measure task latency, rendering/scrolling and failed requests under stated
   conditions; compare with the existing baseline/budget. A loading animation or a passing
   helper test does not establish performance.

## Evidence, changes and verification

Record the build/release, route, device/viewport, input, steps, expected outcome and actual
result. Distinguish observed defect, heuristic concern and untested hypothesis. Prioritize
blocked tasks and misleading evidence before cosmetic preferences. A modern appearance
is not a substitute for comprehension; use reader task testing for uncertain IA changes.

For code changes, run the real affected project checks and repeat the task on the actual
surface in both themes. Root web checks do not validate native mobile. Follow
`apps/mobile/README.md`: its own lint/typecheck/tests plus the production-like iOS verify
path when claiming the app works. Metro health alone is insufficient. Simulator success
is not proof of real-device assistive-technology or performance behavior.

Deliver prioritized findings, smallest supported fix, checks actually run and residual
risks. A screenshot confirms one state; it does not prove the flow, screen-reader support,
all screen sizes or cross-platform parity. Do not claim those without observing them.

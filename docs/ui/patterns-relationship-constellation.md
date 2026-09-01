# Relationship constellation

**Status:** binding for Place typed connections (v10).  
**Parent:** [`design-direction-v10.md`](./design-direction-v10.md), [`v10/place-anatomy.md`](./v10/place-anatomy.md).

## What it is

The public face of typed archive edges on a Place (or entity) page: who and what this record is connected to, stated in words, with an optional flat diagram for sighted orientation.

## Rules

1. **Typed edges only.** Never treat map proximity as related.
2. **Semantic list required.** The diagram is `aria-hidden`; the list carries the accessible name.
3. **Relation in words.** Mono relation line under or beside the name (`located at`, `founded by`).
4. **Flat matte.** No shadows, glows, gradients, or ornamental motion.
5. **Copper for relation tokens only** (~navigational signal), not body wash.
6. **Nearby / leads stay separate.** Continue-learning and geographic-near lists must not feed this module.

## Module

`apps/web/src/components/patterns/RelationshipConstellation.tsx`  
`apps/web/src/components/patterns/relationship-constellation.css`

## Capacity

Uses container queries: Comfortable multi-column orbit above ~28rem inline size; Compact stacks to one column.

## Do / Never

- Do pass the place display name as `centerLabel`.
- Do keep suggested leads in a separate “Worth investigating next” section.
- Never invent edges the release does not carry.
- Never use alarm hues or heat-map language for violence-adjacent links.

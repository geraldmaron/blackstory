/**
 * Versioned disclaimer-text registry and sensitivity presentation labels (BB-095).
 *
 * ONE registry, keyed by class — site-wide (educational purpose / accuracy limits / not legal or
 * travel advice), per-class (visiting historic sites, private property, sensitive content),
 * non-endorsement (flagged individuals), and safety-advisory language. Every disclaimer carries a
 * `reviewDate`. This is the ONLY place disclaimer text is authored: presentation components in
 * apps/web/src/components/ render these records through shared components — never hand-write a
 * disclaimer string inline (see `disclaimers.test.ts`'s repo check, which fails the build if an
 * ad-hoc disclaimer-shaped string shows up in apps/web app code outside this registry and its
 * consuming components).
 *
 * THREE LANES THIS FILE DOES NOT OWN OR DUPLICATE — see docs/security/entity-sensitivity-lanes.md
 * for the full delineation:
 *   1. BB-090's entity-level `sensitivity` flag schema (packages/domain/src/entity-status.ts) —
 *      this file only adds PRESENTATION labels/copy for that schema, never new flag semantics.
 *   2. BB-015's living-person UGC compliance rules (packages/domain/src/rights/living-person-ugc.ts,
 *      docs/security/ugc-legal-posture.md) — a different system entirely; not touched here.
 *   3. BB-082's historical place-condition designations (sundown-town / redlining-grade layer
 *      records) — a different, still-unbuilt system; this file's `safety_advisory` disclaimer
 *      covers BB-095's own present-day `advisory.ts` claims only, not BB-082's historic layers.
 *
 * INTEGRATION POINT (documented, not wired live — outside this bead's file-ownership boundary):
 * BB-088 (Editorial trust and pre-bunking surfaces, still unbuilt) should import
 * `DISCLAIMER_REGISTRY` / `getDisclaimer` as its disclaimer source rather than authoring its own
 * copy. BB-063's launch checklist already carries the corresponding launch condition ("Disclaimer
 * framework (BB-095) live on all public surfaces... rendering from the versioned registry" — see
 * `bd show black-book-bb063`), so no further bd edit was made by this bead.
 */
import type { SensitivityClass } from './entity-status.js';

export const DISCLAIMER_REGISTRY_VERSION = 'disclaimer-registry.v1' as const;

export const DISCLAIMER_CLASSES = [
  'site_wide',
  'visiting_historic_sites',
  'private_property',
  'sensitive_content',
  'non_endorsement',
  'safety_advisory',
] as const;

export type DisclaimerClass = (typeof DISCLAIMER_CLASSES)[number];

export type DisclaimerRecord = {
  readonly id: string;
  readonly class: DisclaimerClass;
  readonly title: string;
  readonly body: string;
  /** ISO date this disclaimer's language was last reviewed. Required on every record (BB-095 AC3). */
  readonly reviewDate: string;
};

export const DISCLAIMER_REGISTRY: Readonly<Record<DisclaimerClass, DisclaimerRecord>> = {
  site_wide: {
    id: 'disclaimer_site_wide',
    class: 'site_wide',
    title: 'About this record',
    body:
      'Black Book presents documented Black history for educational and journalistic purposes. ' +
      'It is not legal advice, not travel advice, and not a real-time safety service. Accuracy ' +
      'reflects the sources cited on each record as of their retrieval date — verify ' +
      'independently before relying on any record for legal, financial, or travel decisions.',
    reviewDate: '2026-07-17',
  },
  visiting_historic_sites: {
    id: 'disclaimer_visiting_historic_sites',
    class: 'visiting_historic_sites',
    title: 'Visiting historic sites',
    body:
      'Historic sites change over time — ownership, public access, and physical condition are ' +
      'not guaranteed to match this record. Confirm current access and any visiting ' +
      'requirements directly with the site or its current owner before traveling.',
    reviewDate: '2026-07-17',
  },
  private_property: {
    id: 'disclaimer_private_property',
    class: 'private_property',
    title: 'Private property',
    body:
      'This location is documented as private property. Black Book records history; it does ' +
      'not grant, imply, or facilitate access. Property and trespassing laws apply regardless ' +
      "of a site's historical significance.",
    reviewDate: '2026-07-17',
  },
  sensitive_content: {
    id: 'disclaimer_sensitive_content',
    class: 'sensitive_content',
    title: 'Sensitive content',
    body:
      'This record documents historical events or conduct involving violence, discrimination, ' +
      'or other difficult subject matter. Content is presented for its historical and ' +
      'educational value, with sourcing and context, not for sensationalism.',
    reviewDate: '2026-07-17',
  },
  non_endorsement: {
    id: 'disclaimer_non_endorsement',
    class: 'non_endorsement',
    title: 'Inclusion is not endorsement',
    body:
      'Black Book documents historical figures for their verifiable role in the historical ' +
      "record, including figures whose documented conduct is contested or harmful. A figure's " +
      "inclusion in this index is never an endorsement of that individual's actions, views, or " +
      'legacy — it is a record of a documented role in history, shown with evidence and context.',
    reviewDate: '2026-07-17',
  },
  safety_advisory: {
    id: 'disclaimer_safety_advisory',
    class: 'safety_advisory',
    title: 'Present-day advisory',
    body:
      'Present-day advisories on this record are dated, sourced claims about property status, ' +
      'access, or official travel guidance — not a real-time safety assessment. Conditions can ' +
      'change after the stated date; verify current conditions with the cited source or local ' +
      'authorities before traveling.',
    reviewDate: '2026-07-17',
  },
};

export function getDisclaimer(disclaimerClass: DisclaimerClass): DisclaimerRecord {
  return DISCLAIMER_REGISTRY[disclaimerClass];
}

/** Fails closed if any registry entry is missing required fields — the AC3 "every disclaimer
 * carries a review date" guarantee, checked structurally rather than only by inspection. */
export function assertDisclaimerRegistryComplete(): void {
  for (const disclaimerClass of DISCLAIMER_CLASSES) {
    const record = DISCLAIMER_REGISTRY[disclaimerClass];
    if (!record || record.class !== disclaimerClass) {
      throw new Error(`Disclaimer registry missing or mismatched entry for class "${disclaimerClass}"`);
    }
    if (!record.title.trim()) {
      throw new Error(`Disclaimer "${disclaimerClass}" has a blank title.`);
    }
    if (!record.body.trim()) {
      throw new Error(`Disclaimer "${disclaimerClass}" has a blank body.`);
    }
    if (!record.reviewDate.trim()) {
      throw new Error(`Disclaimer "${disclaimerClass}" is missing a reviewDate.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Sensitivity presentation labels (BB-090 schema -> BB-095 presentation)
// ---------------------------------------------------------------------------

/**
 * Human-facing, CONDUCT-based labels for BB-090's `SensitivityClass` vocabulary. Every label
 * names a documented category of conduct (perpetration, violence, contested legacy, enslaver/
 * segregationist action) — never an identity attribute. This mirrors the BB-090 non-goal
 * (sensitivity flags require a conduct-based rationale, never an identity attribute) at the
 * presentation layer: `disclaimers.test.ts` asserts none of these labels, or the non-endorsement
 * copy above, contain identity-attribute language (sexual orientation, disability, religion,
 * immigration status, etc.) from a documented banned-term list.
 */
export const SENSITIVITY_CLASS_PRESENTATION_LABELS: Readonly<Record<SensitivityClass, string>> = {
  contested_legacy: 'Contested legacy',
  perpetrator_associated: 'Associated with documented perpetration',
  violence_associated: 'Associated with documented violence',
  enslaver_or_segregationist: 'Documented enslaver or segregationist conduct',
};

/**
 * Terms that would signal an identity attribute being treated as a flagging rationale rather than
 * conduct. Non-exhaustive by design (this is a presentation-layer regression guard, not the
 * BB-090 data-entry gate — that gate is BB-090's own responsibility and is out of this bead's
 * file-ownership boundary); it exists to prove THIS module's own copy never smuggles identity
 * framing into presentation text.
 */
export const IDENTITY_ATTRIBUTE_TERMS = [
  'gay',
  'lesbian',
  'bisexual',
  'homosexual',
  'transgender',
  'queer',
  'disability',
  'disabled',
  'immigrant',
  'undocumented',
  'religion',
  'muslim',
  'jewish',
  'christian',
  'catholic',
  'atheist',
  'nationality',
  'ethnicity',
  'skin color',
] as const;

/** Scans presentation copy for identity-attribute language; throws if found. Defense-in-depth for
 * the "don't build UI that could invite identity-based flagging" non-goal. */
export function assertNoIdentityAttributeFraming(text: string): void {
  const normalized = text.toLowerCase();
  for (const term of IDENTITY_ATTRIBUTE_TERMS) {
    if (normalized.includes(term)) {
      throw new Error(
        `Sensitivity presentation copy must never reference identity attributes (found "${term}") ` +
          '— sensitivity flags are conduct-based only (BB-090 non-goal); this presentation layer ' +
          'must not undermine that.',
      );
    }
  }
}

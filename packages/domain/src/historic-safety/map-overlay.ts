/**
 * Map-overlay dignity-rule contract for historic-safety layers.
 *
 * This package owns no map UI (`apps/web/src/app/map/**`,
 * `apps/web/src/components/map-experience/**`) — this module is domain-side: the dignity rules
 * an overlay config must satisfy, plus a pure validator, so map rendering can import and
 * enforce the contract without this package ever rendering a map itself.
 *
 * Not wired live: map layer toggle UI should call `assertMapOverlayLayerConfigValid` on every
 * historic-safety overlay entry before rendering it, and should build each overlay's
 * popup/off-ramp copy through `buildNarrativeOffRampLabel` rather than hand-writing overlay copy.
 */
import { HISTORIC_SAFETY_LAYER_LABELS, type HistoricSafetyLayerId } from './types.js';

/** The dignity rules every historic-safety map overlay must follow (design + dignity
 * rules, quoted here for a single canonical list this module's validator enforces). */
export const MAP_OVERLAY_DIGNITY_RULES = [
  'Every historic-safety overlay is opt-in \u2014 never rendered by default.',
  'Rendering uses muted styling only \u2014 no red/danger shading or alert iconography.',
  'Every overlay links to a narrative off-ramp: the underlying evidence/layer-breakdown page, ' +
    'never a bare colored shape with no path to sourcing.',
  'An overlay never renders finer geographic precision than its layer\'s documented tier ' +
    '(see ../layer-record.ts assertAreaConditionRenderPrecisionValid).',
] as const;

/** The only permitted overlay render tone \u2014 deliberately a closed, single-value set: there is
 * no "danger"/"alert" tone for this contract to accidentally support. */
export const MAP_OVERLAY_TONES = ['muted'] as const;
export type MapOverlayTone = (typeof MAP_OVERLAY_TONES)[number];

export class MapOverlayDignityViolationError extends Error {}

/** Style-token substrings a map-rendering caller must never pass through this contract. Mirrors
 * ./advisory.ts's `PROHIBITED_ADVISORY_LANGUAGE` convention for overlay STYLE tokens rather
 * than copy. */
export const PROHIBITED_MAP_OVERLAY_STYLE_TERMS = [
  'danger',
  'alert-red',
  'hazard',
  'unsafe-zone',
  'red-zone',
  'risk-shading',
] as const;

export function assertNoDangerShadingStyleTerm(styleToken: string): void {
  const normalized = styleToken.toLowerCase();
  for (const term of PROHIBITED_MAP_OVERLAY_STYLE_TERMS) {
    if (normalized.includes(term)) {
      throw new MapOverlayDignityViolationError(
        `Map overlay style token "${styleToken}" contains prohibited term "${term}" \u2014 overlays ` +
          'render muted only, never danger/alert shading (dignity rules).',
      );
    }
  }
}

export type MapOverlayLayerConfig = {
  readonly layerId: HistoricSafetyLayerId;
  readonly tone: MapOverlayTone;
  /** Must always be `true` \u2014 the type itself forbids an "opt-out" overlay by construction. */
  readonly optIn: true;
  readonly narrativeOffRampUrl: string;
  readonly styleToken?: string;
};

/** Fails closed on any dignity-rule violation: wrong tone, a non-true optIn literal smuggled in
 * at a JS call site without TS's help, a blank off-ramp URL, or a prohibited style token. */
export function assertMapOverlayLayerConfigValid(config: MapOverlayLayerConfig): void {
  if (!(MAP_OVERLAY_TONES as readonly string[]).includes(config.tone)) {
    throw new MapOverlayDignityViolationError(`Unsupported map overlay tone: ${config.tone}`);
  }
  if (config.optIn !== true) {
    throw new MapOverlayDignityViolationError(
      'Map overlay config optIn must be true \u2014 historic-safety overlays are never rendered by default.',
    );
  }
  if (!config.narrativeOffRampUrl.trim()) {
    throw new MapOverlayDignityViolationError(
      'Map overlay config requires a non-blank narrativeOffRampUrl \u2014 every overlay must link to its evidence.',
    );
  }
  if (config.styleToken) {
    assertNoDangerShadingStyleTerm(config.styleToken);
  }
}

/** Builds the procedural off-ramp label every overlay popup should show \u2014 a link to the
 * layer's evidence, never a standalone verdict. */
export function buildNarrativeOffRampLabel(layerId: HistoricSafetyLayerId): string {
  return `View the ${HISTORIC_SAFETY_LAYER_LABELS[layerId]} evidence for this place`;
}

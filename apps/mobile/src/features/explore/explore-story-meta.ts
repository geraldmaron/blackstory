/**
 * Compact place/era/evidence lines for Explore rail rows and preview chips — one story beat per
 * row, not a label-over-value fact grid wall.
 *
 * Evidence travels as both the printed label and the tier behind it, so a row can draw the shared
 * meter (`RecordMeter`) instead of restating the grade in words a second time.
 */
import type { PreviewFactFeature } from './explore-preview-facts';
import {
  exploreRecordFacts,
  featureConfidenceTier,
  featureSourceCount,
} from './explore-preview-facts';

export type ExploreStoryMeta = {
  readonly where?: string;
  readonly era?: string;
  readonly evidence?: string;
  /** The tier and count behind the label, so a row can draw the meter rather than reprint words. */
  readonly confidenceTier: string;
  readonly sourceCount?: number;
  readonly status?: string;
  /** Theme / topic hooks for the preview "Linked" line. */
  readonly themes?: readonly string[];
  /** Single caption line: "District of Columbia · 1900s". */
  readonly caption: string;
};

function themeHooks(feature: PreviewFactFeature): readonly string[] {
  const props = feature.properties as PreviewFactFeature['properties'] & {
    readonly topicTags?: readonly string[];
    readonly topicIds?: readonly string[];
    readonly status?: string;
  };
  const tags = props.topicTags?.filter((tag) => tag.trim().length > 0) ?? [];
  if (tags.length > 0) return tags.slice(0, 3);
  const ids = props.topicIds?.filter((id) => id.trim().length > 0) ?? [];
  return ids.slice(0, 3);
}

function statusLabel(feature: PreviewFactFeature): string | undefined {
  const status = (feature.properties as { readonly status?: string }).status?.trim();
  if (!status) return undefined;
  return status.charAt(0).toUpperCase() + status.slice(1);
}

/** Sparse where / era / evidence for icon chips and rail captions. */
export function exploreStoryMeta(feature: PreviewFactFeature): ExploreStoryMeta {
  const facts = exploreRecordFacts(feature);
  const where = facts.find((f) => f.key === 'where')?.value;
  const era = facts.find((f) => f.key === 'era')?.value;
  const evidence = facts.find((f) => f.key === 'evidence')?.value;
  const confidenceTier = featureConfidenceTier(feature);
  const sourceCount = featureSourceCount(feature);
  const status = statusLabel(feature);
  const themes = themeHooks(feature);

  const caption = [where, era].filter(Boolean).join(' · ');
  return {
    ...(where ? { where } : {}),
    ...(era ? { era } : {}),
    ...(evidence ? { evidence } : {}),
    confidenceTier,
    ...(sourceCount !== undefined ? { sourceCount } : {}),
    ...(status ? { status } : {}),
    ...(themes.length > 0 ? { themes } : {}),
    caption,
  };
}

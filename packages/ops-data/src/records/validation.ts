/** Validates public projections and enforces publication redaction. */
import type { z } from 'zod';
import { assertLearningIndexProjection, sanitizePrimaryImageForRelease } from '@repo/domain';
import { assertPublicProjectionSafe } from '@repo/security';
import { publicEntityProjectionSchema, type PublicEntityProjectionDoc } from './types.js';

export function preparePublicEntityProjectionForWrite(
  modelObject: PublicEntityProjectionDoc,
): PublicEntityProjectionDoc {
  const parsed = publicEntityProjectionSchema.parse(modelObject);
  const parsedPrimaryImage =
    parsed.primaryImage !== undefined
      ? {
          url: parsed.primaryImage.url,
          alt: parsed.primaryImage.alt,
          credit: parsed.primaryImage.credit,
          rightsStatus: parsed.primaryImage.rightsStatus,
          ...(parsed.primaryImage.width !== undefined ? { width: parsed.primaryImage.width } : {}),
          ...(parsed.primaryImage.height !== undefined
            ? { height: parsed.primaryImage.height }
            : {}),
          ...(parsed.primaryImage.objectPath !== undefined
            ? { objectPath: parsed.primaryImage.objectPath }
            : {}),
        }
      : undefined;
  const primaryImage = sanitizePrimaryImageForRelease(parsedPrimaryImage);

  const prepared = {
    ...parsed,
    ...(primaryImage !== undefined ? { primaryImage } : {}),
  } as PublicEntityProjectionDoc;

  if (primaryImage === undefined && 'primaryImage' in prepared) {
    delete (prepared as { primaryImage?: unknown }).primaryImage;
  }

  const normalizedRelated = prepared.related?.map((entry) => ({
    id: entry.id,
    type: entry.type,
    direction: entry.direction,
    ...(entry.timespan !== undefined
      ? {
          timespan: {
            ...(entry.timespan.label !== undefined ? { label: entry.timespan.label } : {}),
            ...(entry.timespan.validFrom !== undefined
              ? { validFrom: entry.timespan.validFrom }
              : {}),
            ...(entry.timespan.validTo !== undefined ? { validTo: entry.timespan.validTo } : {}),
          },
        }
      : {}),
  }));

  assertLearningIndexProjection({
    summary: prepared.summary,
    topicTags: prepared.topicTags,
    ...(prepared.historicalContext !== undefined
      ? { historicalContext: prepared.historicalContext }
      : {}),
    ...(prepared.extendedNarrative !== undefined
      ? { extendedNarrative: prepared.extendedNarrative }
      : {}),
    ...(primaryImage !== undefined ? { primaryImage } : {}),
    ...(normalizedRelated !== undefined ? { related: normalizedRelated } : {}),
  });
  assertPublicProjectionSafe(prepared);
  return prepared;
}

export function parseWithSchema<T>(schema: z.ZodType<T>, data: unknown): T {
  return schema.parse(data);
}

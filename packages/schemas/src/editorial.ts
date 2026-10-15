/** Private drafts retain the public block format while allowing unfinished prose. */
import { z } from 'zod';
import {
  articleBodyBlockSchema,
  articleContributorSchema,
  publicArticleProjectionSchema,
} from './public-articles.js';

// Draft text remains bounded while publication enforces completed field formats.
// Recursion preserves the exact supported object keys and discriminators.
function unfinished(schema: z.ZodTypeAny): z.ZodTypeAny {
  if (schema instanceof z.ZodString) return z.string().max(schema.maxLength ?? 100000);
  if (schema instanceof z.ZodDefault)
    return unfinished(schema.removeDefault()).default(schema._def.defaultValue());
  if (schema instanceof z.ZodOptional)
    return z.preprocess(
      (value) => (value === '' ? undefined : value),
      unfinished(schema.unwrap()).optional(),
    );
  if (schema instanceof z.ZodArray) return z.array(unfinished(schema.element)).max(500);
  if (schema instanceof z.ZodObject)
    return z.object(
      Object.fromEntries(
        Object.entries(schema.shape).map(([key, value]) => [
          key,
          unfinished(value as z.ZodTypeAny),
        ]),
      ),
    );
  return schema;
}
const draftBlocks = articleBodyBlockSchema.options.map((schema) => unfinished(schema));
export const articleDraftSchema = publicArticleProjectionSchema.omit({ releaseId: true }).extend({
  title: z.string().max(160),
  summary: z.string().max(600),
  eraLabel: z.string().max(80),
  placeLabel: z.string().max(120),
  heroImage: unfinished(publicArticleProjectionSchema.shape.heroImage),
  references: unfinished(publicArticleProjectionSchema.shape.references),
  body: z.array(z.union(draftBlocks as [z.ZodTypeAny, z.ZodTypeAny, ...z.ZodTypeAny[]])).max(500),
}) as unknown as z.ZodType<Omit<z.infer<typeof publicArticleProjectionSchema>, 'releaseId'>>;
export type ArticleDraft = z.infer<typeof articleDraftSchema>;
export const editorialContributorSchema = articleContributorSchema
  .omit({ roles: true })
  .extend({ biography: z.string().max(2000) });
export const editorialContributorMutationSchema = editorialContributorSchema.extend({
  linkToMe: z.boolean().optional(),
});
export type EditorialContributor = z.infer<typeof editorialContributorSchema>;
export type EditorialArticle = {
  draft: ArticleDraft;
  revision: number;
  blockers?: string[];
  status: 'draft' | 'review' | 'published';
  publication?: {
    releaseId: string;
    previousReleaseId: string;
    revision: number;
    canRollback: boolean;
  } | null;
  review: { decision: string; reason: string; reviewerId: string } | null;
  history: { revision: number; actorId: string; reason: string; createdAt: string }[];
};

import { RELATIONSHIP_TYPES } from './relationship-vocabulary.js';
export const entityEditorialProposalSchema = z.object({
  entityId: z.string().min(1).max(200),
  beforeHash: z.string().regex(/^[a-f0-9]{64}$/),
  summary: z.string().trim().min(1).max(2000),
  historicalContext: z.string().max(20000),
  evidence: z
    .array(
      z.object({
        url: z.string().url().max(2048),
        title: z.string().trim().min(1).max(300),
        excerpt: z.string().trim().min(1).max(5000),
      }),
    )
    .min(1)
    .max(30),
  relationships: z
    .array(
      z.object({
        targetId: z.string().min(1).max(200),
        predicate: z.enum(RELATIONSHIP_TYPES),
        statement: z.string().trim().min(1).max(2000),
        evidenceIndex: z.number().int().min(0).max(29),
      }),
    )
    .max(30),
});
export type EntityEditorialProposal = z.infer<typeof entityEditorialProposalSchema>;

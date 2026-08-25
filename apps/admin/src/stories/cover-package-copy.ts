/**
 * Editor-facing copy for the article cover form. Helper text is owned by
 * the CoverPackage contract so Content and the gate cannot drift.
 */
import { COVER_BRIEF_HELPERS, COVER_RECIPES, type CoverRecipe } from '@repo/domain';

export const COVER_FORM_INTENT =
  'A cover is a brief, a recipe, and a plate drawn against the house lock. No brief, no cover. This desk does not invent a player surface.';

export const COVER_FORM_STEPS = [
  'Write the three brief fields next to the plate: situation, metaphor, refuse.',
  'Pick one closed recipe: object-as-metaphor, scene, character, or doodle-diagram.',
  'Upload the felt-tip plate and cite the versioned house lock. The lock is the scan, not a prompt.',
  'Set kicker and headline so they sit under the full-bleed plate.',
  'Publish only when the package is valid. A missing or stock-like plate fails closed.',
] as const;

export const COVER_FORM_HOUSE_HAND =
  'One hand: dry felt-tip, slightly wobbly, one weight. Cream paper, blue-black ink, one burnt-ochre sliver. Hatch fills only. Same pen, same paper crop, same four recipes.';

export const COVER_BRIEF_FIELD_COPY = {
  situation: {
    label: 'Situation',
    helper: COVER_BRIEF_HELPERS.situation,
  },
  metaphor: {
    label: 'Metaphor',
    helper: COVER_BRIEF_HELPERS.metaphor,
  },
  refuse: {
    label: 'Refuse',
    helper: COVER_BRIEF_HELPERS.refuse,
  },
} as const;

export const COVER_RECIPE_LABELS: Readonly<Record<CoverRecipe, string>> = {
  'object-as-metaphor': 'object-as-metaphor',
  scene: 'scene',
  character: 'character',
  'doodle-diagram': 'doodle-diagram',
};

export const COVER_RECIPE_OPTIONS = COVER_RECIPES.map((recipe) => ({
  value: recipe,
  label: COVER_RECIPE_LABELS[recipe],
}));

export const COVER_PUBLISH_BLOCKED =
  'Publish is blocked. The cover package is not valid. No brief, no cover.';

export const COVER_PUBLISH_READY =
  'Cover package recorded for release assembly. The public site does not change until Releases activates a signed manifest.';

/**
 * Back-compat wrapper: homepage beats live in `HomeEdition`. Prefer importing
 * `HomeEdition` from new page composition.
 */

export {
  HomeEdition,
  HomeEdition as HomeStorySections,
  type HomeEditionProps,
  type HomeEditionProps as HomeStorySectionsProps,
  type HomeStoryEntity,
  type StateStartEntry,
} from './HomeEdition';

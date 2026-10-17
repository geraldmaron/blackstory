/**
 * Noninteractive text helper for base.css `.ds-visually-hidden`.
 * A transparent, clipped-to-overflow box preserves accessible text without literal clip geometry.
 * Unlike the source skip-link utility this helper does not reveal interactive content on focus.
 */
import { styled } from '@tamagui/core';
import { SizableText } from '@tamagui/text';

export const VisuallyHidden = styled(SizableText, {
  name: 'VisuallyHidden',
  render: 'span',
  position: 'absolute',
  width: 1,
  height: 1,
  maxWidth: 1,
  padding: 0,
  margin: 0,
  borderWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  opacity: 0,
  pointerEvents: 'none',
});

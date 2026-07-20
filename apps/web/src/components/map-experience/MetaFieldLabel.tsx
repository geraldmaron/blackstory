/**
 * Field label with native hover help (`title`) and a screen-reader description.
 * Used for Explore result meta (`dt`) and filter facet captions.
 */
import React from 'react';
import { cx } from '@repo/ui';
import { metaFieldHelp, type MetaFieldKey } from '../../lib/map-experience/metadata-help';

void React;

export type MetaFieldLabelProps = {
  readonly field: MetaFieldKey;
  readonly children: React.ReactNode;
  readonly className?: string;
  /** Render as `dt` (result meta) or `span` (filter caption). */
  readonly as?: 'dt' | 'span';
};

export function MetaFieldLabel({
  field,
  children,
  className,
  as = 'dt',
}: MetaFieldLabelProps) {
  const help = metaFieldHelp(field);
  const Tag = as;
  return (
    <Tag className={cx('ds-meta-field-label', className)} title={help}>
      <span className="ds-meta-field-label__text">{children}</span>
      <span className="ds-visually-hidden">{help}</span>
    </Tag>
  );
}

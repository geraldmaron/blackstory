'use client';

/**
 * The record page's Cite control: MLA, APA and Chicago for the page's canonical URL
 * (docs/ui/DESIGN.md section 7.3). The access date is injected by the server render, then set to
 * the reader's own day once the page is live, so a cached page never hands out a stale date.
 */
import React, { useEffect, useState } from 'react';
import { Cite } from '@repo/ui';
import { formatStyledCitations } from '../../lib/citation/format';

void React;

export type RecordCiteSource = {
  /** The page's title: the record's name. */
  readonly title: string;
  /** The page's canonical URL, absolute. */
  readonly url: string;
  /** The page's last-revision date (ISO). Never the subject's date. Omit when not on record. */
  readonly published?: string;
};

function validDate(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

export function RecordCite({
  title,
  url,
  published,
  accessed,
}: RecordCiteSource & { /** ISO date of the server render. */ readonly accessed: string }) {
  const [on, setOn] = useState(accessed);
  useEffect(() => setOn(new Date().toISOString()), []);
  return (
    <Cite
      className="ds-recpage__cite"
      formats={formatStyledCitations({
        title,
        url,
        accessed: validDate(on) ?? new Date(),
        published: validDate(published),
      })}
    />
  );
}

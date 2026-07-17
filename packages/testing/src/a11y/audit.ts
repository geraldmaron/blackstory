/**
 * WCAG-oriented HTML fixture audits for core public journeys (BB-057).
 * Complements lightweight smoke checks with heading order, landmark, and form-label rules
 * executable without a browser stack — full axe/Playwright coverage lands separately.
 */

import type { A11yFixtureIssue } from './html-smoke.js';
import { auditHtmlSmoke } from './html-smoke.js';

export type A11yAuditResult = {
  readonly issues: readonly A11yFixtureIssue[];
  readonly passed: boolean;
};

const HEADING_TAG = /<(h[1-6])\b[^>]*>/gi;

/**
 * Runs smoke checks plus heading-order and supplementary landmark assertions.
 */
export function auditHtmlFixture(html: string): A11yAuditResult {
  const issues: A11yFixtureIssue[] = [...auditHtmlSmoke(html)];

  const headings = [...html.matchAll(HEADING_TAG)].map((match) => match[1]?.toLowerCase()).filter(Boolean);
  if (headings.length > 0) {
    const first = headings[0];
    if (first !== 'h1') {
      issues.push({
        code: 'heading-first-h1',
        message: 'Document landmark content must begin with a single h1',
      });
    }
    let priorLevel = 0;
    for (const tag of headings) {
      const level = Number(tag?.slice(1));
      if (priorLevel > 0 && level - priorLevel > 1) {
        issues.push({
          code: 'heading-skip-level',
          message: `Heading level skipped from h${priorLevel} to h${level}`,
        });
        break;
      }
      priorLevel = level;
    }
  }

  if (/<form\b/i.test(html) && /<input\b(?![^>]*\bid=)/i.test(html) && !/<label\b/i.test(html)) {
    issues.push({
      code: 'form-unlabeled-input',
      message: 'Form inputs must be associated with visible labels',
    });
  }

  if (/<a\b[^>]*href=["']#["']/i.test(html) && !/<a\b[^>]*\baria-label=/i.test(html)) {
    issues.push({
      code: 'link-empty-hash',
      message: 'Placeholder hash links require an accessible name',
    });
  }

  if (/<nav\b/i.test(html) && !/<nav\b[^>]*\baria-label=/i.test(html) && !/<nav\b[^>]*\baria-labelledby=/i.test(html)) {
    issues.push({
      code: 'nav-accessible-name',
      message: 'Navigation regions require aria-label or aria-labelledby',
    });
  }

  return Object.freeze({
    issues: Object.freeze(issues),
    passed: issues.length === 0,
  });
}

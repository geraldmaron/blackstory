/**
 * Lightweight accessibility fixture helpers for representative a11y tests.
 * Full browser axe/Playwright coverage lands with UI; this layer stays executable now.
 */

export type A11yFixtureIssue = {
  readonly code: string;
  readonly message: string;
};

/**
 * Validates a minimal HTML string for landmark/heading presence used in smoke a11y checks.
 */
export function auditHtmlSmoke(html: string): A11yFixtureIssue[] {
  const issues: A11yFixtureIssue[] = [];
  if (!/<main\b/i.test(html)) {
    issues.push({ code: 'landmark-main', message: 'Missing <main> landmark' });
  }
  if (!/<h1\b/i.test(html)) {
    issues.push({ code: 'heading-h1', message: 'Missing single-page <h1>' });
  }
  if (/<img\b(?![^>]*\balt=)/i.test(html)) {
    issues.push({ code: 'img-alt', message: 'Found <img> without alt attribute' });
  }
  if (/tabindex\s*=\s*["']?[1-9]/i.test(html)) {
    issues.push({
      code: 'tabindex-positive',
      message: 'Positive tabindex values disrupt natural focus order',
    });
  }
  return issues;
}

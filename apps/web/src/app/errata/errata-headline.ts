/** Errata headline parsing, shared by the log and the record resolver. Pure and client-safe. */

export function errataDate(timestamp: string): string {
  return timestamp.split('T')[0] ?? timestamp;
}

/**
 * What the change was about and what changed, split from the headline. Headlines are written
 * "Record name: what changed"; one with no colon is about the archive itself.
 */
export function splitErrataHeadline(headline: string): {
  readonly subject: string | undefined;
  readonly change: string;
} {
  const index = headline.indexOf(': ');
  if (index <= 0) return { subject: undefined, change: headline };
  const change = headline.slice(index + 2);
  return {
    subject: headline.slice(0, index),
    change: change.charAt(0).toUpperCase() + change.slice(1),
  };
}

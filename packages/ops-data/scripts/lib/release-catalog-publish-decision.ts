/**
 * Pure decision logic for publish-release-catalog-artifacts.ts's watermark + hash-guard
 * skip behavior. Extracted so the actual branching (the part that had a real bug during
 * development — hashing the full artifact including a fresh `generatedAt` timestamp, which
 * never matches run-to-run) is unit-testable without a live database or Storage.
 */

export function shouldSkipPublish(input: {
  readonly dryRun: boolean;
  readonly force: boolean;
  readonly dirtyAt: Date | null;
  readonly publishedAt: Date | null;
}): boolean {
  if (input.dryRun || input.force) return false;
  if (input.dirtyAt === null || input.publishedAt === null) return false;
  return input.dirtyAt.getTime() <= input.publishedAt.getTime();
}

export function shouldUploadArtifact(input: {
  readonly force: boolean;
  readonly newHash: string;
  readonly previousHash: string | null;
}): boolean {
  return input.force || input.newHash !== input.previousHash;
}

/**
 * Changelog generation from git history.
 * Prefers conventional commit prefixes; falls back to subject lines.
 */
import { spawnSync } from 'node:child_process';

const CONVENTIONAL_RE =
  /^(?<type>[a-z]+)(?:\((?<scope>[^)]+)\))?(?<breaking>!)?: (?<subject>.+)$/i;

const TYPE_ORDER = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'chore', 'ci', 'build'];

/**
 * @param {string} repoRoot
 * @param {{ fromSha?: string; toSha: string; maxEntries?: number }} options
 */
export function generateChangelog(repoRoot, options) {
  const { fromSha, toSha, maxEntries = 200 } = options;
  if (!/^[0-9a-f]{40}$/i.test(toSha)) {
    throw new Error(`toSha must be a 40-char commit SHA (got ${toSha})`);
  }
  if (fromSha && !/^[0-9a-f]{40}$/i.test(fromSha)) {
    throw new Error(`fromSha must be a 40-char commit SHA (got ${fromSha})`);
  }

  const range = fromSha ? `${fromSha}..${toSha}` : toSha;
  const result = spawnSync(
    'git',
    ['log', '--pretty=format:%H|%s|%an', `-n`, String(maxEntries), range],
    { cwd: repoRoot, encoding: 'utf8' },
  );
  if (result.status !== 0) {
    throw new Error(`git log failed: ${result.stderr || result.stdout}`);
  }

  const lines = result.stdout
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  /** @type {Map<string, Array<{ sha: string; subject: string; author: string; scope?: string; breaking?: boolean }>>} */
  const grouped = new Map();

  for (const line of lines) {
    const [sha, subject, author] = line.split('|');
    if (!sha || !subject) {
      continue;
    }
    const match = subject.match(CONVENTIONAL_RE);
    const type = match?.groups?.type?.toLowerCase() ?? 'other';
    const scope = match?.groups?.scope;
    const breaking = Boolean(match?.groups?.breaking);
    const normalizedSubject = match?.groups?.subject ?? subject;
    if (!grouped.has(type)) {
      grouped.set(type, []);
    }
    grouped.get(type)?.push({
      sha: sha.slice(0, 7),
      subject: normalizedSubject,
      author: author ?? 'unknown',
      ...(scope ? { scope } : {}),
      ...(breaking ? { breaking: true } : {}),
    });
  }

  const orderedTypes = [
    ...TYPE_ORDER.filter((type) => grouped.has(type)),
    ...[...grouped.keys()].filter((type) => !TYPE_ORDER.includes(type)),
  ];

  const sections = orderedTypes.map((type) => {
    const entries = grouped.get(type) ?? [];
    const title = type.charAt(0).toUpperCase() + type.slice(1);
    const bullets = entries.map((entry) => {
      const scopePrefix = entry.scope ? `**${entry.scope}:** ` : '';
      const breakingPrefix = entry.breaking ? '**BREAKING** ' : '';
      return `- ${breakingPrefix}${scopePrefix}${entry.subject} (${entry.sha}, ${entry.author})`;
    });
    return `### ${title}\n\n${bullets.join('\n')}`;
  });

  const header = fromSha
    ? `# Changelog (${fromSha.slice(0, 7)}..${toSha.slice(0, 7)})\n`
    : `# Changelog (${toSha.slice(0, 7)})\n`;

  return `${header}\n${sections.join('\n\n')}\n`;
}

/**
 * @param {string} repoRoot
 * @param {string} sha
 */
export function resolveCommitMessage(repoRoot, sha) {
  const result = spawnSync('git', ['log', '-1', '--pretty=format:%s', sha], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    throw new Error(`git log failed for ${sha}: ${result.stderr || result.stdout}`);
  }
  return result.stdout.trim();
}

/** Install the frozen graph, rebuilding dependency links only when the restored cache is broken. */
import { execFileSync } from 'node:child_process';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function entries(directory) {
  try {
    return readdirSync(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

function brokenLinks(directory) {
  return entries(directory).flatMap((entry) => {
    const target = join(directory, entry.name);
    if (entry.isDirectory() && entry.name.startsWith('@')) return brokenLinks(target);
    if (!entry.isSymbolicLink()) return [];
    try {
      statSync(target);
      return [];
    } catch (error) {
      if (error.code === 'ENOENT') return [target];
      throw error;
    }
  });
}

function discardBrokenCache() {
  const broken = brokenLinks(join(root, 'node_modules/.pnpm/node_modules'));
  if (broken.length === 0) return false;
  console.log(`Discarding restored dependencies with ${broken.length} broken hoisted links.`);
  // Workspace links refer into the root store and must be recreated together.
  for (const group of ['apps', 'packages']) {
    for (const entry of entries(join(root, group))) {
      if (entry.isDirectory()) {
        rmSync(join(root, group, entry.name, 'node_modules'), { recursive: true, force: true });
      }
    }
  }
  rmSync(join(root, 'node_modules'), { recursive: true, force: true });
  return true;
}

function install() {
  execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: root, stdio: 'inherit' });
}

discardBrokenCache();
install();
// A lockfile transition can remove targets while retaining an older hoist's symlinks.
if (discardBrokenCache()) install();
if (brokenLinks(join(root, 'node_modules/.pnpm/node_modules')).length > 0) {
  throw new Error('Frozen install left broken dependency links');
}

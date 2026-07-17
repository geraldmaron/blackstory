/**
 * Copies CSS styles into dist so built package consumers can import styles.css.
 */
import { cp, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const from = path.join(root, 'src', 'styles');
const to = path.join(root, 'dist', 'styles');

await mkdir(to, { recursive: true });
await cp(from, to, { recursive: true });

/**
 * Must be imported first in the Functions entrypoint so DISCOVERY_REPO_ROOT is set
 * before any bundled package resolves fixture/constitution paths from disk.
 */
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.DISCOVERY_REPO_ROOT ??= dirname(fileURLToPath(import.meta.url));

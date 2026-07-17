/**
 * Build and validate deployment provenance documents (BB-062).
 * Schema: infra/github/release-metadata/deployment-provenance.schema.json
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const SCHEMA_PATH = path.join(
  ROOT,
  'infra/github/release-metadata/deployment-provenance.schema.json',
);

const SHA_RE = /^[0-9a-f]{40}$/;

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === 'string' && value.length > 0;
}

/**
 * @param {Record<string, unknown>} input
 */
export function buildProvenance(input) {
  const {
    environment,
    commitSha,
    ref,
    repository,
    repositoryId,
    ownerId,
    workflow,
    workflowRef,
    runId,
    runAttempt,
    serverUrl,
    workloadIdentityProvider,
    serviceAccountEmail,
    deployedAt,
    artifacts = [],
    notes = '',
  } = input;

  if (!['production', 'staging'].includes(String(environment))) {
    throw new Error(`environment must be production or staging (got ${environment})`);
  }
  if (!SHA_RE.test(String(commitSha))) {
    throw new Error(`commitSha must be a 40-char git SHA (got ${commitSha})`);
  }

  return {
    schemaVersion: 1,
    projectId: 'black-book-efaaf',
    environment,
    git: {
      commitSha: String(commitSha),
      ref: String(ref),
    },
    github: {
      repository: String(repository),
      repositoryId: String(repositoryId),
      ownerId: String(ownerId),
      workflow: String(workflow),
      workflowRef: String(workflowRef),
      runId: String(runId),
      runAttempt: String(runAttempt),
      serverUrl: String(serverUrl),
    },
    identity: {
      authMethod: 'github-oidc-wif',
      workloadIdentityProvider: String(workloadIdentityProvider),
      serviceAccountEmail: String(serviceAccountEmail),
    },
    deployedAt: String(deployedAt),
    artifacts: Array.isArray(artifacts) ? artifacts : [],
    ...(notes ? { notes: String(notes) } : {}),
  };
}

/**
 * Minimal JSON Schema validator for deployment-provenance.schema.json (no external deps).
 * @param {unknown} doc
 * @param {Record<string, unknown>} schema
 */
export function validateAgainstSchema(doc, schema) {
  const errors = [];

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    return { ok: false, errors: ['document must be an object'] };
  }

  const record = /** @type {Record<string, unknown>} */ (doc);
  const props = /** @type {Record<string, unknown>} */ (schema.properties ?? {});
  const required = /** @type {string[]} */ (schema.required ?? []);

  for (const key of required) {
    if (!(key in record)) {
      errors.push(`missing required field: ${key}`);
    }
  }

  for (const [key, value] of Object.entries(record)) {
    const rule = props[key];
    if (!rule) {
      if (schema.additionalProperties === false) {
        errors.push(`unexpected field: ${key}`);
      }
      continue;
    }
    validateField(key, value, rule, errors);
  }

  return { ok: errors.length === 0, errors };
}

/**
 * @param {string} pathKey
 * @param {unknown} value
 * @param {Record<string, unknown>} rule
 * @param {string[]} errors
 */
function validateField(pathKey, value, rule, errors) {
  if (rule.const !== undefined && value !== rule.const) {
    errors.push(`${pathKey}: expected const ${rule.const}`);
    return;
  }

  if (rule.enum && !rule.enum.includes(value)) {
    errors.push(`${pathKey}: must be one of ${rule.enum.join(', ')}`);
    return;
  }

  if (rule.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${pathKey}: must be string`);
      return;
    }
    if (rule.pattern && !new RegExp(String(rule.pattern)).test(value)) {
      errors.push(`${pathKey}: must match ${rule.pattern}`);
    }
    if (rule.format === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors.push(`${pathKey}: must be email`);
    }
    if (rule.format === 'uri' && !/^https?:\/\//.test(value)) {
      errors.push(`${pathKey}: must be uri`);
    }
    if (rule.format === 'date-time' && Number.isNaN(Date.parse(value))) {
      errors.push(`${pathKey}: must be date-time`);
    }
    return;
  }

  if (rule.type === 'integer') {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      errors.push(`${pathKey}: must be integer`);
    }
    return;
  }

  if (rule.type === 'array') {
    if (!Array.isArray(value)) {
      errors.push(`${pathKey}: must be array`);
      return;
    }
    const itemRule = /** @type {Record<string, unknown>} */ (rule.items ?? {});
    for (let i = 0; i < value.length; i += 1) {
      validateField(`${pathKey}[${i}]`, value[i], itemRule, errors);
    }
    return;
  }

  if (rule.type === 'object') {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      errors.push(`${pathKey}: must be object`);
      return;
    }
    const nested = /** @type {Record<string, unknown>} */ (value);
    const nestedProps = /** @type {Record<string, unknown>} */ (rule.properties ?? {});
    const nestedRequired = /** @type {string[]} */ (rule.required ?? []);
    for (const req of nestedRequired) {
      if (!(req in nested)) {
        errors.push(`${pathKey}.${req}: missing required field`);
      }
    }
    for (const [nestedKey, nestedValue] of Object.entries(nested)) {
      const nestedRule = nestedProps[nestedKey];
      if (!nestedRule) {
        if (rule.additionalProperties === false) {
          errors.push(`${pathKey}: unexpected field ${nestedKey}`);
        }
        continue;
      }
      validateField(`${pathKey}.${nestedKey}`, nestedValue, nestedRule, errors);
    }
  }
}

export async function loadSchema() {
  const raw = await readFile(SCHEMA_PATH, 'utf8');
  return /** @type {Record<string, unknown>} */ (JSON.parse(raw));
}

/**
 * @param {unknown} doc
 */
export async function validateProvenance(doc) {
  const schema = await loadSchema();
  return validateAgainstSchema(doc, schema);
}

/**
 * @param {Record<string, unknown>} input
 */
export async function buildAndValidateProvenance(input) {
  const doc = buildProvenance(input);
  const result = await validateProvenance(doc);
  if (!result.ok) {
    throw new Error(`provenance validation failed: ${result.errors.join('; ')}`);
  }
  return doc;
}

/**
 * @param {unknown} doc
 */
export function assertPinnedCommit(doc) {
  if (typeof doc !== 'object' || doc === null) {
    throw new Error('provenance document must be an object');
  }
  const git = /** @type {{ commitSha?: string }} */ (
    /** @type {Record<string, unknown>} */ (doc).git ?? {}
  );
  if (!isNonEmptyString(git.commitSha) || !SHA_RE.test(git.commitSha)) {
    throw new Error('provenance git.commitSha must be a pinned 40-char SHA');
  }
  return git.commitSha;
}

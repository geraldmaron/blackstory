import { Ajv2020, type ErrorObject, type ValidateFunction } from 'ajv/dist/2020.js';
import addFormatsModule from 'ajv-formats';

import researchKernelSchema from '../schemas/research-kernel.v1.schema.json' with { type: 'json' };
import type { ResearchContractMap, ResearchContractName } from './generated/contracts.js';

export * from './generated/contracts.js';

const ajv = new Ajv2020({
  allErrors: true,
  strict: true,
  validateFormats: true,
});
const addFormats = addFormatsModule as unknown as (instance: Ajv2020) => Ajv2020;
addFormats(ajv);
ajv.addSchema(researchKernelSchema);

export interface ContractValidationSuccess<T> {
  readonly ok: true;
  readonly value: T;
}

export interface ContractValidationFailure {
  readonly ok: false;
  readonly errors: readonly string[];
}

export type ContractValidationResult<T> = ContractValidationSuccess<T> | ContractValidationFailure;

function validatorFor(name: ResearchContractName): ValidateFunction {
  const validator = ajv.getSchema(`${researchKernelSchema.$id}#/$defs/${name}`);
  if (validator === undefined) {
    throw new Error(`Unknown research contract: ${name}`);
  }
  return validator;
}

/** Standalone schema for provider structured-output requests, from the same validation source. */
export function contractSchema(name: ResearchContractName): Readonly<Record<string, unknown>> {
  const definitions: Record<string, unknown> = {};
  const visit = (value: unknown): void => {
    if (value === null || typeof value !== 'object') return;
    for (const [key, child] of Object.entries(value)) {
      if (key === '$ref' && typeof child === 'string') {
        const ref = child.replace('#/$defs/', '') as ResearchContractName;
        if (!(ref in definitions)) {
          definitions[ref] = researchKernelSchema.$defs[ref];
          visit(definitions[ref]);
        }
      } else visit(child);
    }
  };
  const root = researchKernelSchema.$defs[name];
  visit(root);
  return { ...root, ...(Object.keys(definitions).length ? { $defs: definitions } : {}) };
}

function formatError(error: ErrorObject): string {
  const path = error.instancePath.length > 0 ? error.instancePath : '/';
  return `${path} ${error.message ?? error.keyword}`;
}

export function validateContract<K extends ResearchContractName>(
  name: K,
  candidate: unknown,
): ContractValidationResult<ResearchContractMap[K]> {
  const validator = validatorFor(name);
  if (validator(candidate)) {
    return { ok: true, value: candidate as ResearchContractMap[K] };
  }
  return {
    ok: false,
    errors: (validator.errors ?? []).map(formatError),
  };
}

export function assertContract<K extends ResearchContractName>(
  name: K,
  candidate: unknown,
): ResearchContractMap[K] {
  const result = validateContract(name, candidate);
  if (!result.ok) {
    throw new Error(`Invalid ${name}: ${result.errors.join('; ')}`);
  }
  return result.value;
}

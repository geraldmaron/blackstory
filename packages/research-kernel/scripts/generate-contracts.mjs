import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { format } from 'prettier';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const schemaPath = join(packageRoot, 'schemas', 'research-kernel.v1.schema.json');
const tsPath = join(packageRoot, 'src', 'generated', 'contracts.ts');
const pythonPath = join(packageRoot, 'python', 'src', 'research_kernel', 'models.py');
const checkOnly = process.argv.includes('--check');

const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
const definitions = schema.$defs;

if (definitions === undefined || typeof definitions !== 'object') {
  throw new Error('research kernel schema must define $defs');
}

function refName(ref) {
  const match = /^#\/\$defs\/([A-Za-z][A-Za-z0-9]*)$/.exec(ref);
  if (match === null) throw new Error(`unsupported schema reference: ${ref}`);
  return match[1];
}

function tsType(node) {
  if (node.$ref !== undefined) return refName(node.$ref);
  if (node.const !== undefined) return JSON.stringify(node.const);
  if (node.enum !== undefined) return node.enum.map((item) => JSON.stringify(item)).join(' | ');
  if (node.oneOf !== undefined) return node.oneOf.map(tsType).join(' | ');
  if (Array.isArray(node.type))
    return node.type.map((type) => tsType({ ...node, type })).join(' | ');
  if (node.type === 'string') return 'string';
  if (node.type === 'number' || node.type === 'integer') return 'number';
  if (node.type === 'boolean') return 'boolean';
  if (node.type === 'null') return 'null';
  if (node.type === 'array') return `readonly (${tsType(node.items ?? {})})[]`;
  if (node.type === 'object') {
    const properties = node.properties ?? {};
    if (Object.keys(properties).length === 0) {
      const value =
        typeof node.additionalProperties === 'object'
          ? tsType(node.additionalProperties)
          : 'unknown';
      return `Readonly<Record<string, ${value}>>`;
    }
    const required = new Set(node.required ?? []);
    const fields = Object.entries(properties).map(
      ([name, value]) =>
        `readonly ${JSON.stringify(name)}${required.has(name) ? '' : '?'}: ${tsType(value)};`,
    );
    return `{ ${fields.join(' ')} }`;
  }
  return 'unknown';
}

function pythonType(node) {
  if (node.$ref !== undefined) return refName(node.$ref);
  if (node.const !== undefined) return `Literal[${pythonLiteral(node.const)}]`;
  if (node.enum !== undefined) return `Literal[${node.enum.map(pythonLiteral).join(', ')}]`;
  if (node.oneOf !== undefined) return node.oneOf.map(pythonType).join(' | ');
  if (Array.isArray(node.type))
    return node.type.map((type) => pythonType({ ...node, type })).join(' | ');
  if (node.type === 'string') return 'str';
  if (node.type === 'number') return 'float';
  if (node.type === 'integer') return 'int';
  if (node.type === 'boolean') return 'bool';
  if (node.type === 'null') return 'None';
  if (node.type === 'array') return `list[${pythonType(node.items ?? {})}]`;
  if (node.type === 'object') {
    const value =
      typeof node.additionalProperties === 'object' ? pythonType(node.additionalProperties) : 'Any';
    return `dict[str, ${value}]`;
  }
  return 'Any';
}

function pythonLiteral(value) {
  if (value === true) return 'True';
  if (value === false) return 'False';
  if (value === null) return 'None';
  return JSON.stringify(value);
}

function tsDefinition(name, definition) {
  if (definition.type !== 'object' || Object.keys(definition.properties ?? {}).length === 0) {
    return `export type ${name} = ${tsType(definition)};`;
  }
  const required = new Set(definition.required ?? []);
  const fields = Object.entries(definition.properties).map(
    ([propertyName, property]) =>
      `  readonly ${propertyName}${required.has(propertyName) ? '' : '?'}: ${tsType(property)};`,
  );
  return `export interface ${name} {\n${fields.join('\n')}\n}`;
}

function pythonDefinition(name, definition) {
  if (definition.type !== 'object' || Object.keys(definition.properties ?? {}).length === 0) {
    return `${name}: TypeAlias = ${pythonType(definition)}`;
  }
  const required = new Set(definition.required ?? []);
  const fields = Object.entries(definition.properties).map(([propertyName, property]) => {
    const type = pythonType(property);
    return required.has(propertyName)
      ? `    ${propertyName}: ${type}`
      : `    ${propertyName}: ${type} | None = None`;
  });
  return `class ${name}(BaseModel):\n    model_config = ConfigDict(extra="forbid", frozen=True)\n\n${fields.join('\n')}`;
}

const entries = Object.entries(definitions);
const tsSource = `${[
  '/**',
  ' * GENERATED from schemas/research-kernel.v1.schema.json.',
  ' * Run pnpm --filter @repo/research-kernel generate; do not edit by hand.',
  ' */',
  '',
  ...entries.flatMap(([name, definition]) => [tsDefinition(name, definition), '']),
  'export interface ResearchContractMap {',
  ...entries.map(([name]) => `  readonly ${name}: ${name};`),
  '}',
  '',
  'export type ResearchContractName = keyof ResearchContractMap;',
  '',
].join('\n')}\n`;
const tsOutput = await format(tsSource, {
  parser: 'typescript',
  printWidth: 100,
  singleQuote: true,
  trailingComma: 'all',
});

const modelNames = entries
  .filter(
    ([, definition]) =>
      definition.type === 'object' && Object.keys(definition.properties ?? {}).length > 0,
  )
  .map(([name]) => name);
const hasTypeAliases = entries.some(
  ([, definition]) =>
    definition.type !== 'object' || Object.keys(definition.properties ?? {}).length === 0,
);
const pythonOutput = `${[
  '"""Generated from the canonical research-kernel JSON Schema. Do not edit."""',
  '',
  'from __future__ import annotations',
  '',
  `from typing import Any, Literal${hasTypeAliases ? ', TypeAlias' : ''}`,
  '',
  'from pydantic import BaseModel, ConfigDict',
  '',
  ...entries.flatMap(([name, definition]) => [pythonDefinition(name, definition), '']),
  ...modelNames.map((name) => `${name}.model_rebuild()`),
  '',
  `CONTRACT_MODEL_NAMES = (${modelNames.map((name) => JSON.stringify(name)).join(', ')},)`,
  '',
].join('\n')}\n`;

async function emit(path, content) {
  if (checkOnly) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) throw new Error(`generated contract is stale: ${path}`);
    return;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, 'utf8');
}

await emit(tsPath, tsOutput);
await emit(pythonPath, pythonOutput);

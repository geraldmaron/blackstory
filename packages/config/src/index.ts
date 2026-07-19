/**
 * Shared environment validation and package identity helpers for the monorepo.
 */
import { z } from 'zod';

export {
  PRODUCT_NAME,
  PACKAGE_SCOPE,
  DESIGN_TOKEN_PREFIX,
  APP_ENV_PREFIX,
  GCP_PROJECT_ID_PROD,
  BRAND_ASSETS,
  brandLockup,
  brandSymbol,
  brandOpenGraph,
} from './identity.js';
export type { BrandTheme } from './identity.js';

export const packageNameSchema = z
  .string()
  .regex(/^@repo\/[a-z0-9-]+$/, 'Expected @repo/<name> package id');

export const nodeEnvSchema = z.enum(['development', 'test', 'staging', 'production']);
export const logLevelSchema = z.enum(['debug', 'info', 'warn', 'error']);

export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export function parseNodeEnv(value: string | undefined): NodeEnv {
  return nodeEnvSchema.parse(value ?? 'development');
}

export const runtimeEnvironmentSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  LOG_LEVEL: logLevelSchema.default('info'),
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export function parseRuntimeEnvironment(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): RuntimeEnvironment {
  return runtimeEnvironmentSchema.parse(environment);
}

export * from './surfaces.js';
export * from './sibling-origins.js';
export * from './shell-nav.js';
export * from './kill-switches.js';

// Node-only surfaces — import via package subpaths, never the main barrel
// (client components that import @repo/config would otherwise pull node:* into webpack):
//   @repo/config/scheduled-jobs
//   @repo/config/launch-gate

/**
 * Placeholder loader until apps import generated Admin SDKs from ./generated/*.
 * Compile/generate: `pnpm db:sql-connect:compile` (writes Admin Node SDK under generated/).
 */
export const SQL_CONNECT_SDK_STATUS = {
  generated: true,
  reason:
    'Admin Node SDKs are produced by firebase dataconnect:compile into packages/data-access/generated/*',
  generateCommand:
    'firebase dataconnect:sdk:generate -c infra/database/sql-connect/firebase.json -P black-book-efaaf',
  compileCommand: 'firebase dataconnect:compile -c infra/database/sql-connect/firebase.json',
  cloudLinked: false,
} as const;

export type GeneratedAdminSdkModule = {
  readonly connectorConfig: unknown;
};

export function loadGeneratedAdminSdk(connectorId: string): never {
  throw new Error(
    `Import generated Admin SDK from @blap/data-access/generated/${connectorId} (or relative generated path). Requested connector=${connectorId}. Cloud link: ${SQL_CONNECT_SDK_STATUS.cloudLinked}. Compile: ${SQL_CONNECT_SDK_STATUS.compileCommand}`,
  );
}

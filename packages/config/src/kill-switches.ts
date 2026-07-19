/**
 * Typed runtime kill switches and fail-safe evaluation helpers.
 * Switches are independently addressable; an engaged switch denies only its workload,
 * while static mode preserves immutable public-corpus reads and queue pause retains tasks.
 */

export const KILL_SWITCH_POLICY_VERSION = '1.0.0' as const;

export const CORE_KILL_SWITCH_IDS = [
  'corrections-submissions',
  'search',
  'geocoding',
  'nearby-location',
  'research-campaigns',
  'llm-calls',
  'file-uploads',
  'publication',
  'administrative-exports',
  'public-static-mode',
  'queue-processing',
] as const;

export type CoreKillSwitchId = (typeof CORE_KILL_SWITCH_IDS)[number];
export type SourceAdapterKillSwitchId = `source-adapter-${string}`;
export type KillSwitchId = CoreKillSwitchId | SourceAdapterKillSwitchId;

export type WorkloadClass = 'public-serving' | 'essential' | 'volume-sensitive' | 'optional';
export type MissingFlagBehavior = 'allow' | 'deny';

export interface KillSwitchDefinition {
  readonly id: CoreKillSwitchId;
  readonly workloadClass: WorkloadClass;
  readonly missingFlagBehavior: MissingFlagBehavior;
  readonly description: string;
}

export interface KillSwitchState {
  readonly id: KillSwitchId;
  /** True means the switch is engaged and the workload is stopped. */
  readonly enabled: boolean;
  readonly reason?: string;
  readonly updatedAt?: string;
  readonly updatedBy?: string;
}

export type KillSwitchSnapshot = Readonly<Record<string, KillSwitchState | undefined>>;

export interface KillSwitchAllowed {
  readonly allowed: true;
  readonly switchId: KillSwitchId;
  readonly policyVersion: typeof KILL_SWITCH_POLICY_VERSION;
  readonly source: 'runtime-flag' | 'safe-default';
}

export interface KillSwitchDenied {
  readonly allowed: false;
  readonly switchId: KillSwitchId;
  readonly policyVersion: typeof KILL_SWITCH_POLICY_VERSION;
  readonly source: 'runtime-flag' | 'safe-default' | 'static-mode';
  readonly reason: 'switch-engaged' | 'missing-optional-flag' | 'static-read-only';
  readonly failClosed: true;
}

export type KillSwitchDecision = KillSwitchAllowed | KillSwitchDenied;

export const KILL_SWITCH_DEFINITIONS: Readonly<Record<CoreKillSwitchId, KillSwitchDefinition>> = {
  'corrections-submissions': {
    id: 'corrections-submissions',
    workloadClass: 'volume-sensitive',
    missingFlagBehavior: 'allow',
    description: 'Stops new correction and submission intake.',
  },
  search: {
    id: 'search',
    workloadClass: 'volume-sensitive',
    missingFlagBehavior: 'allow',
    description: 'Stops dynamic search while immutable entity snapshots remain available.',
  },
  geocoding: {
    id: 'geocoding',
    workloadClass: 'optional',
    missingFlagBehavior: 'deny',
    description: 'Stops external and background geocoding calls.',
  },
  'nearby-location': {
    id: 'nearby-location',
    workloadClass: 'optional',
    missingFlagBehavior: 'deny',
    description: 'Stops nearby-location lookup and expansion.',
  },
  'research-campaigns': {
    id: 'research-campaigns',
    workloadClass: 'optional',
    missingFlagBehavior: 'deny',
    description: 'Stops scheduling and dispatch of research campaigns.',
  },
  'llm-calls': {
    id: 'llm-calls',
    workloadClass: 'optional',
    missingFlagBehavior: 'deny',
    description: 'Stops every model invocation.',
  },
  'file-uploads': {
    id: 'file-uploads',
    workloadClass: 'optional',
    missingFlagBehavior: 'deny',
    description: 'Stops issuance and acceptance of new file uploads.',
  },
  publication: {
    id: 'publication',
    workloadClass: 'essential',
    missingFlagBehavior: 'deny',
    description: 'Stops projection generation, release activation, and release promotion.',
  },
  'administrative-exports': {
    id: 'administrative-exports',
    workloadClass: 'optional',
    missingFlagBehavior: 'deny',
    description: 'Stops creation and download of administrative exports.',
  },
  'public-static-mode': {
    id: 'public-static-mode',
    workloadClass: 'public-serving',
    missingFlagBehavior: 'allow',
    description: 'Forces read-only serving from immutable public release snapshots.',
  },
  'queue-processing': {
    id: 'queue-processing',
    workloadClass: 'essential',
    missingFlagBehavior: 'allow',
    description: 'Pauses queue dispatch without deleting or purging queued tasks.',
  },
};

const STATIC_MODE_DENIED_SWITCHES = new Set<KillSwitchId>([
  'corrections-submissions',
  'search',
  'geocoding',
  'nearby-location',
  'research-campaigns',
  'llm-calls',
  'file-uploads',
  'publication',
  'administrative-exports',
]);

function isCoreKillSwitchId(id: KillSwitchId): id is CoreKillSwitchId {
  return (CORE_KILL_SWITCH_IDS as readonly string[]).includes(id);
}

function isSourceAdapterKillSwitchId(id: KillSwitchId): id is SourceAdapterKillSwitchId {
  return id.startsWith('source-adapter-');
}

function definitionFor(id: KillSwitchId): Pick<KillSwitchDefinition, 'missingFlagBehavior'> {
  if (isCoreKillSwitchId(id)) {
    return KILL_SWITCH_DEFINITIONS[id];
  }
  return { missingFlagBehavior: 'deny' };
}

function allowed(switchId: KillSwitchId, source: KillSwitchAllowed['source']): KillSwitchAllowed {
  return {
    allowed: true,
    switchId,
    policyVersion: KILL_SWITCH_POLICY_VERSION,
    source,
  };
}

function denied(
  switchId: KillSwitchId,
  source: KillSwitchDenied['source'],
  reason: KillSwitchDenied['reason'],
): KillSwitchDenied {
  return {
    allowed: false,
    switchId,
    policyVersion: KILL_SWITCH_POLICY_VERSION,
    source,
    reason,
    failClosed: true,
  };
}

/** Creates the stable Firestore/Remote Config key for an individual source adapter. */
export function sourceAdapterKillSwitchId(adapterId: string): SourceAdapterKillSwitchId {
  const normalized = adapterId.trim();
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(normalized)) {
    throw new Error('adapterId must be a safe non-empty identifier');
  }
  return `source-adapter-${normalized}`;
}

/**
 * Evaluates one switch independently.
 * Missing optional/adapter/publication flags fail closed; missing serving flags do not
 * take the immutable public corpus offline.
 */
export function evaluateKillSwitch(
  switchId: KillSwitchId,
  snapshot: KillSwitchSnapshot,
): KillSwitchDecision {
  if (
    switchId !== 'public-static-mode' &&
    snapshot['public-static-mode']?.enabled === true &&
    (STATIC_MODE_DENIED_SWITCHES.has(switchId) || isSourceAdapterKillSwitchId(switchId))
  ) {
    return denied(switchId, 'static-mode', 'static-read-only');
  }

  const state = snapshot[switchId];
  if (state !== undefined) {
    if (state.id !== switchId || state.enabled) {
      return denied(switchId, 'runtime-flag', 'switch-engaged');
    }
    return allowed(switchId, 'runtime-flag');
  }

  if (definitionFor(switchId).missingFlagBehavior === 'deny') {
    return denied(switchId, 'safe-default', 'missing-optional-flag');
  }
  return allowed(switchId, 'safe-default');
}

export interface PublicRuntimeMode {
  readonly mode: 'dynamic' | 'static-read-only';
  readonly readOnly: boolean;
  readonly publicCorpusAvailable: true;
  readonly releaseSource: 'active-release-pointer' | 'immutable-release-snapshot';
}

/** Resolves public serving mode without ever implicitly disabling the immutable corpus. */
export function evaluatePublicRuntimeMode(snapshot: KillSwitchSnapshot): PublicRuntimeMode {
  if (snapshot['public-static-mode']?.enabled === true) {
    return {
      mode: 'static-read-only',
      readOnly: true,
      publicCorpusAvailable: true,
      releaseSource: 'immutable-release-snapshot',
    };
  }
  return {
    mode: 'dynamic',
    readOnly: false,
    publicCorpusAvailable: true,
    releaseSource: 'active-release-pointer',
  };
}

export interface QueueProcessingMode {
  readonly paused: boolean;
  readonly acceptNewTasks: boolean;
  readonly retainQueuedTasks: true;
}

/** Cloud Tasks pause semantics: preserve tasks and optionally continue enqueueing them. */
export function evaluateQueueProcessingMode(snapshot: KillSwitchSnapshot): QueueProcessingMode {
  const paused = snapshot['queue-processing']?.enabled === true;
  return {
    paused,
    acceptNewTasks: true,
    retainQueuedTasks: true,
  };
}

/** Returns switch ids in the required containment order: optional/volume before serving. */
export function containmentOrder(adapterIds: readonly string[] = []): readonly KillSwitchId[] {
  return [
    'research-campaigns',
    'llm-calls',
    'geocoding',
    'nearby-location',
    'file-uploads',
    'administrative-exports',
    ...adapterIds.map(sourceAdapterKillSwitchId),
    'corrections-submissions',
    'search',
    'queue-processing',
    'publication',
    'public-static-mode',
  ];
}

/**
 * Rolling-window circuit breaker for Firebase App Check verifier failures.
 *
 * Distinguishes a sustained verifier/provider outage (many throws in a short window)
 * from isolated bad tokens or missing headers. Per-request guard decisions stay
 * `invalid_token`; this module emits the systemic `AppCheckAvailability` signal only.
 */
import type { AppCheckAvailability } from '@repo/security';

export type AppCheckCircuitBreakerState = 'closed' | 'open' | 'half_open';

/** Documented defaults — tuned for Cloud Run instance-local detection without live network. */
export const DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG = {
  /** Verifier throws within `windowMs` required to open (a lone bad token stays below this). */
  failureThreshold: 5,
  /** Rolling window for failure timestamps. */
  windowMs: 60_000,
  /** Cool-down before half-open probe after opening. */
  recoveryTimeoutMs: 30_000,
  /** Consecutive verifier successes in half-open required to close. */
  halfOpenSuccessThreshold: 2,
} as const;

export type AppCheckCircuitBreakerConfig = {
  readonly failureThreshold?: number;
  readonly windowMs?: number;
  readonly recoveryTimeoutMs?: number;
  readonly halfOpenSuccessThreshold?: number;
};

export type AppCheckCircuitBreakerSnapshot = {
  readonly state: AppCheckCircuitBreakerState;
  readonly failureTimestampsMs: readonly number[];
  readonly openedAtMs?: number;
  readonly halfOpenSuccesses: number;
};

export type AppCheckCircuitBreakerTelemetryEvent = {
  readonly event: 'app_check_circuit_breaker';
  readonly transition: 'opened' | 'half_open' | 'closed';
  readonly state: AppCheckCircuitBreakerState;
  readonly failureCount: number;
};

export type AppCheckCircuitBreakerTelemetry = {
  record(event: AppCheckCircuitBreakerTelemetryEvent): void;
};

export type AppCheckCircuitBreaker = {
  recordVerifierFailure(nowMs?: number): void;
  recordVerifierSuccess(nowMs?: number): void;
  getAvailability(nowMs?: number): AppCheckAvailability;
  snapshot(): AppCheckCircuitBreakerSnapshot;
};

type ResolvedConfig = {
  readonly failureThreshold: number;
  readonly windowMs: number;
  readonly recoveryTimeoutMs: number;
  readonly halfOpenSuccessThreshold: number;
};

function resolveConfig(config: AppCheckCircuitBreakerConfig = {}): ResolvedConfig {
  return {
    failureThreshold: config.failureThreshold ?? DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.failureThreshold,
    windowMs: config.windowMs ?? DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.windowMs,
    recoveryTimeoutMs:
      config.recoveryTimeoutMs ?? DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.recoveryTimeoutMs,
    halfOpenSuccessThreshold:
      config.halfOpenSuccessThreshold ??
      DEFAULT_APP_CHECK_CIRCUIT_BREAKER_CONFIG.halfOpenSuccessThreshold,
  };
}

function pruneFailures(
  failureTimestampsMs: readonly number[],
  windowMs: number,
  nowMs: number,
): number[] {
  const cutoff = nowMs - windowMs;
  return failureTimestampsMs.filter((timestamp) => timestamp >= cutoff);
}

function failuresInWindow(
  failureTimestampsMs: readonly number[],
  windowMs: number,
  nowMs: number,
): number {
  return pruneFailures(failureTimestampsMs, windowMs, nowMs).length;
}

function emitTransition(
  telemetry: AppCheckCircuitBreakerTelemetry | undefined,
  transition: AppCheckCircuitBreakerTelemetryEvent['transition'],
  snapshot: AppCheckCircuitBreakerSnapshot,
  config: ResolvedConfig,
  nowMs: number,
): void {
  telemetry?.record({
    event: 'app_check_circuit_breaker',
    transition,
    state: snapshot.state,
    failureCount: failuresInWindow(snapshot.failureTimestampsMs, config.windowMs, nowMs),
  });
}

/** Advances time-based transitions (open → half-open) without recording a verification attempt. */
export function advanceAppCheckCircuitBreaker(
  snapshot: AppCheckCircuitBreakerSnapshot,
  config: AppCheckCircuitBreakerConfig,
  nowMs: number,
): AppCheckCircuitBreakerSnapshot {
  const resolved = resolveConfig(config);
  if (snapshot.state !== 'open' || snapshot.openedAtMs === undefined) {
    return snapshot;
  }
  if (nowMs - snapshot.openedAtMs < resolved.recoveryTimeoutMs) {
    return snapshot;
  }
  return {
    state: 'half_open',
    failureTimestampsMs: [],
    halfOpenSuccesses: 0,
  };
}

export function recordAppCheckVerifierFailure(
  snapshot: AppCheckCircuitBreakerSnapshot,
  config: AppCheckCircuitBreakerConfig,
  nowMs: number,
): AppCheckCircuitBreakerSnapshot {
  const resolved = resolveConfig(config);
  const advanced = advanceAppCheckCircuitBreaker(snapshot, config, nowMs);

  if (advanced.state === 'half_open') {
    return {
      state: 'open',
      failureTimestampsMs: [...advanced.failureTimestampsMs, nowMs],
      openedAtMs: nowMs,
      halfOpenSuccesses: 0,
    };
  }

  if (advanced.state === 'open') {
    return {
      ...advanced,
      failureTimestampsMs: [...advanced.failureTimestampsMs, nowMs],
    };
  }

  const failureTimestampsMs = [...pruneFailures(advanced.failureTimestampsMs, resolved.windowMs, nowMs), nowMs];
  if (failureTimestampsMs.length >= resolved.failureThreshold) {
    return {
      state: 'open',
      failureTimestampsMs,
      openedAtMs: nowMs,
      halfOpenSuccesses: 0,
    };
  }

  return {
    ...advanced,
    failureTimestampsMs,
  };
}

export function recordAppCheckVerifierSuccess(
  snapshot: AppCheckCircuitBreakerSnapshot,
  config: AppCheckCircuitBreakerConfig,
  nowMs: number,
): AppCheckCircuitBreakerSnapshot {
  const resolved = resolveConfig(config);
  const advanced = advanceAppCheckCircuitBreaker(snapshot, config, nowMs);

  if (advanced.state === 'half_open') {
    const halfOpenSuccesses = advanced.halfOpenSuccesses + 1;
    if (halfOpenSuccesses >= resolved.halfOpenSuccessThreshold) {
      return {
        state: 'closed',
        failureTimestampsMs: [],
        halfOpenSuccesses: 0,
      };
    }
    return {
      ...advanced,
      halfOpenSuccesses,
    };
  }

  if (advanced.state === 'open') {
    return advanced;
  }

  return {
    state: 'closed',
    failureTimestampsMs: pruneFailures(advanced.failureTimestampsMs, resolved.windowMs, nowMs),
    halfOpenSuccesses: 0,
  };
}

export function appCheckCircuitBreakerAvailability(
  snapshot: AppCheckCircuitBreakerSnapshot,
  config: AppCheckCircuitBreakerConfig,
  nowMs: number,
): AppCheckAvailability {
  const advanced = advanceAppCheckCircuitBreaker(snapshot, config, nowMs);
  return advanced.state === 'closed' ? 'available' : 'outage';
}

export type CreateAppCheckCircuitBreakerOptions = {
  readonly config?: AppCheckCircuitBreakerConfig;
  readonly telemetry?: AppCheckCircuitBreakerTelemetry;
  readonly now?: () => number;
};

export function createAppCheckCircuitBreaker(
  options: CreateAppCheckCircuitBreakerOptions = {},
): AppCheckCircuitBreaker {
  const resolved = resolveConfig(options.config);
  const nowFn = options.now ?? (() => Date.now());
  let snapshot: AppCheckCircuitBreakerSnapshot = {
    state: 'closed',
    failureTimestampsMs: [],
    halfOpenSuccesses: 0,
  };

  const maybeEmit = (
    previous: AppCheckCircuitBreakerSnapshot,
    next: AppCheckCircuitBreakerSnapshot,
    nowMs: number,
  ): void => {
    if (previous.state === next.state) {
      return;
    }
    if (next.state === 'open' && previous.state !== 'open') {
      emitTransition(options.telemetry, 'opened', next, resolved, nowMs);
      return;
    }
    if (next.state === 'half_open' && previous.state === 'open') {
      emitTransition(options.telemetry, 'half_open', next, resolved, nowMs);
      return;
    }
    if (next.state === 'closed' && previous.state !== 'closed') {
      emitTransition(options.telemetry, 'closed', next, resolved, nowMs);
    }
  };

  return {
    recordVerifierFailure(nowMs = nowFn()) {
      const previous = snapshot;
      snapshot = recordAppCheckVerifierFailure(snapshot, resolved, nowMs);
      maybeEmit(previous, snapshot, nowMs);
    },
    recordVerifierSuccess(nowMs = nowFn()) {
      const previous = snapshot;
      snapshot = recordAppCheckVerifierSuccess(snapshot, resolved, nowMs);
      maybeEmit(previous, snapshot, nowMs);
    },
    getAvailability(nowMs = nowFn()) {
      const previous = snapshot;
      const advanced = advanceAppCheckCircuitBreaker(snapshot, resolved, nowMs);
      if (advanced.state === 'half_open' && previous.state === 'open') {
        snapshot = advanced;
        emitTransition(options.telemetry, 'half_open', advanced, resolved, nowMs);
      }
      return appCheckCircuitBreakerAvailability(snapshot, resolved, nowMs);
    },
    snapshot() {
      return snapshot;
    },
  };
}

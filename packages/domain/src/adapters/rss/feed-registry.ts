/**
 * Versioned curated feed registry with add/remove audit.
 *
 * Reuses the append-only audit contract (`../../audit/index.ts`) rather than inventing a
 * parallel audit shape: every mutation returns a `DomainAuditEvent` using the existing
 * `administrative.configuration_changed` action (the closest fit in `AUDIT_EVENT_ACTIONS`;
 * this module composes with that closed union instead of adding a bespoke `feed.added`
 * action). Callers persist the returned event through whatever audit sink wires in
 * production; the in-memory log here exists for tests.
 */
import type { AuditActor, DomainAuditEvent } from '../../audit/index.js';
import type { RssFeedClassification, RssFeedInstitutionType } from './types.js';

export const FEED_REGISTRY_SCHEMA_VERSION = 'rss-feed-registry.v1' as const;

export type FeedRegistryEntryStatus = 'active' | 'removed';

export type FeedRegistryEntry = {
  readonly id: string;
  readonly feedUrl: string;
  readonly displayName: string;
  readonly classification: RssFeedClassification;
  readonly institutionType: RssFeedInstitutionType;
  readonly status: FeedRegistryEntryStatus;
  /** Monotonic per-store revision this entry was last written at (versioning). */
  readonly revision: number;
  readonly addedAt: string;
  readonly addedBy: string;
  readonly removedAt?: string;
  readonly removedBy?: string;
  readonly notes?: string;
};

export type FeedRegistryStore = {
  get(id: string): FeedRegistryEntry | undefined;
  list(): readonly FeedRegistryEntry[];
  save(entry: FeedRegistryEntry): void;
  /** Returns the next monotonic revision number for a mutation (starts at 1). */
  nextRevision(): number;
};

export function createInMemoryFeedRegistry(
  seed: readonly FeedRegistryEntry[] = [],
): FeedRegistryStore {
  const entries = new Map<string, FeedRegistryEntry>(seed.map((entry) => [entry.id, entry]));
  let revision = seed.reduce((max, entry) => Math.max(max, entry.revision), 0);
  return {
    get(id) {
      return entries.get(id);
    },
    list() {
      return [...entries.values()];
    },
    save(entry) {
      entries.set(entry.id, entry);
    },
    nextRevision() {
      revision += 1;
      return revision;
    },
  };
}

function assertHttpsFeedUrl(feedUrl: string): void {
  let url: URL;
  try {
    url = new URL(feedUrl);
  } catch {
    throw new Error(`Feed URL is not a valid URL: ${feedUrl}`);
  }
  if (url.protocol !== 'https:') {
    throw new Error(`Feed URL must use https: ${feedUrl}`);
  }
}

export type AddFeedInput = {
  readonly id: string;
  readonly feedUrl: string;
  readonly displayName: string;
  readonly classification: RssFeedClassification;
  readonly institutionType: RssFeedInstitutionType;
  readonly notes?: string;
};

export type FeedRegistryMutationResult = {
  readonly entry: FeedRegistryEntry;
  readonly auditEvent: DomainAuditEvent;
};

function buildAuditEvent(input: {
  readonly action: DomainAuditEvent['action'];
  readonly actor: AuditActor;
  readonly reason: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly feedId: string;
  readonly data: Readonly<Record<string, unknown>>;
}): DomainAuditEvent {
  return {
    id: `audit_feed_${input.feedId}_${input.occurredAt}`,
    action: input.action,
    category: 'administrative',
    actor: input.actor,
    subject: {
      type: 'rss_feed_registry_entry',
      id: input.feedId,
      path: `rssFeedRegistry/${input.feedId}`,
    },
    reason: input.reason,
    requestId: input.requestId,
    correlationId: input.correlationId,
    idempotencyKey: `feed-registry:${input.feedId}:${input.occurredAt}`,
    occurredAt: input.occurredAt,
    data: input.data,
  };
}

/** Adds a curated feed to the registry. Throws if the id already exists or the URL is unsafe-shaped. */
export function addFeedToRegistry(
  store: FeedRegistryStore,
  input: AddFeedInput,
  context: {
    readonly actor: AuditActor;
    readonly reason: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly now: string;
  },
): FeedRegistryMutationResult {
  if (store.get(input.id)) {
    throw new Error(`Feed registry entry already exists: ${input.id}`);
  }
  assertHttpsFeedUrl(input.feedUrl);
  if (!input.displayName.trim()) {
    throw new Error('Feed displayName is required');
  }

  const entry: FeedRegistryEntry = {
    id: input.id,
    feedUrl: input.feedUrl,
    displayName: input.displayName,
    classification: input.classification,
    institutionType: input.institutionType,
    status: 'active',
    revision: store.nextRevision(),
    addedAt: context.now,
    addedBy: context.actor.id,
    ...(input.notes !== undefined ? { notes: input.notes } : {}),
  };
  store.save(entry);

  const auditEvent = buildAuditEvent({
    action: 'administrative.configuration_changed',
    actor: context.actor,
    reason: context.reason,
    requestId: context.requestId,
    correlationId: context.correlationId,
    occurredAt: context.now,
    feedId: entry.id,
    data: {
      mutation: 'feed_added',
      feedUrl: entry.feedUrl,
      classification: entry.classification,
      revision: entry.revision,
    },
  });

  return { entry, auditEvent };
}

/** Removes (soft-deletes) a curated feed. Throws if the id is missing or already removed. */
export function removeFeedFromRegistry(
  store: FeedRegistryStore,
  id: string,
  context: {
    readonly actor: AuditActor;
    readonly reason: string;
    readonly requestId: string;
    readonly correlationId: string;
    readonly now: string;
  },
): FeedRegistryMutationResult {
  const existing = store.get(id);
  if (!existing) {
    throw new Error(`Feed registry entry not found: ${id}`);
  }
  if (existing.status === 'removed') {
    throw new Error(`Feed registry entry already removed: ${id}`);
  }
  if (!context.reason.trim()) {
    throw new Error('A reason is required to remove a feed from the registry');
  }

  const entry: FeedRegistryEntry = {
    ...existing,
    status: 'removed',
    revision: store.nextRevision(),
    removedAt: context.now,
    removedBy: context.actor.id,
  };
  store.save(entry);

  const auditEvent = buildAuditEvent({
    action: 'administrative.configuration_changed',
    actor: context.actor,
    reason: context.reason,
    requestId: context.requestId,
    correlationId: context.correlationId,
    occurredAt: context.now,
    feedId: entry.id,
    data: { mutation: 'feed_removed', feedUrl: entry.feedUrl, revision: entry.revision },
  });

  return { entry, auditEvent };
}

export function listActiveFeeds(store: FeedRegistryStore): readonly FeedRegistryEntry[] {
  return store.list().filter((entry) => entry.status === 'active');
}

export type InMemoryAuditLog = {
  append(event: DomainAuditEvent): void;
  list(): readonly DomainAuditEvent[];
};

export function createInMemoryAuditLog(): InMemoryAuditLog {
  const events: DomainAuditEvent[] = [];
  return {
    append(event) {
      events.push(event);
    },
    list() {
      return events;
    },
  };
}

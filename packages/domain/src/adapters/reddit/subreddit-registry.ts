/**
 * Versioned curated subreddit registry with add/remove audit (BB-074, mirrors ../rss/
 * feed-registry.ts's BB-073 acceptance criterion 6 pattern exactly). Reuses the BB-018
 * append-only audit contract (../../audit/index.ts) rather than inventing a parallel shape:
 * every mutation returns a `DomainAuditEvent` using the existing
 * `administrative.configuration_changed` action.
 */
import type { AuditActor, DomainAuditEvent } from '../../audit/index.js';
import type { RedditSubredditCategory } from './types.js';
import { REDDIT_DEFAULT_CLASSIFICATION } from './types.js';

export const SUBREDDIT_REGISTRY_SCHEMA_VERSION = 'reddit-subreddit-registry.v1' as const;

export type SubredditRegistryEntryStatus = 'active' | 'removed';

export type SubredditRegistryEntry = {
  readonly id: string;
  /** Bare subreddit name, no `r/` prefix (e.g. "AskHistorians"). */
  readonly subredditName: string;
  readonly displayName: string;
  readonly classification: string;
  readonly category: RedditSubredditCategory;
  readonly status: SubredditRegistryEntryStatus;
  /** Monotonic per-store revision this entry was last written at (versioning). */
  readonly revision: number;
  readonly addedAt: string;
  readonly addedBy: string;
  readonly removedAt?: string;
  readonly removedBy?: string;
  readonly notes?: string;
};

export type SubredditRegistryStore = {
  get(id: string): SubredditRegistryEntry | undefined;
  list(): readonly SubredditRegistryEntry[];
  save(entry: SubredditRegistryEntry): void;
  nextRevision(): number;
};

export function createInMemorySubredditRegistry(
  seed: readonly SubredditRegistryEntry[] = [],
): SubredditRegistryStore {
  const entries = new Map<string, SubredditRegistryEntry>(seed.map((entry) => [entry.id, entry]));
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

const SUBREDDIT_NAME_PATTERN = /^[A-Za-z0-9_]{2,21}$/;

function assertValidSubredditName(name: string): void {
  if (!SUBREDDIT_NAME_PATTERN.test(name)) {
    throw new Error(`Subreddit name is not a valid Reddit community name (no "r/" prefix): ${name}`);
  }
}

export type AddSubredditInput = {
  readonly id: string;
  readonly subredditName: string;
  readonly displayName: string;
  readonly category: RedditSubredditCategory;
  readonly classification?: string;
  readonly notes?: string;
};

export type SubredditRegistryMutationResult = {
  readonly entry: SubredditRegistryEntry;
  readonly auditEvent: DomainAuditEvent;
};

function buildAuditEvent(input: {
  readonly action: DomainAuditEvent['action'];
  readonly actor: AuditActor;
  readonly reason: string;
  readonly requestId: string;
  readonly correlationId: string;
  readonly occurredAt: string;
  readonly subredditId: string;
  readonly data: Readonly<Record<string, unknown>>;
}): DomainAuditEvent {
  return {
    id: `audit_subreddit_${input.subredditId}_${input.occurredAt}`,
    action: input.action,
    category: 'administrative',
    actor: input.actor,
    subject: { type: 'reddit_subreddit_registry_entry', id: input.subredditId, path: `redditSubredditRegistry/${input.subredditId}` },
    reason: input.reason,
    requestId: input.requestId,
    correlationId: input.correlationId,
    idempotencyKey: `subreddit-registry:${input.subredditId}:${input.occurredAt}`,
    occurredAt: input.occurredAt,
    data: input.data,
  };
}

/** Adds a curated subreddit to the registry. Throws if the id already exists or the name is
 *  not a valid Reddit community name. */
export function addSubredditToRegistry(
  store: SubredditRegistryStore,
  input: AddSubredditInput,
  context: { readonly actor: AuditActor; readonly reason: string; readonly requestId: string; readonly correlationId: string; readonly now: string },
): SubredditRegistryMutationResult {
  if (store.get(input.id)) {
    throw new Error(`Subreddit registry entry already exists: ${input.id}`);
  }
  assertValidSubredditName(input.subredditName);
  if (!input.displayName.trim()) {
    throw new Error('Subreddit displayName is required');
  }

  const entry: SubredditRegistryEntry = {
    id: input.id,
    subredditName: input.subredditName,
    displayName: input.displayName,
    classification: input.classification ?? REDDIT_DEFAULT_CLASSIFICATION,
    category: input.category,
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
    subredditId: entry.id,
    data: { mutation: 'subreddit_added', subredditName: entry.subredditName, category: entry.category, revision: entry.revision },
  });

  return { entry, auditEvent };
}

/** Removes (soft-deletes) a curated subreddit. Throws if the id is missing, already removed, or
 *  no reason is supplied. */
export function removeSubredditFromRegistry(
  store: SubredditRegistryStore,
  id: string,
  context: { readonly actor: AuditActor; readonly reason: string; readonly requestId: string; readonly correlationId: string; readonly now: string },
): SubredditRegistryMutationResult {
  const existing = store.get(id);
  if (!existing) {
    throw new Error(`Subreddit registry entry not found: ${id}`);
  }
  if (existing.status === 'removed') {
    throw new Error(`Subreddit registry entry already removed: ${id}`);
  }
  if (!context.reason.trim()) {
    throw new Error('A reason is required to remove a subreddit from the registry');
  }

  const entry: SubredditRegistryEntry = {
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
    subredditId: entry.id,
    data: { mutation: 'subreddit_removed', subredditName: entry.subredditName, revision: entry.revision },
  });

  return { entry, auditEvent };
}

export function listActiveSubreddits(store: SubredditRegistryStore): readonly SubredditRegistryEntry[] {
  return store.list().filter((entry) => entry.status === 'active');
}

/**
 * Small, realistic seed list per the bead's own text: r/AskHistorians, r/BlackHistory, and a
 * handful of city/state subs where family-history and neighborhood-memory leads plausibly
 * surface. Deliberately short — adding more is a one-line `addSubredditToRegistry` call, not a
 * code change (BB-074 acceptance criterion 2's "versioned config with add/remove capability").
 */
export function defaultSubredditRegistrySeed(seedAt: string, addedBy = 'system:bb074-seed'): readonly SubredditRegistryEntry[] {
  const entries: Array<Omit<SubredditRegistryEntry, 'revision'>> = [
    {
      id: 'sub_askhistorians',
      subredditName: 'AskHistorians',
      displayName: 'r/AskHistorians',
      classification: REDDIT_DEFAULT_CLASSIFICATION,
      category: 'topical',
      status: 'active',
      addedAt: seedAt,
      addedBy,
      notes: 'Moderated Q&A with sourced answers; frequent Black-history threads with citations.',
    },
    {
      id: 'sub_blackhistory',
      subredditName: 'BlackHistory',
      displayName: 'r/BlackHistory',
      classification: REDDIT_DEFAULT_CLASSIFICATION,
      category: 'topical',
      status: 'active',
      addedAt: seedAt,
      addedBy,
      notes: 'Topical community; family-history and photo-identification leads.',
    },
    {
      id: 'sub_atlanta',
      subredditName: 'Atlanta',
      displayName: 'r/Atlanta',
      classification: REDDIT_DEFAULT_CLASSIFICATION,
      category: 'city',
      status: 'active',
      addedAt: seedAt,
      addedBy,
      notes: 'City sub; neighborhood-memory leads (e.g. Sweet Auburn, Auburn Avenue history).',
    },
    {
      id: 'sub_neworleans',
      subredditName: 'NewOrleans',
      displayName: 'r/NewOrleans',
      classification: REDDIT_DEFAULT_CLASSIFICATION,
      category: 'city',
      status: 'active',
      addedAt: seedAt,
      addedBy,
      notes: 'City sub; Treme/neighborhood-history leads.',
    },
    {
      id: 'sub_mississippi',
      subredditName: 'Mississippi',
      displayName: 'r/Mississippi',
      classification: REDDIT_DEFAULT_CLASSIFICATION,
      category: 'state',
      status: 'active',
      addedAt: seedAt,
      addedBy,
      notes: 'State sub; rural county family-history leads.',
    },
  ];
  return entries.map((entry, index) => ({ ...entry, revision: index + 1 }));
}


/**
 * Defines the dependency-injected safe-fetch state machine used only by the
 * asynchronous URL worker. Each redirect is reparsed and re-resolved, the
 * transport receives a pinned IP, and bounded content stays quarantined.
 */
import { createHash } from 'node:crypto';
import {
  evaluateExternalUrl,
  resolveAndPinDestination,
  type ResolveHost,
  type SourceDomainPolicy,
  type UrlDenialReason,
} from './policy.js';

export type SafeFetchLimits = {
  readonly maxRedirects: number;
  readonly maxResponseBytes: number;
  readonly maxDurationMs: number;
  readonly allowedContentTypes: readonly string[];
};

export const DEFAULT_SAFE_FETCH_LIMITS: SafeFetchLimits = {
  maxRedirects: 4,
  maxResponseBytes: 2 * 1024 * 1024,
  maxDurationMs: 10_000,
  allowedContentTypes: ['text/html', 'text/plain', 'application/xhtml+xml'],
};

export type PinnedTransportRequest = {
  readonly url: string;
  readonly hostname: string;
  readonly port: number;
  readonly pinnedAddress: string;
  readonly headers: Readonly<Record<string, string>>;
  readonly signal: AbortSignal;
};

export type PinnedTransportResponse = {
  readonly status: number;
  readonly headers: Readonly<Record<string, string | undefined>>;
  readonly remoteAddress: string;
  readonly body: AsyncIterable<Uint8Array>;
};

export type PinnedTransport = (
  request: PinnedTransportRequest,
) => Promise<PinnedTransportResponse>;

export type SafeFetchFailureReason =
  | UrlDenialReason
  | 'redirect_missing_location'
  | 'redirect_limit_exceeded'
  | 'response_too_large'
  | 'content_type_not_allowed'
  | 'duration_exceeded'
  | 'transport_failed'
  | 'malware_indicator';

export type MalwareIndicator =
  | 'eicar_test_signature'
  | 'executable_magic'
  | 'active_content';

export type SafeParserResult = {
  readonly safe: boolean;
  readonly indicators: readonly MalwareIndicator[];
  readonly extractedText: string;
};

export type SafeParser = (
  content: Uint8Array,
  contentType: string,
) => Promise<SafeParserResult>;

export type SafeFetchResult =
  | {
      readonly ok: true;
      readonly finalUrl: string;
      readonly redirectCount: number;
      readonly contentType: string;
      readonly byteLength: number;
      readonly contentHash: string;
      readonly parser: SafeParserResult;
      readonly quarantineState: 'validated';
      readonly publicationAllowed: false;
    }
  | {
      readonly ok: false;
      readonly reason: SafeFetchFailureReason;
      readonly quarantineState: 'rejected';
      readonly publicationAllowed: false;
    };

export type SafeFetchDependencies = {
  readonly resolveHost: ResolveHost;
  readonly transport: PinnedTransport;
  readonly parser?: SafeParser;
  readonly now?: () => number;
};

export type SafeFetchOptions = {
  readonly limits?: Partial<SafeFetchLimits>;
  readonly domainPolicy?: SourceDomainPolicy;
};

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

function fail(reason: SafeFetchFailureReason): SafeFetchResult {
  return {
    ok: false,
    reason,
    quarantineState: 'rejected',
    publicationAllowed: false,
  };
}

function contentTypeBase(value: string | undefined): string {
  return (value ?? '').split(';', 1)[0]!.trim().toLowerCase();
}

function equalAddress(left: string, right: string): boolean {
  const unwrap = (value: string) =>
    value.toLowerCase().replace(/^\[|\]$/gu, '').replace(/^::ffff:/u, '');
  return unwrap(left) === unwrap(right);
}

async function withinDeadline<T>(
  operation: Promise<T>,
  deadlineMs: number,
  now: () => number,
): Promise<T> {
  const remaining = Math.max(0, deadlineMs - now());
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error('safe fetch deadline exceeded')), remaining);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Minimal sandbox boundary: no DOM, script execution, external entities, or subprocesses. */
export async function parseContentInSandbox(
  content: Uint8Array,
  contentType: string,
): Promise<SafeParserResult> {
  const prefix = content.subarray(0, 4);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(content);
  const indicators: MalwareIndicator[] = [];
  if (text.includes('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')) {
    indicators.push('eicar_test_signature');
  }
  if (
    (prefix[0] === 0x4d && prefix[1] === 0x5a) ||
    (prefix[0] === 0x7f && prefix[1] === 0x45 && prefix[2] === 0x4c && prefix[3] === 0x46)
  ) {
    indicators.push('executable_magic');
  }
  if (
    contentType.includes('html') &&
    /<(?:script|iframe|object|embed)\b|on\w+\s*=|javascript:/iu.test(text)
  ) {
    indicators.push('active_content');
  }
  const extractedText = contentType.includes('html')
    ? text
        .replace(/<(?:script|style)\b[^>]*>[\s\S]*?<\/(?:script|style)>/giu, ' ')
        .replace(/<[^>]+>/gu, ' ')
        .replace(/\s+/gu, ' ')
        .trim()
    : text.replace(/\s+/gu, ' ').trim();
  return {
    safe: indicators.length === 0,
    indicators,
    extractedText: extractedText.slice(0, 100_000),
  };
}


/**
 * Performs a bounded fetch through a transport that must connect directly to
 * `pinnedAddress` while retaining `hostname` for TLS SNI and the Host header.
 */
export async function executeSafeFetch(
  submittedUrl: string,
  dependencies: SafeFetchDependencies,
  options: SafeFetchOptions = {},
): Promise<SafeFetchResult> {
  const limits = { ...DEFAULT_SAFE_FETCH_LIMITS, ...options.limits };
  const now = dependencies.now ?? Date.now;
  const deadlineMs = now() + limits.maxDurationMs;
  const controller = new AbortController();
  let currentUrl = submittedUrl;

  try {
    for (let redirectCount = 0; redirectCount <= limits.maxRedirects; redirectCount += 1) {
      if (now() >= deadlineMs) return fail('duration_exceeded');
      const parsed = evaluateExternalUrl(currentUrl, options.domainPolicy);
      if (!parsed.allowed) return fail(parsed.reason);
      const destination = await withinDeadline(
        resolveAndPinDestination(parsed.value, dependencies.resolveHost),
        deadlineMs,
        now,
      );
      if (!destination.allowed) return fail(destination.reason);

      let response: PinnedTransportResponse;
      try {
        response = await withinDeadline(
          dependencies.transport({
            url: destination.value.normalizedUrl,
            hostname: destination.value.hostname,
            port: destination.value.port,
            pinnedAddress: destination.value.pinnedAddress,
            headers: {
              host: destination.value.hostname,
              accept: limits.allowedContentTypes.join(', '),
              'user-agent': 'BlackBook-SafeFetcher/1.0',
            },
            signal: controller.signal,
          }),
          deadlineMs,
          now,
        );
      } catch (error) {
        return fail(error instanceof Error && error.message.includes('deadline')
          ? 'duration_exceeded'
          : 'transport_failed');
      }
      if (!equalAddress(response.remoteAddress, destination.value.pinnedAddress)) {
        return fail('connected_address_mismatch');
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        if (redirectCount >= limits.maxRedirects) return fail('redirect_limit_exceeded');
        const location = response.headers.location;
        if (!location) return fail('redirect_missing_location');
        try {
          currentUrl = new URL(location, destination.value.normalizedUrl).toString();
        } catch {
          return fail('invalid_url');
        }
        continue;
      }

      const contentType = contentTypeBase(response.headers['content-type']);
      if (!limits.allowedContentTypes.includes(contentType)) {
        return fail('content_type_not_allowed');
      }
      const declaredLength = Number(response.headers['content-length'] ?? 0);
      if (Number.isFinite(declaredLength) && declaredLength > limits.maxResponseBytes) {
        return fail('response_too_large');
      }

      const chunks: Uint8Array[] = [];
      let byteLength = 0;
      const iterator = response.body[Symbol.asyncIterator]();
      while (true) {
        let item: IteratorResult<Uint8Array>;
        try {
          item = await withinDeadline(iterator.next(), deadlineMs, now);
        } catch {
          return fail('duration_exceeded');
        }
        if (item.done) break;
        byteLength += item.value.byteLength;
        if (byteLength > limits.maxResponseBytes) {
          await iterator.return?.();
          return fail('response_too_large');
        }
        chunks.push(item.value);
      }
      const content = new Uint8Array(byteLength);
      let offset = 0;
      for (const chunk of chunks) {
        content.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const parser = await withinDeadline(
        (dependencies.parser ?? parseContentInSandbox)(content, contentType),
        deadlineMs,
        now,
      );
      if (!parser.safe) return fail('malware_indicator');
      return {
        ok: true,
        finalUrl: destination.value.normalizedUrl,
        redirectCount,
        contentType,
        byteLength,
        contentHash: createHash('sha256').update(content).digest('hex'),
        parser,
        quarantineState: 'validated',
        publicationAllowed: false,
      };
    }
    return fail('redirect_limit_exceeded');
  } catch (error) {
    return fail(error instanceof Error && error.message.includes('deadline')
      ? 'duration_exceeded'
      : 'transport_failed');
  } finally {
    controller.abort();
  }
}

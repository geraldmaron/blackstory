/**
 * Parses external URLs and classifies every literal or DNS-resolved destination.
 * The policy fails closed for non-web schemes, credentials, ambiguous DNS, and
 * private, loopback, link-local, metadata, multicast, or reserved addresses.
 */
import { isIP } from 'node:net';

export const URL_SAFETY_POLICY_VERSION = '1.0.0' as const;

export type UrlDenialReason =
  | 'invalid_url'
  | 'scheme_not_allowed'
  | 'userinfo_not_allowed'
  | 'port_not_allowed'
  | 'domain_not_allowed'
  | 'dns_resolution_failed'
  | 'dns_answer_not_public'
  | 'dns_answer_changed'
  | 'connected_address_mismatch';

export type SourceDomainPolicy = {
  readonly allowedDomains?: readonly string[];
  readonly deniedDomains?: readonly string[];
  readonly allowedPorts?: readonly number[];
};

export type ParsedExternalUrl = {
  readonly normalizedUrl: string;
  readonly hostname: string;
  readonly port: number;
  readonly protocol: 'http:' | 'https:';
};

export type PolicyDecision =
  | { readonly allowed: true; readonly value: ParsedExternalUrl }
  | { readonly allowed: false; readonly reason: UrlDenialReason };

export type ResolvedDestination = ParsedExternalUrl & {
  readonly pinnedAddress: string;
  readonly approvedAddresses: readonly string[];
};

export type ResolveHost = (
  hostname: string,
) => Promise<readonly { readonly address: string; readonly family: 4 | 6 }[]>;

const METADATA_HOSTS = new Set([
  'metadata',
  'metadata.google.internal',
  'metadata.goog',
  'instance-data',
  'instance-data.ec2.internal',
]);

function canonicalHostname(hostname: string): string {
  const unwrapped = hostname.startsWith('[') && hostname.endsWith(']')
    ? hostname.slice(1, -1)
    : hostname;
  return unwrapped.toLowerCase().replace(/\.$/u, '');
}

function matchesDomain(hostname: string, domain: string): boolean {
  const normalizedDomain = canonicalHostname(domain).replace(/^\./u, '');
  return hostname === normalizedDomain || hostname.endsWith(`.${normalizedDomain}`);
}

function ipv4Number(address: string): number | undefined {
  const pieces = address.split('.');
  if (pieces.length !== 4) return undefined;
  const octets = pieces.map((piece) => Number(piece));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return undefined;
  }
  return (((octets[0]! * 256 + octets[1]!) * 256 + octets[2]!) * 256 + octets[3]!) >>> 0;
}

function inIpv4Range(value: number, base: string, prefix: number): boolean {
  const baseValue = ipv4Number(base)!;
  const mask = prefix === 0 ? 0 : (0xffff_ffff << (32 - prefix)) >>> 0;
  return (value & mask) === (baseValue & mask);
}

const BLOCKED_IPV4_RANGES: readonly [string, number][] = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['192.88.99.0', 24],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

function expandIpv6(address: string): bigint | undefined {
  let candidate = address.toLowerCase().split('%', 1)[0]!;
  const embedded = candidate.match(/(\d{1,3}(?:\.\d{1,3}){3})$/u);
  if (embedded) {
    const value = ipv4Number(embedded[1]!);
    if (value === undefined) return undefined;
    candidate = candidate.slice(0, -embedded[1]!.length) +
      `${((value >>> 16) & 0xffff).toString(16)}:${(value & 0xffff).toString(16)}`;
  }
  const halves = candidate.split('::');
  if (halves.length > 2) return undefined;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves[1] ? halves[1].split(':') : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return undefined;
  const groups = halves.length === 2 ? [...left, ...Array<string>(missing).fill('0'), ...right] : left;
  if (groups.length !== 8 || groups.some((group) => !/^[\da-f]{1,4}$/u.test(group))) {
    return undefined;
  }
  return groups.reduce((value, group) => (value << 16n) | BigInt(`0x${group}`), 0n);
}

function inIpv6Range(value: bigint, base: bigint, prefix: number): boolean {
  const shift = BigInt(128 - prefix);
  return value >> shift === base >> shift;
}

const BLOCKED_IPV6_RANGES: readonly [bigint, number][] = [
  [0n, 128], // unspecified
  [1n, 128], // loopback
  [BigInt('0xfc000000000000000000000000000000'), 7], // unique-local
  [BigInt('0xfec00000000000000000000000000000'), 10], // deprecated site-local
  [BigInt('0xfe800000000000000000000000000000'), 10], // link-local
  [BigInt('0xff000000000000000000000000000000'), 8], // multicast
  [BigInt('0x00000000000000000000000000000000'), 96], // IPv4-compatible/reserved
  [BigInt('0x01000000000000000000000000000000'), 64], // discard-only
  [BigInt('0x20010db8000000000000000000000000'), 32], // documentation
  [BigInt('0x20010000000000000000000000000000'), 23], // reserved IETF block
  [BigInt('0x3fff0000000000000000000000000000'), 20], // documentation
  [BigInt('0x5f000000000000000000000000000000'), 16], // segment-routing reserved
];

/** Returns true only for globally routable IP destinations. */
export function isPublicIpAddress(address: string): boolean {
  const canonical = canonicalHostname(address);
  const family = isIP(canonical);
  if (family === 4) {
    const value = ipv4Number(canonical);
    return value !== undefined &&
      !BLOCKED_IPV4_RANGES.some(([base, prefix]) => inIpv4Range(value, base, prefix));
  }
  if (family === 6) {
    const value = expandIpv6(canonical);
    if (value === undefined) return false;
    // IPv4-mapped IPv6 must be evaluated using the IPv4 policy.
    if (value >> 32n === 0xffffn) {
      const mapped = Number(value & 0xffff_ffffn);
      const dotted = [
        (mapped >>> 24) & 255,
        (mapped >>> 16) & 255,
        (mapped >>> 8) & 255,
        mapped & 255,
      ].join('.');
      return isPublicIpAddress(dotted);
    }
    return !BLOCKED_IPV6_RANGES.some(([base, prefix]) => inIpv6Range(value, base, prefix));
  }
  return false;
}

/** Parses and normalizes a submitted URL without performing network I/O. */
export function evaluateExternalUrl(
  rawUrl: string,
  policy: SourceDomainPolicy = {},
): PolicyDecision {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { allowed: false, reason: 'invalid_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { allowed: false, reason: 'scheme_not_allowed' };
  }
  if (url.username || url.password) {
    return { allowed: false, reason: 'userinfo_not_allowed' };
  }
  const hostname = canonicalHostname(url.hostname);
  if (!hostname || METADATA_HOSTS.has(hostname)) {
    return { allowed: false, reason: 'domain_not_allowed' };
  }
  const denied = policy.deniedDomains ?? [];
  const allowed = policy.allowedDomains;
  if (
    denied.some((domain) => matchesDomain(hostname, domain)) ||
    (allowed !== undefined && !allowed.some((domain) => matchesDomain(hostname, domain)))
  ) {
    return { allowed: false, reason: 'domain_not_allowed' };
  }
  const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
  const permittedPorts = policy.allowedPorts ?? [80, 443];
  if (!Number.isInteger(port) || !permittedPorts.includes(port)) {
    return { allowed: false, reason: 'port_not_allowed' };
  }
  url.hash = '';
  url.hostname = isIP(hostname) === 6 ? `[${hostname}]` : hostname;
  return {
    allowed: true,
    value: {
      normalizedUrl: url.toString(),
      hostname,
      port,
      protocol: url.protocol,
    },
  };
}

/** Resolves once, rejects mixed/private answers, and chooses a pinned public IP. */
export async function resolveAndPinDestination(
  parsed: ParsedExternalUrl,
  resolveHost: ResolveHost,
): Promise<
  | { readonly allowed: true; readonly value: ResolvedDestination }
  | { readonly allowed: false; readonly reason: UrlDenialReason }
> {
  const literalFamily = isIP(parsed.hostname);
  let addresses: readonly string[];
  if (literalFamily) {
    addresses = [parsed.hostname];
  } else {
    try {
      const answers = await resolveHost(parsed.hostname);
      addresses = [...new Set(answers.map((answer) => canonicalHostname(answer.address)))].sort();
    } catch {
      return { allowed: false, reason: 'dns_resolution_failed' };
    }
  }
  if (addresses.length === 0) return { allowed: false, reason: 'dns_resolution_failed' };
  if (addresses.some((address) => !isPublicIpAddress(address))) {
    return { allowed: false, reason: 'dns_answer_not_public' };
  }
  return {
    allowed: true,
    value: {
      ...parsed,
      pinnedAddress: addresses[0]!,
      approvedAddresses: addresses,
    },
  };
}

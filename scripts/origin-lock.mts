/**
 * Locks the blackstory.app origin to Cloudflare (repo-4wb0e.4).
 *
 * Vercel serves every domain it hosts from one anycast address, so a client that sends
 * `Host: blackstory.app` to 76.76.21.21 skips every Cloudflare rule, the edge rate limit and the
 * edge cache. The lock has two halves, both managed here:
 *
 * - Cloudflare: a request-header Transform Rule sets `x-bs-origin-auth: <secret>` on every
 *   request Cloudflare proxies to Vercel.
 * - Vercel: a firewall custom rule matches public-host requests (blackstory.app, www) whose
 *   header is missing or wrong. Denied traffic is free on Vercel (no CDN requests or data
 *   transfer). `blackstory-admin.vercel.app` is deliberately out of scope: it is how staff reach
 *   /admin and it never passes through Cloudflare.
 *
 * Cloudflare rates header validation "moderately secure"; its stronger options (Tunnel,
 * Authenticated Origin Pulls, JWT) cannot run in front of a Vercel origin without code on every
 * request. The secret is a cost control, not authentication: nothing sensitive may rely on it.
 *
 * Secrets come from 1Password (`OP_ITEM`, fields `password` = current and `previous`), or from
 * ORIGIN_AUTH_SECRET / ORIGIN_AUTH_SECRET_PREVIOUS. They are never printed; output shows a
 * slow (scrypt) fingerprint instead. The Cloudflare token needs Zone WAF: Edit (bot rules), Transform
 * Rules: Edit, on this zone only; the Vercel half uses the logged-in `vercel` CLI.
 *
 *   node --conditions development --import tsx scripts/origin-lock.mts               # dry run
 *   node --conditions development --import tsx scripts/origin-lock.mts --apply --mode=log
 *   node --conditions development --import tsx scripts/origin-lock.mts --apply --mode=deny
 *   node --conditions development --import tsx scripts/origin-lock.mts --verify
 *
 * Rollout: apply in log mode, watch what the rule matches, then deny. A deny apply refuses to run
 * unless the Cloudflare header is already in place, and rolls itself back to log mode if a normal
 * request through Cloudflare stops getting through.
 *
 * Rotation (no gap): in 1Password copy `password` into `previous` and generate a new `password`;
 * apply (Vercel accepts both, then Cloudflare sends the new one); once it has propagated, clear
 * `previous` and apply again.
 */
import { execFileSync } from 'node:child_process';
import { scryptSync } from 'node:crypto';
import { request as httpsRequest } from 'node:https';
import type { LookupFunction } from 'node:net';

const ZONE_ID = '653abe0dbd1b10d22411306cb1f645be';
const CF_API = 'https://api.cloudflare.com/client/v4';
const TRANSFORM_PHASE = 'http_request_late_transform';
const TEAM_ID = 'team_DldsFiy3ArSsA0sJvIXr2zId';
const PROJECT_ID = 'prj_AJYcJozo2XqLfBXItGxHV5SQP06h';
const OP_ITEM = 'op://Private/BlackStory origin auth header';
const CF_TOKEN_REF = 'op://Private/rqlj6lq7f7i5ontlsu7qdnd7lu/credential';
/** Vercel's anycast address for apex domains: where a Cloudflare bypass lands. */
const VERCEL_ANYCAST = '76.76.21.21';
const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';

export const ORIGIN_AUTH_HEADER = 'x-bs-origin-auth';
export const PUBLIC_HOST_PATTERN = '^(www\\.)?blackstory\\.app$';
export const CF_RULE_REF = 'bs_origin_auth';
export const VERCEL_RULE_NAME = 'bs-origin-auth';

export type Mode = 'log' | 'deny';

type Condition = {
  readonly type: string;
  readonly op: string;
  readonly key?: string;
  readonly value?: string;
};
export type VercelRule = {
  readonly name: string;
  readonly description: string;
  readonly active: boolean;
  readonly conditionGroup: readonly { readonly conditions: readonly Condition[] }[];
  readonly action: { readonly mitigate: { readonly action: Mode } };
};

/**
 * A short, stable label for a secret, so the plan can show which value sits at each edge without
 * printing it. scrypt rather than a fast hash: a printed prefix of a fast digest is cheap to
 * brute-force against a guessed token. The fixed salt keeps labels comparable across runs.
 */
const fingerprints = new Map<string, string>();
const fingerprint = (secret: string): string => {
  let label = fingerprints.get(secret);
  if (label === undefined) {
    label = scryptSync(secret, 'blackstory-origin-lock-fingerprint', 16)
      .toString('hex')
      .slice(0, 8);
    fingerprints.set(secret, label);
  }
  return label;
};

/** Every secret this run has read, so no error message can carry one out. */
const knownSecrets = new Set<string>();
function redact(text: string): string {
  let out = text;
  for (const secret of knownSecrets)
    out = out.split(secret).join(`<secret ${fingerprint(secret)}>`);
  return out;
}

function assertSecretShape(secret: string, label: string): void {
  // Header-safe and long enough to be unguessable. Generate with a password manager (letters and
  // digits, 48+ characters) or `openssl rand -base64 48 | tr '+/' '-_' | tr -d '='`.
  if (!/^[A-Za-z0-9_-]{40,}$/.test(secret)) {
    throw new Error(`${label} must be 40+ characters of [A-Za-z0-9_-]`);
  }
}

function opRead(reference: string): string | undefined {
  try {
    const value = execFileSync('op', ['read', reference], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
    return value.length > 0 ? value : undefined;
  } catch {
    return undefined;
  }
}

function readSecrets(): { current: string; previous: string | undefined } {
  const current = process.env.ORIGIN_AUTH_SECRET?.trim() || opRead(`${OP_ITEM}/password`);
  if (current === undefined) {
    throw new Error(
      `no current secret: create ${OP_ITEM} (field password) or set ORIGIN_AUTH_SECRET`,
    );
  }
  knownSecrets.add(current);
  assertSecretShape(current, 'current secret');
  const previous =
    process.env.ORIGIN_AUTH_SECRET_PREVIOUS?.trim() || opRead(`${OP_ITEM}/previous`) || undefined;
  if (previous !== undefined) {
    knownSecrets.add(previous);
    assertSecretShape(previous, 'previous secret');
  }
  return { current, previous: previous === current ? undefined : previous };
}

/** The Vercel rule: public host AND (header missing OR header matches no accepted secret). */
export function vercelRule(mode: Mode, accepted: readonly string[]): VercelRule {
  const host: Condition = { type: 'host', op: 're', value: PUBLIC_HOST_PATTERN };
  return {
    name: VERCEL_RULE_NAME,
    description:
      'Public hosts only answer requests that came through Cloudflare (repo-4wb0e.4). Managed by scripts/origin-lock.mts.',
    active: true,
    conditionGroup: [
      { conditions: [host, { type: 'header', key: ORIGIN_AUTH_HEADER, op: 'nex' }] },
      {
        conditions: [
          host,
          ...accepted.map((value) => ({
            type: 'header',
            key: ORIGIN_AUTH_HEADER,
            op: 'neq',
            value,
          })),
        ],
      },
    ],
    action: { mitigate: { action: mode } },
  };
}

/** The Cloudflare Transform Rule that stamps the current secret on every proxied request. */
export function cloudflareTransformRule(secret: string) {
  return {
    ref: CF_RULE_REF,
    description:
      'Origin auth header checked by the Vercel firewall (repo-4wb0e.4); scripts/origin-lock.mts',
    expression: 'true',
    action: 'rewrite',
    action_parameters: { headers: { [ORIGIN_AUTH_HEADER]: { operation: 'set', value: secret } } },
    enabled: true,
  };
}

// ---------------------------------------------------------------------------- Cloudflare

type CfRule = ReturnType<typeof cloudflareTransformRule> & { readonly id: string };
type CfRuleset = { readonly id: string; readonly rules?: readonly CfRule[] };

function cloudflareToken(): string {
  const token = process.env.CLOUDFLARE_API_TOKEN?.trim() || opRead(CF_TOKEN_REF);
  if (token === undefined)
    throw new Error('CLOUDFLARE_API_TOKEN is not set and 1Password had none');
  knownSecrets.add(token);
  return token;
}

async function cf<T>(
  token: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<T | undefined> {
  const response = await fetch(`${CF_API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 404) return undefined;
  const json = (await response.json()) as { success: boolean; result: T; errors: unknown };
  if (!json.success)
    throw new Error(redact(`${method} ${path} failed: ${JSON.stringify(json.errors)}`));
  return json.result;
}

// ---------------------------------------------------------------------------- Vercel

type VercelActiveConfig = {
  readonly firewallEnabled?: boolean;
  readonly rules?: readonly (VercelRule & { readonly id: string })[];
};

const FIREWALL_QUERY = `projectId=${PROJECT_ID}&teamId=${TEAM_ID}`;

function vercelApi(method: string, path: string, body?: unknown): unknown {
  const args = ['api', path, '-X', method, '--raw', '--non-interactive'];
  if (body !== undefined) args.push('--input', '-');
  let out: string;
  try {
    out = execFileSync('vercel', args, {
      encoding: 'utf8',
      input: body !== undefined ? JSON.stringify(body) : undefined,
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
  } catch (error) {
    // The CLI exits non-zero on an API error and prints `Error: <message> (<status>)`.
    const failed = error as { stdout?: string; stderr?: string };
    out = `${failed.stdout ?? ''}\n${failed.stderr ?? ''}`.trim();
    if (!/Error:/.test(out)) out = `Error: vercel exited non-zero ${out.slice(0, 200)}`;
  }
  if (/Error:/.test(out)) {
    if (/\(404\)/.test(out) && method === 'GET') return undefined;
    throw new Error(redact(`vercel api ${method} ${path}: ${out.slice(0, 300)}`));
  }
  return out.length > 0 ? JSON.parse(out) : undefined;
}

function readVercelConfig(): VercelActiveConfig | undefined {
  const raw = vercelApi('GET', `/v1/security/firewall/config/active?${FIREWALL_QUERY}`) as
    (VercelActiveConfig & { active?: VercelActiveConfig }) | undefined;
  return raw?.active ?? raw;
}

/** Only the fields this script owns, so a rule read back from the API compares cleanly. */
function comparable(rule: VercelRule): string {
  return JSON.stringify({
    active: rule.active,
    action: rule.action.mitigate.action,
    groups: rule.conditionGroup.map((group) =>
      group.conditions.map(({ type, op, key, value }) => ({ type, op, key, value })),
    ),
  });
}

function describeVercelRule(rule: VercelRule | undefined): string {
  if (rule === undefined) return 'absent';
  const accepted = rule.conditionGroup
    .flatMap((group) => group.conditions)
    .filter((condition) => condition.type === 'header' && condition.op === 'neq')
    .map((condition) => fingerprint(condition.value ?? ''));
  return `${rule.active ? 'active' : 'inactive'}, ${rule.action.mitigate.action}, accepts [${accepted.join(', ')}]`;
}

// ---------------------------------------------------------------------------- probes

function probe(
  url: string,
  options: { pin?: boolean; secret?: string; userAgent?: string } = {},
): Promise<{ status: number; server: string; cfRay: boolean }> {
  const { hostname, pathname, search } = new URL(url);
  const lookup: LookupFunction = (_host, lookupOptions, callback) => {
    if ((lookupOptions as { all?: boolean }).all) {
      (callback as (e: null, a: { address: string; family: number }[]) => void)(null, [
        { address: VERCEL_ANYCAST, family: 4 },
      ]);
    } else {
      callback(null, VERCEL_ANYCAST, 4);
    }
  };
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      {
        host: hostname,
        servername: hostname,
        path: `${pathname}${search}`,
        method: 'GET',
        headers: {
          'user-agent': options.userAgent ?? BROWSER_UA,
          ...(options.secret !== undefined ? { [ORIGIN_AUTH_HEADER]: options.secret } : {}),
        },
        ...(options.pin === true ? { lookup } : {}),
        // A fresh connection per probe: the default agent pools keep-alive sockets by hostname,
        // so a pinned probe could otherwise ride an earlier connection to Cloudflare.
        agent: false,
        timeout: 15_000,
      },
      (res) => {
        res.resume();
        resolve({
          status: res.statusCode ?? 0,
          server: String(res.headers.server ?? ''),
          cfRay: res.headers['cf-ray'] !== undefined,
        });
      },
    );
    req.on('timeout', () => req.destroy(new Error(`timeout: ${url}`)));
    req.on('error', reject);
    req.end();
  });
}

async function verify(mode: Mode | undefined, secret: string): Promise<boolean> {
  const expectDirect = mode === 'deny' ? 403 : 200;
  const direct = { pin: true } as const;
  type Via = 'cloudflare' | 'vercel';
  const checks: {
    label: string;
    via: Via;
    run: () => ReturnType<typeof probe>;
    ok: (status: number) => boolean;
  }[] = [
    {
      label: 'reader via Cloudflare  /',
      via: 'cloudflare',
      run: () => probe('https://blackstory.app/'),
      ok: (s) => s === 200,
    },
    {
      label: 'reader via Cloudflare  www',
      via: 'cloudflare',
      run: () => probe('https://www.blackstory.app/about'),
      ok: (s) => s < 400,
    },
    {
      label: `direct, no header      (expect ${expectDirect})`,
      via: 'vercel',
      run: () => probe('https://blackstory.app/about', direct),
      ok: (s) => s === expectDirect,
    },
    {
      label: `direct, wrong header   (expect ${expectDirect})`,
      via: 'vercel',
      run: () => probe('https://blackstory.app/about', { ...direct, secret: 'x'.repeat(48) }),
      ok: (s) => s === expectDirect,
    },
    {
      label: `direct www, no header  (expect ${expectDirect})`,
      via: 'vercel',
      run: () => probe('https://www.blackstory.app/about', direct),
      ok: (s) => (mode === 'deny' ? s === 403 : s < 400),
    },
    {
      label: 'direct, right header   (expect 200)',
      via: 'vercel',
      run: () => probe('https://blackstory.app/about', { ...direct, secret }),
      ok: (s) => s === 200,
    },
    {
      label: 'admin host /admin      (expect 3xx)',
      via: 'vercel',
      run: () => probe('https://blackstory-admin.vercel.app/admin'),
      ok: (s) => s >= 300 && s < 400,
    },
  ];
  let allOk = true;
  for (const check of checks) {
    const result = await check.run();
    // Prove which network answered: a "direct" probe that came back through Cloudflare tested
    // nothing, and a reader probe that skipped Cloudflare is not a reader's path.
    const reachedVercel = !result.cfRay && /vercel/i.test(result.server);
    const rightPath = check.via === 'vercel' ? reachedVercel : result.cfRay;
    const ok = rightPath && check.ok(result.status);
    allOk &&= ok;
    console.log(
      `  ${ok ? 'ok  ' : 'FAIL'} ${check.label.padEnd(38)} ${result.status} server=${result.server}` +
        `${result.cfRay ? ' cf-ray' : ''}${rightPath ? '' : ' (wrong network)'}`,
    );
  }
  return allOk;
}

// ---------------------------------------------------------------------------- main

function parseMode(): Mode | undefined {
  const flag = process.argv.find((arg) => arg.startsWith('--mode='));
  if (flag === undefined) return undefined;
  const mode = flag.slice('--mode='.length);
  if (mode !== 'log' && mode !== 'deny') throw new Error('--mode must be log or deny');
  return mode;
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const verifyOnly = process.argv.includes('--verify');
  const requested = parseMode();
  if (apply && requested === undefined) throw new Error('--apply needs --mode=log or --mode=deny');

  const { current, previous } = readSecrets();
  const accepted = previous === undefined ? [current] : [current, previous];
  const token = cloudflareToken();

  const vercelConfig = readVercelConfig();
  const existingVercel = vercelConfig?.rules?.find((rule) => rule.name === VERCEL_RULE_NAME);
  const currentMode = existingVercel?.action.mitigate.action;

  if (verifyOnly) {
    console.log(`verify (rule ${describeVercelRule(existingVercel)}):`);
    if (!(await verify(currentMode, current))) process.exitCode = 1;
    return;
  }

  const zone = `/zones/${ZONE_ID}`;
  const entrypoint = await cf<CfRuleset>(
    token,
    'GET',
    `${zone}/rulesets/phases/${TRANSFORM_PHASE}/entrypoint`,
  );
  const existingCf = entrypoint?.rules?.find((rule) => rule.ref === CF_RULE_REF);
  const cfValue = existingCf?.action_parameters.headers[ORIGIN_AUTH_HEADER]?.value;

  const mode = requested ?? currentMode ?? 'log';
  const desiredVercel = vercelRule(mode, accepted);
  const vercelChanged =
    existingVercel === undefined || comparable(existingVercel) !== comparable(desiredVercel);
  const cfChanged = existingCf === undefined || cfValue !== current || existingCf.enabled === false;

  console.log(
    `secrets: current ${fingerprint(current)}${previous ? `, previous ${fingerprint(previous)}` : ''}`,
  );
  console.log(
    `vercel firewall: ${vercelConfig?.firewallEnabled ? 'enabled' : 'disabled or unset'}`,
  );
  console.log(`vercel rule ${VERCEL_RULE_NAME}: ${describeVercelRule(existingVercel)}`);
  console.log(`  -> ${describeVercelRule(desiredVercel)}${vercelChanged ? '' : ' (no change)'}`);
  console.log(
    `cloudflare transform ${CF_RULE_REF}: ${existingCf === undefined ? 'absent' : `sets ${fingerprint(cfValue ?? '')}`}` +
      `${cfChanged ? ` -> sets ${fingerprint(current)}` : ' (no change)'}`,
  );
  const foreign = entrypoint?.rules?.filter((rule) => rule.ref !== CF_RULE_REF) ?? [];
  if (foreign.length > 0) console.log(`  keeping ${foreign.length} other late-transform rule(s)`);

  if (!apply) {
    console.log('\nDry run. Re-run with --apply --mode=log|deny to write.');
    return;
  }

  if (mode === 'deny' && (existingCf === undefined || !accepted.includes(cfValue ?? ''))) {
    throw new Error(
      'refusing deny: Cloudflare does not send an accepted secret yet; apply --mode=log first',
    );
  }

  // Vercel first: during a rotation it must accept the new secret before Cloudflare sends it.
  if (!vercelConfig?.firewallEnabled) {
    vercelApi('PATCH', `/v1/security/firewall/config?${FIREWALL_QUERY}`, {
      action: 'firewallEnabled',
      id: null,
      value: true,
    });
  }
  if (vercelChanged) {
    vercelApi(
      'PATCH',
      `/v1/security/firewall/config?${FIREWALL_QUERY}`,
      existingVercel === undefined
        ? { action: 'rules.insert', id: null, value: desiredVercel }
        : { action: 'rules.update', id: existingVercel.id, value: desiredVercel },
    );
  }

  if (cfChanged) {
    const rule = cloudflareTransformRule(current);
    if (entrypoint === undefined) {
      await cf(token, 'PUT', `${zone}/rulesets/phases/${TRANSFORM_PHASE}/entrypoint`, {
        rules: [rule],
      });
    } else if (existingCf === undefined) {
      await cf(token, 'POST', `${zone}/rulesets/${entrypoint.id}/rules`, rule);
    } else {
      await cf(token, 'PATCH', `${zone}/rulesets/${entrypoint.id}/rules/${existingCf.id}`, rule);
    }
  }

  const after = readVercelConfig()?.rules?.find((rule) => rule.name === VERCEL_RULE_NAME);
  console.log(`\nApplied. vercel rule: ${describeVercelRule(after)}`);
  if (after === undefined || comparable(after) !== comparable(desiredVercel)) {
    throw new Error(
      'the Vercel rule read back does not match what was written (draft not published?)',
    );
  }

  // Readers first: if a normal request through Cloudflare stops getting through, undo the deny.
  await new Promise((resolve) => setTimeout(resolve, 5_000));
  console.log('verify:');
  const ok = await verify(mode, current);
  if (!ok && mode === 'deny') {
    const reader = await probe('https://blackstory.app/');
    if (reader.status !== 200) {
      vercelApi('PATCH', `/v1/security/firewall/config?${FIREWALL_QUERY}`, {
        action: 'rules.update',
        id: after.id,
        value: vercelRule('log', accepted),
      });
      throw new Error(
        `readers got ${reader.status} through Cloudflare; rolled the rule back to log`,
      );
    }
  }
  if (!ok) process.exitCode = 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(redact(error instanceof Error ? error.message : String(error)));
    process.exitCode = 1;
  });
}

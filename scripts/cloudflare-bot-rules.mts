/**
 * Applies the blackstory.app bot-traffic WAF custom rules (and Cloudflare's AI bot policies)
 * through the Cloudflare API. Idempotent: each rule carries a stable `ref`, so a
 * re-run updates in place instead of adding duplicates, and rules this script does not own are
 * left untouched.
 *
 * Dry run (default) prints the plan; `--apply` writes it.
 *
 *   CLOUDFLARE_API_TOKEN=… node --conditions development --import tsx scripts/cloudflare-bot-rules.mts
 *   CLOUDFLARE_API_TOKEN=… node --conditions development --import tsx scripts/cloudflare-bot-rules.mts --apply
 *
 * Token scopes: Zone → Zone WAF: Edit, Zone → Bot Management: Edit (for the AI bot policies),
 * on the blackstory.app zone only. 1Password: "Cloudflare API · BlackStory bot rules
 * (blackstory.app)" in the Private vault.
 *
 * Why these rules: docs/security/cost-resource-controls.md, "Bot traffic at the edge". Custom
 * rules run before the cache, so a blocked request never reaches Vercel; the app's own 403 in
 * `apps/web/src/proxy.ts` still costs a function invocation.
 */
import {
  AI_TRAINING_USER_AGENTS,
  SEO_TOOL_USER_AGENTS,
} from '../apps/web/src/lib/traffic-class/agent-lists';

const ZONE_ID = '653abe0dbd1b10d22411306cb1f645be';
const API = 'https://api.cloudflare.com/client/v4';
const PHASE = 'http_request_firewall_custom';
/** Cloudflare Free allows five custom rules per zone. */
const FREE_PLAN_RULE_LIMIT = 5;

/**
 * Cloudflare's AI bot policies (Security Settings → Configure AI bot policies), which replaced the
 * single "Block AI bots" toggle (`ai_bots_protection`, deprecated 2026-09-15). Training and Agent
 * are blocked zone-wide. Search is pinned to allowed on purpose: since Cloudflare's July 2026
 * taxonomy it covers conventional search engines too (Googlebot, Bingbot), so blocking it would take
 * the site out of search. The AI search crawlers we do refuse are blocked by name in
 * `bs_bot_ai_crawlers`.
 */
export const AI_BOT_POLICIES = {
  ai_training: 'block',
  ai_user: 'block',
  ai_search: 'disabled',
} as const;

/** Response-only fields of the bot_management config; the PUT rejects them. */
const READ_ONLY_BOT_MANAGEMENT_FIELDS = new Set(['using_latest_model', 'stale_zone_configuration']);

type Rule = {
  readonly ref: string;
  readonly description: string;
  readonly action: 'block' | 'managed_challenge';
  readonly expression: string;
};

/** Expression values are quoted Cloudflare strings; user-agent tokens never contain quotes. */
function uaContainsAny(tokens: readonly string[]): string {
  const unique = [...new Set(tokens.map((token) => token.toLowerCase()))];
  for (const token of unique) {
    if (token.includes('"') || token.includes('\\')) throw new Error(`unsafe token: ${token}`);
  }
  return unique.map((token) => `(lower(http.user_agent) contains "${token}")`).join(' or ');
}

/** Scripted clients challenged on page routes. `curl` is left out: the runbooks probe with it. */
const SCRIPTED_CLIENTS = [
  'python-requests',
  'python-httpx',
  'aiohttp',
  'scrapy',
  'Go-http-client',
  'Java/',
  'okhttp',
  'libwww-perl',
  'HeadlessChrome',
  'PhantomJS',
] as const;

export const BOT_RULES: readonly Rule[] = [
  {
    ref: 'bs_bot_ai_crawlers',
    description: 'Block AI training and answer crawlers (agent-lists.ts AI_TRAINING_USER_AGENTS)',
    action: 'block',
    expression: uaContainsAny(AI_TRAINING_USER_AGENTS),
  },
  {
    ref: 'bs_bot_seo_crawlers',
    description: 'Block SEO and marketing crawlers (agent-lists.ts SEO_TOOL_USER_AGENTS)',
    action: 'block',
    expression: uaContainsAny(SEO_TOOL_USER_AGENTS),
  },
  {
    ref: 'bs_bot_scanner_paths',
    description: 'Block vulnerability-scanner paths (the site is Next.js; none are real)',
    action: 'block',
    expression: [
      'starts_with(http.request.uri.path, "/.git")',
      'starts_with(http.request.uri.path, "/.env")',
      'starts_with(http.request.uri.path, "/wp-")',
      'ends_with(http.request.uri.path, ".php")',
      'starts_with(http.request.uri.path, "/phpmyadmin")',
      'starts_with(http.request.uri.path, "/cgi-bin")',
    ].join(' or '),
  },
  {
    ref: 'bs_bot_crawl_trap',
    description: 'Challenge unverified bots on /records and /explore multi-parameter URLs',
    action: 'managed_challenge',
    expression:
      '(http.request.uri.path in {"/records" "/explore"}) and ' +
      '(http.request.uri.query contains "&") and not cf.client.bot',
  },
  {
    ref: 'bs_bot_scripted_clients',
    description: 'Challenge scripted HTTP clients on page routes',
    action: 'managed_challenge',
    expression:
      `((${uaContainsAny(SCRIPTED_CLIENTS)}) or (http.user_agent eq "")) and ` +
      'not starts_with(http.request.uri.path, "/api/") and ' +
      'not any(http.request.headers.names[*] == "x-maintenance-bypass") and not cf.client.bot',
  },
];

type CfRule = Rule & { readonly id: string; readonly enabled?: boolean };
type CfRuleset = { readonly id: string; readonly rules?: readonly CfRule[] };

async function cf<T>(method: string, path: string, body?: unknown): Promise<T | undefined> {
  const token = process.env.CLOUDFLARE_API_TOKEN;
  if (!token) throw new Error('CLOUDFLARE_API_TOKEN is not set');
  const response = await fetch(`${API}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  if (response.status === 404) return undefined;
  const json = (await response.json()) as { success: boolean; result: T; errors: unknown };
  if (!json.success) {
    throw new Error(`${method} ${path} failed: ${JSON.stringify(json.errors)}`);
  }
  return json.result;
}

function payload(rule: Rule): Omit<Rule, never> & { enabled: true } {
  return { ...rule, enabled: true };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const zone = `/zones/${ZONE_ID}`;
  const entrypoint = await cf<CfRuleset>('GET', `${zone}/rulesets/phases/${PHASE}/entrypoint`);
  const existing = entrypoint?.rules ?? [];
  const byRef = new Map(existing.map((rule) => [rule.ref, rule]));
  const foreign = existing.filter((rule) => !BOT_RULES.some((own) => own.ref === rule.ref));
  const toAdd = BOT_RULES.filter((rule) => !byRef.has(rule.ref));
  const toUpdate = BOT_RULES.filter((rule) => byRef.has(rule.ref));

  console.log(`custom rules now: ${existing.length} (${foreign.length} not owned by this script)`);
  for (const rule of foreign) console.log(`  keep   ${rule.description}`);
  for (const rule of toUpdate) console.log(`  update ${rule.ref} [${rule.action}]`);
  for (const rule of toAdd) console.log(`  add    ${rule.ref} [${rule.action}]`);
  for (const rule of BOT_RULES) {
    console.log(`\n# ${rule.ref} (${rule.expression.length} chars)\n${rule.expression}`);
  }

  const total = foreign.length + BOT_RULES.length;
  if (total > FREE_PLAN_RULE_LIMIT) {
    throw new Error(
      `${total} custom rules would exceed the Free plan's ${FREE_PLAN_RULE_LIMIT}; ` +
        'remove or merge the rules listed as "keep" first',
    );
  }

  const botManagement = await cf<Record<string, unknown>>('GET', `${zone}/bot_management`);
  const policyChanges = Object.entries(AI_BOT_POLICIES).filter(
    ([key, value]) => botManagement?.[key] !== value,
  );
  console.log(`\nbot_management.fight_mode: ${String(botManagement?.fight_mode)} (left as is)`);
  for (const [key, value] of Object.entries(AI_BOT_POLICIES)) {
    const now = String(botManagement?.[key]);
    console.log(`bot_management.${key}: ${now}${now === value ? '' : ` -> ${value}`}`);
  }

  if (!apply) {
    console.log('\nDry run. Re-run with --apply to write.');
    return;
  }

  if (entrypoint === undefined) {
    await cf('PUT', `${zone}/rulesets/phases/${PHASE}/entrypoint`, {
      rules: BOT_RULES.map(payload),
    });
  } else {
    for (const rule of toUpdate) {
      const id = byRef.get(rule.ref)!.id;
      await cf('PATCH', `${zone}/rulesets/${entrypoint.id}/rules/${id}`, payload(rule));
    }
    for (const rule of toAdd) {
      await cf('POST', `${zone}/rulesets/${entrypoint.id}/rules`, payload(rule));
    }
  }

  // PUT replaces the whole object, so send back every field read above with only the policies
  // changed (a bare PUT would reset Bot Fight Mode). Response-only fields are stripped: the API
  // answers 400 "Bad Request" when `using_latest_model` (readOnly in Cloudflare's OpenAPI schema)
  // is echoed back.
  if (botManagement !== undefined && policyChanges.length > 0) {
    const writable = Object.fromEntries(
      Object.entries(botManagement).filter(([key]) => !READ_ONLY_BOT_MANAGEMENT_FIELDS.has(key)),
    );
    await cf('PUT', `${zone}/bot_management`, { ...writable, ...AI_BOT_POLICIES });
  }
  const botAfter = await cf<Record<string, unknown>>('GET', `${zone}/bot_management`);
  if (botAfter?.fight_mode !== botManagement?.fight_mode) {
    throw new Error(
      `fight_mode changed from ${String(botManagement?.fight_mode)} to ${String(botAfter?.fight_mode)}`,
    );
  }

  const after = await cf<CfRuleset>('GET', `${zone}/rulesets/phases/${PHASE}/entrypoint`);
  console.log('\nApplied. Custom rules now:');
  for (const rule of after?.rules ?? []) {
    console.log(
      `  ${rule.enabled === false ? 'off' : 'on '} ${rule.action.padEnd(17)} ${rule.description}`,
    );
  }
  console.log('AI bot policies now:');
  for (const key of ['fight_mode', ...Object.keys(AI_BOT_POLICIES)]) {
    console.log(`  ${key}: ${String(botAfter?.[key])}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

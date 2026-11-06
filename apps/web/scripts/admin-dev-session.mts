/**
 * Signs a development agent into the local admin without anyone typing a password.
 *
 *   cd apps/web && set -a && . ./.env.local && set +a && \
 *     node --conditions development --import tsx scripts/admin-dev-session.mts [--provision]
 *
 * The identity is one dedicated Supabase user (ADMIN_DEV_AGENT_EMAIL, default below) whose
 * app_metadata.app_role is `observer`: it reads every admin surface and the edge gate and route
 * authorizer refuse it any non-GET. It has no password. `--provision` creates it, or resets its
 * role to observer if someone widened it; without the flag a missing user is an error, so the
 * first run is a deliberate act.
 *
 * The session is minted with the service key already in `.env.local` (a magic link generated and
 * verified server-side, never emailed), then handed to the browser once: a server on
 * localhost:3049 answers a single request at a random path by setting the Supabase auth cookies
 * and redirecting to localhost:3048/admin. Cookies are scoped by host, not port, so the dev server
 * sees them. Tokens never reach stdout, a file, or an agent transcript, and nothing here is part
 * of the deployed app. The handoff server exits after one use or two minutes.
 *
 * Open the printed URL in the browser that should be signed in (the agent's Browser pane, or
 * yours). The URL is a bearer credential until it is used or expires; treat it like one.
 *
 * The handoff expiring does not end the session it delivered. End it with `--revoke` when the
 * work is done (see main). Because cookies ignore ports, any other localhost service that browser
 * visits also receives them: use a browser profile kept for this, not your everyday one.
 */
import { randomBytes } from 'node:crypto';
import { createServer, type ServerResponse } from 'node:http';
import { createServerClient } from '@supabase/ssr';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const DEFAULT_AGENT_EMAIL = 'admin-dev-agent@blackstory.invalid';
const HANDOFF_PORT = 3049;
const ADMIN_URL = 'http://localhost:3048/admin';
const HANDOFF_TTL_MS = 120_000;

type Cookie = { name: string; value: string; options: Record<string, unknown> };

function requireEnv(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name]?.trim();
    if (value) return value;
  }
  throw new Error(`Missing ${names.join(' or ')}. Source apps/web/.env.local first.`);
}

function refuseOutsideLocalDevelopment(): void {
  if (process.env.VERCEL || process.env.CI || process.env.NODE_ENV === 'production') {
    throw new Error('admin-dev-session runs on a developer machine only.');
  }
}

async function ensureObserver(
  admin: SupabaseClient,
  email: string,
  provision: boolean,
): Promise<string> {
  // The agent user is one of a handful of staff accounts, so the first page is enough to find it.
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw new Error(`Listing users failed: ${error.message}`);
  const existing = data.users.find((user) => user.email?.toLowerCase() === email);
  const role = existing?.app_metadata?.app_role;

  if (existing && role === 'observer') return existing.id;
  if (!provision) {
    throw new Error(
      existing
        ? `${email} has app_role=${String(role)}, not observer. Rerun with --provision to reset it.`
        : `${email} does not exist. Rerun with --provision to create it.`,
    );
  }
  if (existing) {
    const { error: updateError } = await admin.auth.admin.updateUserById(existing.id, {
      app_metadata: { app_role: 'observer' },
    });
    if (updateError) throw new Error(`Resetting role failed: ${updateError.message}`);
    console.log(`provision: reset ${email} to observer`);
    return existing.id;
  }
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    app_metadata: { app_role: 'observer' },
  });
  if (createError || !created.user) {
    throw new Error(`Creating user failed: ${createError?.message ?? 'no user returned'}`);
  }
  console.log(`provision: created ${email} as observer`);
  return created.user.id;
}

async function mintSessionCookies(
  url: string,
  anonKey: string,
  admin: SupabaseClient,
  email: string,
): Promise<Cookie[]> {
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email });
  if (error || !data.properties?.hashed_token) {
    throw new Error(`Generating the sign-in link failed: ${error?.message ?? 'no token'}`);
  }

  // Let @supabase/ssr write the cookies itself so the name, encoding and chunking match exactly
  // what the console's browser client and edge gate read.
  let cookies: Cookie[] = [];
  const client = createServerClient(url, anonKey, {
    cookies: {
      getAll: () => [],
      setAll: (toSet) => {
        cookies = toSet.map(({ name, value, options }) => ({ name, value, options }));
      },
    },
  });
  const { error: verifyError } = await client.auth.verifyOtp({
    type: 'magiclink',
    token_hash: data.properties.hashed_token,
  });
  if (verifyError) throw new Error(`Verifying the sign-in link failed: ${verifyError.message}`);
  if (!cookies.some((cookie) => cookie.value)) throw new Error('No session cookies were issued.');
  return cookies;
}

function serializeCookie({ name, value, options }: Cookie): string {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax'];
  const maxAge = options.maxAge;
  if (typeof maxAge === 'number') parts.push(`Max-Age=${maxAge}`);
  return parts.join('; ');
}

function serveOnce(cookies: Cookie[]): Promise<void> {
  const secret = randomBytes(24).toString('base64url');
  return new Promise((resolve, reject) => {
    let done = false;
    const finish = (res: ServerResponse | null) => {
      done = true;
      res?.on('finish', () => server.close());
      if (!res) server.close();
    };
    const server = createServer((req, res) => {
      if (done || req.method !== 'GET' || req.url !== `/${secret}`) {
        res.writeHead(404).end();
        return;
      }
      res.writeHead(302, {
        'Set-Cookie': cookies.map(serializeCookie),
        'Cache-Control': 'no-store',
        Location: ADMIN_URL,
      });
      res.end();
      console.log('handoff: session delivered, exiting');
      finish(res);
    });
    server.on('close', () => resolve());
    server.on('error', reject);
    server.listen(HANDOFF_PORT, 'localhost', () => {
      console.log(`handoff: open http://localhost:${HANDOFF_PORT}/${secret}`);
      console.log(`handoff: single use, expires in ${HANDOFF_TTL_MS / 1000}s`);
    });
    setTimeout(() => {
      if (!done) {
        console.log('handoff: expired unused');
        finish(null);
      }
    }, HANDOFF_TTL_MS).unref();
  });
}

async function main(): Promise<void> {
  refuseOutsideLocalDevelopment();
  const provision = process.argv.includes('--provision');
  // The browser client keys its cookie on NEXT_PUBLIC_SUPABASE_URL, so mint against the same URL.
  const url = requireEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL');
  const anonKey = requireEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY');
  const secretKey = requireEnv('SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY');
  const email = (process.env.ADMIN_DEV_AGENT_EMAIL?.trim() || DEFAULT_AGENT_EMAIL).toLowerCase();

  const admin = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const userId = await ensureObserver(admin, email, provision);

  // A delivered session outlives the handoff: it refreshes until the user is banned. `--revoke`
  // bans the agent user. The edge gate and route authorizer both call getUser(), which refuses a
  // banned user, so the console signs it out on the next request (observed 2026-10-29). A caller
  // that only checks the JWT signature would still accept it until expiry. The next mint unbans.
  const revoke = process.argv.includes('--revoke');
  const { error: banError } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: revoke ? '876000h' : 'none',
  });
  if (banError) throw new Error(`Updating the ban failed: ${banError.message}`);
  if (revoke) {
    console.log(`revoke: ${email} banned; existing sessions can no longer refresh`);
    return;
  }

  const cookies = await mintSessionCookies(url, anonKey, admin, email);
  console.log(`session: minted for ${email} (observer, read-only)`);
  await serveOnce(cookies);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

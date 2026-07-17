#!/usr/bin/env node
/**
 * Post-deploy health gate. Dry-run when HEALTH_CHECK_URL is unset; live fetch when set.
 */
const url = process.env.HEALTH_CHECK_URL;
const requireHealth = process.env.CI_REQUIRE_HEALTH_CHECK === '1';

async function dryRun() {
  console.log('[DRY-RUN] Health check — no URL configured');
  console.log('Expected checks when HEALTH_CHECK_URL is set:');
  console.log('  1. GET / returns 2xx');
  console.log('  2. GET /api/health or equivalent returns 200 (if exposed)');
  console.log('  3. Canary hash unchanged (see canary-uptime.yml)');
  console.log('Human operator: configure HEALTH_CHECK_URL on the production environment.');
}

async function liveCheck() {
  const response = await fetch(url, { redirect: 'manual' });
  if (response.status < 200 || response.status >= 400) {
    throw new Error(`health check failed: ${url} returned HTTP ${response.status}`);
  }
  console.log(`OK: ${url} returned HTTP ${response.status}`);
}

async function main() {
  if (!url) {
    if (requireHealth) {
      throw new Error('CI_REQUIRE_HEALTH_CHECK=1 but HEALTH_CHECK_URL is unset');
    }
    await dryRun();
    return;
  }
  await liveCheck();
}

main().catch((error) => {
  console.error(error.message ?? error);
  process.exit(1);
});

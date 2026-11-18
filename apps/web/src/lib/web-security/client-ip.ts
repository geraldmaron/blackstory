/**
 * The reader's IP for rate limits and campaign detection.
 *
 * blackstory.app sits behind Cloudflare, and Vercel overwrites `x-forwarded-for` with whatever
 * connected to it, which is a Cloudflare edge server shared by many readers. Cloudflare puts the
 * reader in `cf-connecting-ip`. That header is only trusted on the Cloudflare hostnames: the
 * origin lock (docs/security/cost-resource-controls.md, "Origin lock") denies requests to them
 * that skip Cloudflare, so nobody else can set it there. Other hosts (the vercel.app admin host,
 * localhost) keep `x-forwarded-for`, which Vercel sets itself.
 */
const CLOUDFLARE_HOSTS: ReadonlySet<string> = new Set(['blackstory.app', 'www.blackstory.app']);

export function clientIpFrom(request: Request): string | undefined {
  if (CLOUDFLARE_HOSTS.has(new URL(request.url).hostname)) {
    const viaCloudflare = request.headers.get('cf-connecting-ip')?.trim();
    if (viaCloudflare) return viaCloudflare;
  }
  const first = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return first || undefined;
}

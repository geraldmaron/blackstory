import zlib from 'node:zlib';
const base = process.argv[2],
  path = process.argv[3];
const gz = (b) => zlib.gzipSync(b, { level: 9 }).length;
const br = (b) => zlib.brotliCompressSync(b).length;
const kb = (n) => (n / 1024).toFixed(0).padStart(5) + ' KB';
async function get(url) {
  const r = await fetch(url, { headers: { 'accept-encoding': 'identity' } });
  return Buffer.from(await r.arrayBuffer());
}
const html = await get(base + path);
const text = html.toString('utf8');
const inlineCss = [...text.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map((m) =>
  Buffer.from(m[1]),
);
const inlineJs = [
  ...text.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/g),
].map((m) => Buffer.from(m[1]));
const srcs = [...text.matchAll(/<script[^>]*\bsrc="([^"]+)"/g)].map((m) => m[1]);
const sheets = [...text.matchAll(/<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)].map(
  (m) => m[1],
);
const preload = [...text.matchAll(/<link[^>]*href="([^"]+\.css[^"]*)"/g)]
  .map((m) => m[1])
  .filter((h) => !sheets.includes(h));
const abs = (u) => new URL(u, base + path).href;
const js = await Promise.all([...new Set(srcs)].map(async (u) => [u, await get(abs(u))]));
const css = await Promise.all(
  [...new Set([...sheets, ...preload])].map(async (u) => [u, await get(abs(u))]),
);
const sum = (arr) => arr.reduce((a, b) => a + b.length, 0);
const row = (label, bufs) => {
  const all = Buffer.concat(bufs);
  console.log(
    label.padEnd(26),
    kb(all.length),
    ' gz',
    kb(gz(all)),
    ' br',
    kb(br(all)),
    ` (${bufs.length})`,
  );
};
console.log(`== ${base}${path}`);
row('HTML document', [html]);
row('inline <style>', inlineCss.length ? inlineCss : [Buffer.alloc(0)]);
row('inline <script> (exec)', inlineJs.length ? inlineJs : [Buffer.alloc(0)]);
row(
  'external JS (listed in HTML)',
  js.map((x) => x[1]),
);
row('external CSS', css.length ? css.map((x) => x[1]) : [Buffer.alloc(0)]);
const first = [html, ...js.map((x) => x[1]), ...css.map((x) => x[1])];
const all = Buffer.concat(first);
console.log(
  'TOTAL first load'.padEnd(26),
  kb(all.length),
  ' gz',
  kb(first.reduce((a, b) => a + gz(b), 0)),
  ' br',
  kb(first.reduce((a, b) => a + br(b), 0)),
);
const times = [];
for (let i = 0; i < 15; i++) {
  const t = performance.now();
  const r = await fetch(base + path, { headers: { 'accept-encoding': 'identity' } });
  await r.body.getReader().read();
  times.push(performance.now() - t);
  await r.arrayBuffer().catch(() => {});
}
times.sort((a, b) => a - b);
console.log(
  `TTFB ms: median ${times[7].toFixed(1)}  p90 ${times[13].toFixed(1)}  min ${times[0].toFixed(1)}`,
);

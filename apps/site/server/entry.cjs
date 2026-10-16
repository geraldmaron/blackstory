/**
 * Own server entry. Wraps expo-server's supported Node http adapter so every HTML response gets a
 * per-request CSP nonce on all scripts, styles and preloads plus the matching header. No patch to
 * Expo's compiled output: SDK 58 renders the document as one chunk, so the buffered body is whole.
 * Later tasks put the maintenance gate, staff auth gate and crawler deny here (repo-doplj).
 */
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join, extname, normalize } = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/http');
const { makeNonce, addNonce, cspHeader } = require('./nonce.cjs');

const ROOT = process.env.SITE_ROOT ?? process.cwd();
const CLIENT = join(ROOT, 'dist/client');
const handler = createRequestHandler({ build: join(ROOT, 'dist/server') });
const TYPES = {
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
};

async function serveStatic(url, res) {
  const file = normalize(join(CLIENT, url.pathname));
  if (!file.startsWith(CLIENT)) return false;
  try {
    const body = await readFile(file);
    res.writeHead(200, {
      'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
      'cache-control': 'public, max-age=31536000, immutable',
    });
    res.end(body);
    return true;
  } catch {
    return false;
  }
}

function withNonce(req, res) {
  const nonce = makeNonce();
  const write = res.write.bind(res);
  const end = res.end.bind(res);
  const chunks = [];
  res.write = (chunk) => (chunks.push(Buffer.from(chunk)), true);
  res.end = (chunk) => {
    if (chunk) chunks.push(Buffer.from(chunk));
    let body = Buffer.concat(chunks);
    if (String(res.getHeader('content-type') ?? '').includes('text/html')) {
      body = Buffer.from(addNonce(body.toString('utf8'), nonce));
      res.setHeader('content-security-policy', cspHeader(nonce));
    }
    res.removeHeader('content-length');
    if (body.length) write(body);
    return end();
  };
  handler(req, res, (error) => {
    res.write = write;
    res.end = end;
    res.statusCode = error ? 500 : 404;
    if (error) console.error(error);
    res.end(error ? 'Internal Server Error' : 'Not Found');
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost');
  if (url.pathname.startsWith('/_expo/static/') && (await serveStatic(url, res))) return;
  withNonce(req, res);
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3060);
  server.listen(port, () => console.log(`site listening on ${port}`));
}

module.exports = { server };

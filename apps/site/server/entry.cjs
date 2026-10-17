/**
 * Own server entry: the replacement for apps/web/src/proxy.ts. Runs the edge pipeline
 * (maintenance wall, crawler deny, staff gate; edge/pipeline.cjs), then wraps expo-server's supported
 * Node http adapter so every HTML response gets a per-request CSP nonce on all scripts, styles and
 * preloads, the global security headers, and the CDN cache header for public documents. No patch to
 * Expo's compiled output: SDK 58 renders the document as one chunk, so the buffered body is whole.
 * Not yet ported: query normalization and the request-size limit (repo-doplj follow-up).
 */
const { createServer } = require('node:http');
const { readFile } = require('node:fs/promises');
const { join, extname, normalize } = require('node:path');
const { createRequestHandler } = require('expo-server/adapter/http');
const { makeNonce, addNonce } = require('./nonce.cjs');
const { readRequestFacts, runEdge, decorate } = require('./edge/pipeline.cjs');

const ROOT = process.env.SITE_ROOT ?? process.cwd();
const MAX_HTML_BYTES = 16 * 1024 * 1024;
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

/** Clear framing a half-built response may have set, then apply the security headers. */
function finishWithText(res, status, text, securityHeaders) {
  if (res.headersSent) return res.destroy();
  for (const name of [
    'content-length',
    'content-encoding',
    'transfer-encoding',
    'etag',
    'cache-control',
  ])
    res.removeHeader(name);
  res.setHeader('content-type', 'text/plain; charset=utf-8');
  res.setHeader('cache-control', 'private, no-store');
  for (const { key, value } of securityHeaders ?? []) res.setHeader(key, value);
  res.statusCode = status;
  res.end(text);
}

function sendEdgeResponse(res, edge, securityHeaders) {
  const { status, headers, body, setCookies } = edge;
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  for (const { key, value } of securityHeaders) res.setHeader(key, value);
  if (setCookies?.length) res.setHeader('set-cookie', setCookies);
  res.statusCode = status;
  res.end(body ?? '');
}

/** Headers every rendered response gets, applied just before the first byte leaves. */
function applyResponseHeaders(res, { facts, securityHeaders, setCookies }) {
  for (const { key, value } of securityHeaders) res.setHeader(key, value);
  for (const [key, value] of Object.entries(decorate(facts, res.statusCode)))
    res.setHeader(key, value);
  if (setCookies.length) {
    const existing = res.getHeader('set-cookie');
    res.setHeader('set-cookie', [
      ...(Array.isArray(existing) ? existing : existing ? [String(existing)] : []),
      ...setCookies,
    ]);
  }
}

/**
 * Renders through Expo. HTML is buffered so the nonce can be added to the finished document (up to
 * MAX_HTML_BYTES); anything else streams through untouched once its headers are fixed, so a long
 * response is never held in memory.
 */
function renderApp(req, res, context) {
  const write = res.write.bind(res);
  const end = res.end.bind(res);
  let mode = null; // 'html' | 'stream', decided at the first byte
  let size = 0;
  let failed = false;
  const chunks = [];

  const restore = () => {
    res.write = write;
    res.end = end;
  };
  const decide = () => {
    if (mode) return;
    mode = String(res.getHeader('content-type') ?? '').includes('text/html') ? 'html' : 'stream';
    if (mode === 'stream') applyResponseHeaders(res, context);
  };

  res.write = (chunk, ...rest) => {
    decide();
    if (mode === 'stream') return write(chunk, ...rest);
    if (failed) return true;
    size += Buffer.byteLength(chunk);
    if (size > MAX_HTML_BYTES) {
      failed = true;
      chunks.length = 0;
      return true;
    }
    chunks.push(Buffer.from(chunk));
    return true;
  };
  res.end = (chunk, ...rest) => {
    decide();
    if (mode === 'stream') {
      restore();
      return chunk ? end(chunk, ...rest) : end();
    }
    if (chunk && !failed) {
      size += Buffer.byteLength(chunk);
      if (size > MAX_HTML_BYTES) failed = true;
      else chunks.push(Buffer.from(chunk));
    }
    restore();
    if (failed) return finishWithText(res, 500, 'Internal Server Error', context.securityHeaders);
    const body = Buffer.from(addNonce(Buffer.concat(chunks).toString('utf8'), context.nonce));
    applyResponseHeaders(res, context);
    res.removeHeader('content-length');
    if (body.length) write(body);
    return end();
  };
  handler(req, res, (error) => {
    restore();
    if (error) console.error(error);
    finishWithText(
      res,
      error ? 500 : 404,
      error ? 'Internal Server Error' : 'Not Found',
      context.securityHeaders,
    );
  });
}

async function handle(req, res) {
  const facts = readRequestFacts(req);
  if (!facts.ok) {
    res.statusCode = 400;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    return res.end('Bad Request');
  }
  const nonce = makeNonce();
  let edge;
  try {
    edge = await runEdge(facts, { nonce });
  } catch (error) {
    // A gate that throws must fail closed, never fall through to the app.
    console.error(error);
    return finishWithText(res, 500, 'Internal Server Error', []);
  }
  if (edge.response) return sendEdgeResponse(res, edge.response, edge.securityHeaders);
  renderApp(req, res, {
    facts,
    nonce,
    securityHeaders: edge.securityHeaders,
    setCookies: edge.setCookies,
  });
}

const server = createServer((req, res) => {
  const run = async () => {
    const url = new URL(`http://localhost${req.url?.startsWith('/') ? req.url : '/'}`);
    // Build output is public and immutable; like Next's /_next/static it skips the gates.
    if (url.pathname.startsWith('/_expo/static/') && (await serveStatic(url, res))) return;
    await handle(req, res);
  };
  run().catch((error) => {
    console.error(error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.end('Internal Server Error');
    } else {
      res.destroy();
    }
  });
});

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3060);
  server.listen(port, () => console.log(`site listening on ${port}`));
}

module.exports = { server };

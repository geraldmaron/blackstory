"""Post-export patch of dist/server/_expo/server/render.js: give React's renderer a per-request nonce.

Expo getStreamingContent calls renderToReadableStream({progressiveChunkSize, bootstrapScriptContent,
signal, onError}) with no `nonce`, so React's own inline scripts (bootstrap + streaming runtime) carry
none. This adds `nonce` from an AsyncLocalStorage the same request's +html.tsx also reads.
"""
import re, sys
p = sys.argv[1]
s = open(p).read()
head = ("globalThis.__bsNonceStore ??= new (globalThis.process.getBuiltinModule('node:async_hooks').AsyncLocalStorage)();\n")
fn = "e.getStreamingContent=async function(t,n){"
assert s.count(fn) == 1, 'getStreamingContent anchor'
s = s.replace(fn, fn + "globalThis.__bsNonceStore.enterWith(btoa(crypto.randomUUID()));")
opt = "{progressiveChunkSize:25600,bootstrapScriptContent:"
assert s.count(opt) == 1, 'options anchor'
s = s.replace(opt, "{nonce:globalThis.__bsNonceStore.getStore(),progressiveChunkSize:25600,bootstrapScriptContent:")
open(p, 'w').write(head + s)
print('patched', p)

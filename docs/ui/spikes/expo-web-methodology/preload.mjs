// Node preload: lets apps/web's data loaders run outside Next by stubbing `next/cache`.
import { registerHooks } from 'node:module';

const stub = new URL('./next-cache-stub.mjs', import.meta.url).href;
registerHooks({
  resolve(spec, ctx, next) {
    if (spec === 'next/cache') return { url: stub, shortCircuit: true };
    return next(spec, ctx);
  },
});

# Gate 1 spike: Expo web + Tamagui, `/methodology` slice

Throwaway, not part of the workspace (no pnpm entry, not built by CI). Reproduce:

```bash
cd docs/ui/spikes/expo-web-methodology
npm install
CI=1 npx expo export --platform web
npx expo serve --port 8101   # then curl -i http://localhost:8101/methodology
```

`src/app/+middleware.ts` holds the hash-based CSP that hydrated. The per-request-nonce variant
that blocked hydration is described in section 10 of `../../expo-tamagui-migration-plan.md`.
Results were observed on 2026-10-16 with Expo SDK 57 and Tamagui 2.7.7.

# Mobile release gates

The question these answer is "may this commit go to a store", which is not the question
`ci.yml`'s **Mobile Checks** answers on every pull request. They run on a deliberate dispatch.

The rule the whole thing is built around: **config alone is not evidence.** Every machine gate
reads what `expo prebuild` generated, what Gradle actually reported, and what `aapt2` found in a
built artifact. `apps/mobile/app.config.ts` is used only as the declared intent those artifacts
are compared against.

## Running it locally

Collection needs macOS, Xcode, a JDK and the Android SDK. Evaluation needs none of them.

```bash
APP_VARIANT=production npx expo prebuild --platform ios --no-install --clean
node scripts/release/mobile-release-gate.mjs collect \
  --variant production --collected-by "$(git config user.email)"
node scripts/release/mobile-release-gate.mjs evaluate \
  --evidence artifacts/mobile-release/evidence.json \
  --evaluator "$(git config user.email)" \
  --attestations docs/mobile/release/release-attestations.json
```

`collect` runs Gradle itself when `JAVA_HOME` and `ANDROID_HOME` are set. On this machine the
JDK is a keg-only Homebrew install that `java_home` cannot see:

```bash
JAVA_HOME=/opt/homebrew/opt/openjdk@17 ANDROID_HOME="$HOME/Library/Android/sdk" \
  node scripts/release/mobile-release-gate.mjs collect --variant production --collected-by you
```

To skip a Gradle run you have already done, hand over its output instead:
`--gradle-output <file> --aapt-output <file> --apk <path>`. That is exactly how CI moves the
Android facts from the Linux runner to the macOS one without shipping a 167MB APK.

### Performance baseline (report-only)

Wave 9 (owner decision, 2026-09-14): collect a mobile performance baseline for the first release,
with NO threshold — the program has no prior number to hold this release to, and the "before"
half of before/after is unrecoverable for changes already landed. Every sample is labeled
`simulator` or `emulator`; none is ever a physical-device number.

```bash
node scripts/release/mobile-perf-baseline.mjs --platform ios --runs 5 \
  --bundle-id app.blackstory.mobile.preview \
  --out artifacts/mobile-release/performance-ios.json
node scripts/release/mobile-perf-baseline.mjs --platform android --runs 5 \
  --package app.blackstory.mobile.preview \
  --out artifacts/mobile-release/performance-android.json

node scripts/release/mobile-release-gate.mjs collect \
  --variant production --collected-by "$(git config user.email)" \
  --performance artifacts/mobile-release/performance-ios.json \
  --performance artifacts/mobile-release/performance-android.json
```

Requires a booted Simulator or a running Emulator with the target build already installed; the
harness does not boot a device or build the app. See `scripts/release/lib/mobile-perf-parsers.mjs`
for the pure output parsers (`am start -W`, `dumpsys meminfo`, `dumpsys gfxinfo`, and the in-app
`BLACKSTORY_PERF` log line emitted by `apps/mobile/src/lib/perf-marks.ts`) and
`scripts/release/mobile-perf-baseline.test.mjs` for their tests. Metrics the harness cannot
measure honestly (iOS Simulator frame jank, image-decode timing, tablet split, payload/cache — see
the script's own comments for why each one) are listed in the output's `unmeasured` array with a
reason, never omitted or faked.

## In CI

`.github/workflows/mobile-release-gates.yml`, `workflow_dispatch` only. The Linux job prebuilds
Android, runs `:app:properties`, builds `assembleRelease` and dumps badging; the macOS job
prebuilds iOS, collects, evaluates, and fails on NO_GO. The decision lands in the job summary and
as a 90-day artifact.

## What the gates are

Ten machine gates, answered from the evidence bundle: build provenance, iOS bundle identity, iOS
OS floor and device family, iOS store compliance, associated domains, OTA runtime version, OTA
channel and environment, OTA code signing, Android target SDK, and the performance baseline
above. Unlike the other nine, the performance gate never compares a value to a threshold — it
only checks that a baseline was collected and every named metric is accounted for.

Four human gates, which fail closed until attested: E2E on the release build, accessibility
evidence, rollback rehearsed, store and signing identity. Fill in
[`release-attestations.json`](release-attestations.json) — it carries what was measured and what
nobody has measured, so a signature is grounded in something.

Two things are expected to be red today and are in the inventory on purpose rather than omitted:
OTA code signing (repo-3en3s, optional because the store account checklist accepts that risk on
the EAS free tier, but reported on every release) and store and signing identity (repo-arlr,
repo-1etxc). A gate that is missing because it would be red reads, later, like one nobody thought
of.

## Why collection and judgement are split

The generated native trees are gitignored and need a build host to exist at all. Keeping the
judgement pure — evidence in, GO or NO_GO out — is what lets the whole gate be unit tested from
fixtures on a machine with no Xcode. A gate whose logic can only be exercised on a build host is
a gate nobody tests. See `packages/testing/src/release-gates/mobile/`.

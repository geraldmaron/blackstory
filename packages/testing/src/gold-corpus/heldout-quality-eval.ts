/** Metrics and integrity checks for blind, categorical identity and relationship-edge cases. */
import { createHash } from 'node:crypto';

type SourceExcerpt = {
  readonly id: string;
  readonly sourceUrl: string;
  readonly selector: string;
  readonly excerpt: string;
};

type Mention = { readonly name: string; readonly sourceExcerptId: string };

export type HeldoutQualityCases = {
  readonly schemaVersion: 'heldout-identity-edge-corpus.v1';
  readonly version: string;
  readonly retrievedAt: string;
  readonly protocol: string;
  readonly sourceExcerpts: readonly SourceExcerpt[];
  readonly identityCases: readonly {
    readonly id: string;
    readonly left: Mention;
    readonly right: Mention;
  }[];
  readonly edgeCases: readonly {
    readonly id: string;
    readonly subject: string;
    readonly predicate: string;
    readonly object: string;
    readonly sourceExcerptIds: readonly string[];
  }[];
};

export type HeldoutQualityPredictions = {
  readonly schemaVersion: 'heldout-identity-edge-predictions.v1';
  readonly benchmarkVersion: string;
  readonly predictor: string;
  readonly generatedAt: string;
  readonly identityPredictions: readonly {
    readonly id: string;
    readonly decision: 'merge' | 'distinct';
  }[];
  readonly edgePredictions: readonly {
    readonly id: string;
    readonly decision: 'assert' | 'withhold';
  }[];
};

export type HeldoutQualityGold = {
  readonly schemaVersion: 'heldout-identity-edge-gold.v1';
  readonly benchmarkVersion: string;
  readonly labelStatus: string;
  readonly adjudicationProtocol: string;
  readonly limitations: readonly string[];
  readonly identityCases: readonly {
    readonly id: string;
    readonly expected: 'same' | 'distinct';
    readonly rationale: string;
  }[];
  readonly edgeCases: readonly {
    readonly id: string;
    readonly expected: 'supported' | 'unsupported';
    readonly rationale: string;
  }[];
};

export type HeldoutQualityFreezeManifest = {
  readonly schemaVersion: 'heldout-identity-edge-freeze.v1';
  readonly benchmarkVersion: string;
  readonly recordedAt: string;
  readonly bindingStatus: 'posthoc-integrity-record';
  readonly originalBlindFileByteSha256: string;
  readonly currentBlindFileByteSha256: string;
  readonly blindCanonicalJsonSha256: string;
  readonly frozenPredictionsFileByteSha256: string;
  readonly independentGoldFileByteSha256: string;
  readonly limitation: string;
};

const TOKEN = /^[a-z][a-z0-9_-]*$/u;
const SHA256 = /^[a-f0-9]{64}$/u;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly: ${expected.join(', ')}`);
  }
}

function text(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} must be nonempty text`);
  return value;
}

function token(value: unknown, label: string): string {
  const result = text(value, label);
  if (!TOKEN.test(result)) throw new Error(`${label} must use a stable lowercase token`);
  return result;
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (Number.isNaN(Date.parse(result))) throw new Error(`${label} must be a valid timestamp`);
  return result;
}

function array(value: unknown, label: string): readonly unknown[] {
  if (!Array.isArray(value) || value.length === 0)
    throw new Error(`${label} array must be nonempty`);
  return value;
}

function uniqueIds(values: readonly { readonly id: string }[], label: string): void {
  if (new Set(values.map(({ id }) => id)).size !== values.length) {
    throw new Error(`${label} identifiers must be distinct`);
  }
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new Error(`${label} must use the categorical contract vocabulary`);
  }
  return value as T;
}

export function parseHeldoutQualityCases(value: unknown): HeldoutQualityCases {
  const root = record(value, 'Held-out blind cases');
  exactKeys(
    root,
    [
      'schemaVersion',
      'version',
      'retrievedAt',
      'protocol',
      'sourceExcerpts',
      'identityCases',
      'edgeCases',
    ],
    'Held-out blind cases',
  );
  if (root.schemaVersion !== 'heldout-identity-edge-corpus.v1') {
    throw new Error('Held-out blind cases use an unknown schemaVersion');
  }
  const sourceExcerpts = array(root.sourceExcerpts, 'Source excerpts').map((item, index) => {
    const source = record(item, `Source excerpt ${index}`);
    exactKeys(source, ['id', 'sourceUrl', 'selector', 'excerpt'], `Source excerpt ${index}`);
    const sourceUrl = text(source.sourceUrl, `Source excerpt ${index} sourceUrl`);
    const parsedUrl = new URL(sourceUrl);
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new Error(`Source excerpt ${index} sourceUrl must use HTTP(S)`);
    }
    return {
      id: token(source.id, `Source excerpt ${index} id`),
      sourceUrl,
      selector: text(source.selector, `Source excerpt ${index} selector`),
      excerpt: text(source.excerpt, `Source excerpt ${index} excerpt`),
    };
  });
  uniqueIds(sourceExcerpts, 'Source excerpt');
  const sourceIds = new Set(sourceExcerpts.map(({ id }) => id));
  const mention = (value: unknown, label: string): Mention => {
    const item = record(value, label);
    exactKeys(item, ['name', 'sourceExcerptId'], label);
    const sourceExcerptId = token(item.sourceExcerptId, `${label} sourceExcerptId`);
    if (!sourceIds.has(sourceExcerptId)) throw new Error(`${label} references an unknown excerpt`);
    return { name: text(item.name, `${label} name`), sourceExcerptId };
  };
  const identityCases = array(root.identityCases, 'Blind identity cases').map((value, index) => {
    const item = record(value, `Blind identity case ${index}`);
    exactKeys(item, ['id', 'left', 'right'], `Blind identity case ${index}`);
    return {
      id: token(item.id, `Blind identity case ${index} id`),
      left: mention(item.left, `Blind identity case ${index} left`),
      right: mention(item.right, `Blind identity case ${index} right`),
    };
  });
  uniqueIds(identityCases, 'Blind identity case');
  const edgeCases = array(root.edgeCases, 'Blind edge cases').map((value, index) => {
    const item = record(value, `Blind edge case ${index}`);
    exactKeys(
      item,
      ['id', 'subject', 'predicate', 'object', 'sourceExcerptIds'],
      `Blind edge case ${index}`,
    );
    const sourceExcerptIds = array(
      item.sourceExcerptIds,
      `Blind edge case ${index} sourceExcerptIds`,
    ).map((id, sourceIndex) => token(id, `Blind edge case ${index} source ${sourceIndex}`));
    if (
      new Set(sourceExcerptIds).size !== sourceExcerptIds.length ||
      sourceExcerptIds.some((id) => !sourceIds.has(id))
    ) {
      throw new Error(`Blind edge case ${index} requires distinct known source excerpts`);
    }
    return {
      id: token(item.id, `Blind edge case ${index} id`),
      subject: text(item.subject, `Blind edge case ${index} subject`),
      predicate: text(item.predicate, `Blind edge case ${index} predicate`),
      object: text(item.object, `Blind edge case ${index} object`),
      sourceExcerptIds,
    };
  });
  uniqueIds(edgeCases, 'Blind edge case');
  return {
    schemaVersion: root.schemaVersion,
    version: text(root.version, 'Held-out benchmark version'),
    retrievedAt: timestamp(root.retrievedAt, 'Held-out retrieval time'),
    protocol: text(root.protocol, 'Held-out protocol'),
    sourceExcerpts,
    identityCases,
    edgeCases,
  };
}

export function parseHeldoutQualityPredictions(value: unknown): HeldoutQualityPredictions {
  const root = record(value, 'Held-out predictions');
  exactKeys(
    root,
    [
      'schemaVersion',
      'benchmarkVersion',
      'predictor',
      'generatedAt',
      'identityPredictions',
      'edgePredictions',
    ],
    'Held-out predictions',
  );
  if (root.schemaVersion !== 'heldout-identity-edge-predictions.v1') {
    throw new Error('Held-out predictions use an unknown schemaVersion');
  }
  const identityPredictions = array(root.identityPredictions, 'Identity predictions').map(
    (value, index) => {
      const item = record(value, `Identity prediction ${index}`);
      exactKeys(item, ['id', 'decision'], `Identity prediction ${index}`);
      return {
        id: token(item.id, `Identity prediction ${index} id`),
        decision: oneOf(item.decision, ['merge', 'distinct'] as const, 'Identity decision'),
      };
    },
  );
  uniqueIds(identityPredictions, 'Identity prediction');
  const edgePredictions = array(root.edgePredictions, 'Edge predictions').map((value, index) => {
    const item = record(value, `Edge prediction ${index}`);
    exactKeys(item, ['id', 'decision'], `Edge prediction ${index}`);
    return {
      id: token(item.id, `Edge prediction ${index} id`),
      decision: oneOf(item.decision, ['assert', 'withhold'] as const, 'Edge decision'),
    };
  });
  uniqueIds(edgePredictions, 'Edge prediction');
  return {
    schemaVersion: root.schemaVersion,
    benchmarkVersion: text(root.benchmarkVersion, 'Prediction benchmarkVersion'),
    predictor: text(root.predictor, 'Prediction predictor'),
    generatedAt: timestamp(root.generatedAt, 'Prediction generatedAt'),
    identityPredictions,
    edgePredictions,
  };
}

export function parseHeldoutQualityGold(value: unknown): HeldoutQualityGold {
  const root = record(value, 'Held-out gold');
  exactKeys(
    root,
    [
      'schemaVersion',
      'benchmarkVersion',
      'labelStatus',
      'adjudicationProtocol',
      'identityCases',
      'edgeCases',
      'limitations',
    ],
    'Held-out gold',
  );
  if (root.schemaVersion !== 'heldout-identity-edge-gold.v1') {
    throw new Error('Held-out gold uses an unknown schemaVersion');
  }
  const identityCases = array(root.identityCases, 'Identity gold cases').map((value, index) => {
    const item = record(value, `Identity gold case ${index}`);
    exactKeys(item, ['id', 'expected', 'rationale'], `Identity gold case ${index}`);
    return {
      id: token(item.id, `Identity gold case ${index} id`),
      expected: oneOf(item.expected, ['same', 'distinct'] as const, 'Identity gold label'),
      rationale: text(item.rationale, `Identity gold case ${index} rationale`),
    };
  });
  uniqueIds(identityCases, 'Identity gold case');
  const edgeCases = array(root.edgeCases, 'Edge gold cases').map((value, index) => {
    const item = record(value, `Edge gold case ${index}`);
    exactKeys(item, ['id', 'expected', 'rationale'], `Edge gold case ${index}`);
    return {
      id: token(item.id, `Edge gold case ${index} id`),
      expected: oneOf(item.expected, ['supported', 'unsupported'] as const, 'Edge gold label'),
      rationale: text(item.rationale, `Edge gold case ${index} rationale`),
    };
  });
  uniqueIds(edgeCases, 'Edge gold case');
  const limitations = array(root.limitations, 'Gold limitations').map((item, index) =>
    text(item, `Gold limitation ${index}`),
  );
  return {
    schemaVersion: root.schemaVersion,
    benchmarkVersion: text(root.benchmarkVersion, 'Gold benchmarkVersion'),
    labelStatus: text(root.labelStatus, 'Gold labelStatus'),
    adjudicationProtocol: text(root.adjudicationProtocol, 'Gold adjudicationProtocol'),
    identityCases,
    edgeCases,
    limitations,
  };
}

function parseFreezeManifest(value: unknown): HeldoutQualityFreezeManifest {
  const root = record(value, 'Held-out freeze manifest');
  exactKeys(
    root,
    [
      'schemaVersion',
      'benchmarkVersion',
      'recordedAt',
      'bindingStatus',
      'originalBlindFileByteSha256',
      'currentBlindFileByteSha256',
      'blindCanonicalJsonSha256',
      'frozenPredictionsFileByteSha256',
      'independentGoldFileByteSha256',
      'limitation',
    ],
    'Held-out freeze manifest',
  );
  if (
    root.schemaVersion !== 'heldout-identity-edge-freeze.v1' ||
    root.bindingStatus !== 'posthoc-integrity-record'
  ) {
    throw new Error('Held-out freeze manifest uses an unknown contract');
  }
  const digest = (key: string): string => {
    const result = text(root[key], `Freeze manifest ${key}`);
    if (!SHA256.test(result)) throw new Error(`Freeze manifest ${key} must be SHA-256`);
    return result;
  };
  return {
    schemaVersion: root.schemaVersion,
    benchmarkVersion: text(root.benchmarkVersion, 'Freeze manifest benchmarkVersion'),
    recordedAt: timestamp(root.recordedAt, 'Freeze manifest recordedAt'),
    bindingStatus: root.bindingStatus,
    originalBlindFileByteSha256: digest('originalBlindFileByteSha256'),
    currentBlindFileByteSha256: digest('currentBlindFileByteSha256'),
    blindCanonicalJsonSha256: digest('blindCanonicalJsonSha256'),
    frozenPredictionsFileByteSha256: digest('frozenPredictionsFileByteSha256'),
    independentGoldFileByteSha256: digest('independentGoldFileByteSha256'),
    limitation: text(root.limitation, 'Freeze manifest limitation'),
  };
}

function digest(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function parseJson(raw: string, label: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${label} must be valid JSON`);
  }
}

/** Strictly parses and binds the three artifacts to their post-hoc integrity record. */
export function verifyHeldoutQualityArtifacts(input: {
  readonly casesRaw: string;
  readonly predictionsRaw: string;
  readonly goldRaw: string;
  readonly manifest: unknown;
}): {
  readonly cases: HeldoutQualityCases;
  readonly predictions: HeldoutQualityPredictions;
  readonly gold: HeldoutQualityGold;
  readonly integrity: HeldoutQualityFreezeManifest;
} {
  const casesValue = parseJson(input.casesRaw, 'Held-out blind cases');
  const predictionsValue = parseJson(input.predictionsRaw, 'Held-out predictions');
  const goldValue = parseJson(input.goldRaw, 'Held-out gold');
  const cases = parseHeldoutQualityCases(casesValue);
  const predictions = parseHeldoutQualityPredictions(predictionsValue);
  const gold = parseHeldoutQualityGold(goldValue);
  const manifest = parseFreezeManifest(input.manifest);
  if (
    manifest.benchmarkVersion !== cases.version ||
    predictions.benchmarkVersion !== cases.version ||
    gold.benchmarkVersion !== cases.version
  ) {
    throw new Error('Held-out artifacts and freeze manifest must identify one benchmark');
  }
  const actual = {
    currentBlindFileByteSha256: digest(input.casesRaw),
    blindCanonicalJsonSha256: digest(JSON.stringify(casesValue)),
    frozenPredictionsFileByteSha256: digest(input.predictionsRaw),
    independentGoldFileByteSha256: digest(input.goldRaw),
  };
  for (const [key, value] of Object.entries(actual)) {
    if (manifest[key as keyof typeof actual] !== value) {
      throw new Error(`Held-out artifact integrity mismatch for ${key}`);
    }
  }
  return { cases, predictions, gold, integrity: manifest };
}

function indexed<T extends { readonly id: string }>(values: readonly T[]): ReadonlyMap<string, T> {
  return new Map(values.map((value) => [value.id, value]));
}

function assertAligned(
  expectedIds: ReadonlySet<string>,
  actualIds: ReadonlySet<string>,
  label: string,
): void {
  if (expectedIds.size !== actualIds.size || [...expectedIds].some((id) => !actualIds.has(id))) {
    throw new Error(`${label} identifiers must match the blind cases exactly`);
  }
}

/**
 * Evaluates frozen categorical outcomes only. No prediction probability enters this contract,
 * so the returned calibration status is an explicit abstention rather than a synthetic score.
 */
export function evaluateHeldoutIdentityAndEdges(input: {
  readonly cases: unknown;
  readonly predictions: unknown;
  readonly gold: unknown;
}): Record<string, unknown> {
  const cases = parseHeldoutQualityCases(input.cases);
  const predictions = parseHeldoutQualityPredictions(input.predictions);
  const gold = parseHeldoutQualityGold(input.gold);
  if (predictions.benchmarkVersion !== cases.version || gold.benchmarkVersion !== cases.version) {
    throw new Error('Held-out quality cases, predictions, and gold must identify one benchmark');
  }

  const identityCases = indexed(cases.identityCases);
  const identityPredictions = indexed(predictions.identityPredictions);
  const identityGold = indexed(gold.identityCases);
  assertAligned(new Set(identityCases.keys()), new Set(identityPredictions.keys()), 'Prediction');
  assertAligned(new Set(identityCases.keys()), new Set(identityGold.keys()), 'Gold identity');

  const edgeCases = indexed(cases.edgeCases);
  const edgePredictions = indexed(predictions.edgePredictions);
  const edgeGold = indexed(gold.edgeCases);
  assertAligned(new Set(edgeCases.keys()), new Set(edgePredictions.keys()), 'Prediction edge');
  assertAligned(new Set(edgeCases.keys()), new Set(edgeGold.keys()), 'Gold edge');

  let identityCorrect = 0;
  let distinctCases = 0;
  let predictedMerges = 0;
  let falseMerges = 0;
  let missedMerges = 0;
  const identityPerCase = [...identityCases.keys()].map((id) => {
    const predicted = identityPredictions.get(id)!.decision;
    const expected = identityGold.get(id)!.expected;
    const correct =
      (predicted === 'merge' && expected === 'same') ||
      (predicted === 'distinct' && expected === 'distinct');
    if (correct) identityCorrect += 1;
    if (expected === 'distinct') distinctCases += 1;
    if (predicted === 'merge') predictedMerges += 1;
    if (predicted === 'merge' && expected === 'distinct') falseMerges += 1;
    if (predicted === 'distinct' && expected === 'same') missedMerges += 1;
    return { id, predicted, expected, correct };
  });

  let edgeCorrect = 0;
  let unsupportedCases = 0;
  let assertedEdges = 0;
  let unsupportedAssertions = 0;
  let missedSupportedEdges = 0;
  const edgePerCase = [...edgeCases.keys()].map((id) => {
    const predicted = edgePredictions.get(id)!.decision;
    const expected = edgeGold.get(id)!.expected;
    const correct =
      (predicted === 'assert' && expected === 'supported') ||
      (predicted === 'withhold' && expected === 'unsupported');
    if (correct) edgeCorrect += 1;
    if (expected === 'unsupported') unsupportedCases += 1;
    if (predicted === 'assert') assertedEdges += 1;
    if (predicted === 'assert' && expected === 'unsupported') unsupportedAssertions += 1;
    if (predicted === 'withhold' && expected === 'supported') missedSupportedEdges += 1;
    return { id, predicted, expected, correct };
  });

  return {
    predictor: predictions.predictor,
    generatedAt: predictions.generatedAt,
    labelStatus: gold.labelStatus,
    limitations: gold.limitations,
    identity: {
      caseCount: identityCases.size,
      distinctCaseCount: distinctCases,
      predictedMergeCount: predictedMerges,
      accuracy: identityCorrect / identityCases.size,
      falseMergeCount: falseMerges,
      falseMergeRate: distinctCases === 0 ? null : falseMerges / distinctCases,
      falseMergeCoverage: distinctCases === 0 ? 'unavailable_no_distinct_cases' : 'available',
      missedMergeCount: missedMerges,
      perCase: identityPerCase,
    },
    edges: {
      caseCount: edgeCases.size,
      unsupportedCaseCount: unsupportedCases,
      assertedEdgeCount: assertedEdges,
      accuracy: edgeCorrect / edgeCases.size,
      unsupportedAssertionCount: unsupportedAssertions,
      unsupportedEdgeRate: unsupportedCases === 0 ? null : unsupportedAssertions / unsupportedCases,
      unsupportedEdgeCoverage:
        unsupportedCases === 0 ? 'unavailable_no_unsupported_cases' : 'available',
      assertedEdgeFalseDiscoveryRate:
        assertedEdges === 0 ? null : unsupportedAssertions / assertedEdges,
      assertedEdgeFalseDiscoveryCoverage:
        assertedEdges === 0 ? 'unavailable_no_asserted_edges' : 'available',
      missedSupportedEdgeCount: missedSupportedEdges,
      perCase: edgePerCase,
    },
    probabilityCalibration: {
      status: 'unavailable',
      probabilityClaimSupported: false,
      reason: 'The frozen predictor emitted categorical decisions and no probabilities.',
    },
  };
}

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const csvPath = path.join(root, 'docs/content-moderation/evaluation-corpus.csv');
const outputPath = path.join(root, 'docs/content-moderation/self-trained-baseline-evaluation.json');
const modelPath = path.join(root, 'docs/content-moderation/self-trained-model-artifact.json');
const RANDOM_SEED = 1729;
const HOLDOUT_FRACTION = 0.25;
const MINIMUM_PRECISION = 0.8;
const FEATURE_LIMIT = 5000;

function parseCsv(input) {
  const records = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') { row.push(cell); cell = ''; }
    else if (char === '\n') { row.push(cell.replace(/\r$/u, '')); records.push(row); row = []; cell = ''; }
    else cell += char;
  }
  if (cell || row.length) { row.push(cell.replace(/\r$/u, '')); records.push(row); }
  const [headers, ...data] = records;
  return data.filter((cells) => cells.length === headers.length).map((cells) => Object.fromEntries(headers.map((header, index) => [header, cells[index]])));
}

function extractText(node, parts = []) {
  if (node == null) return parts;
  if (typeof node === 'string') { parts.push(node); return parts; }
  if (Array.isArray(node)) { for (const child of node) extractText(child, parts); return parts; }
  if (typeof node !== 'object') return parts;
  if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text);
  else if (node.type === 'hardBreak') parts.push(' ');
  if (node.content) extractText(node.content, parts);
  return parts;
}

function buildDocument(row) {
  return `${row.title || ''} ${row.title || ''} ${row.story_text || ''}`.replace(/\s+/gu, ' ').trim();
}

function tokens(text) {
  const normalized = text.normalize('NFKC').toLocaleLowerCase('en-US');
  const words = normalized.match(/[\p{L}\p{N}]+/gu) || [];
  const features = new Map();
  for (let i = 0; i < words.length; i += 1) {
    const word = words[i];
    features.set(`w:${word}`, (features.get(`w:${word}`) || 0) + 1);
    if (i > 0) {
      const bigram = `w:${words[i - 1]}_${word}`;
      features.set(bigram, (features.get(bigram) || 0) + 1);
    }
  }
  const compact = normalized.replace(/\s+/gu, ' ');
  const padded = `  ${compact}  `;
  for (let n = 3; n <= 5; n += 1) {
    for (let i = 0; i <= padded.length - n; i += 1) {
      const gram = `c:${padded.slice(i, i + n)}`;
      features.set(gram, (features.get(gram) || 0) + 1);
    }
  }
  return features;
}

function fitVectorizer(rows) {
  const docs = rows.map((row) => tokens(buildDocument(row)));
  const df = new Map();
  for (const doc of docs) for (const feature of doc.keys()) df.set(feature, (df.get(feature) || 0) + 1);
  const vocabulary = [...df.entries()]
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, FEATURE_LIMIT)
    .map(([feature]) => feature)
    .sort();
  const indexes = new Map(vocabulary.map((feature, index) => [feature, index]));
  const idf = vocabulary.map((feature) => Math.log((1 + docs.length) / (1 + df.get(feature))) + 1);
  const vectors = docs.map((doc) => {
    const vector = [];
    let norm = 0;
    for (const [feature, count] of doc) {
      const index = indexes.get(feature);
      if (index === undefined) continue;
      const value = (1 + Math.log(count)) * idf[index];
      vector.push([index, value]);
      norm += value * value;
    }
    const scale = norm ? 1 / Math.sqrt(norm) : 1;
    return vector.map(([index, value]) => [index, value * scale]);
  });
  return { vocabulary, idf, vectors };
}

function vectorizeOne(title, body, model) {
  const map = tokens(`${title || ''} ${title || ''} ${body || ''}`);
  const index = new Map(model.vocabulary.map((feature, i) => [feature, i]));
  const vector = [];
  let norm = 0;
  for (const [feature, count] of map) {
    const i = index.get(feature);
    if (i === undefined) continue;
    const value = (1 + Math.log(count)) * model.idf[i];
    vector.push([i, value]);
    norm += value * value;
  }
  const scale = norm ? 1 / Math.sqrt(norm) : 1;
  return vector.map(([i, value]) => [i, value * scale]);
}

function sigmoid(value) {
  if (value >= 0) return 1 / (1 + Math.exp(-Math.min(value, 40)));
  const exp = Math.exp(Math.max(value, -40));
  return exp / (1 + exp);
}

function dot(vector, weights) {
  let score = 0;
  for (const [index, value] of vector) score += weights[index] * value;
  return score;
}

function trainLinear(vectors, labels, kind) {
  const dimension = vectors.reduce((max, vector) => Math.max(max, ...vector.map(([i]) => i + 1)), 0);
  const weights = new Float64Array(dimension);
  let bias = 0;
  const regularization = 0.01;
  if (kind === 'complement_naive_bayes') {
    const totals = [new Float64Array(dimension), new Float64Array(dimension)];
    const counts = [0, 0];
    for (let row = 0; row < vectors.length; row += 1) {
      const complement = labels[row] === 1 ? 0 : 1;
      counts[complement] += 1;
      for (const [index, value] of vectors[row]) totals[complement][index] += value;
    }
    const negDenominator = totals[0].reduce((a, b) => a + b, 0) + dimension;
    const posDenominator = totals[1].reduce((a, b) => a + b, 0) + dimension;
    for (let i = 0; i < dimension; i += 1) {
      const pos = Math.log((totals[1][i] + 1) / posDenominator);
      const neg = Math.log((totals[0][i] + 1) / negDenominator);
      weights[i] = pos - neg;
    }
    bias = Math.log((counts[1] + 1) / (counts[0] + 1));
    return { weights: [...weights], bias };
  }

  const epochs = 180;
  for (let epoch = 0; epoch < epochs; epoch += 1) {
    const gradient = new Float64Array(dimension);
    let biasGradient = 0;
    for (let row = 0; row < vectors.length; row += 1) {
      const y = labels[row] === 1 ? 1 : -1;
      const score = dot(vectors[row], weights) + bias;
      let multiplier;
      if (kind === 'logistic_regression') multiplier = sigmoid(score) - labels[row];
      else {
        const margin = y * score;
        multiplier = margin < 1 ? -2 * y * (1 - margin) : 0;
      }
      for (const [index, value] of vectors[row]) gradient[index] += multiplier * value / vectors.length;
      biasGradient += multiplier / vectors.length;
    }
    const rate = 0.35 / Math.sqrt(1 + epoch * 0.025);
    for (let i = 0; i < dimension; i += 1) weights[i] -= rate * (gradient[i] + regularization * weights[i]);
    bias -= rate * biasGradient;
  }
  return { weights: [...weights], bias };
}

function scoreModel(vector, model, kind) {
  const score = dot(vector, model.weights) + model.bias;
  return kind === 'linear_svm' ? sigmoid(score * 2) : sigmoid(score);
}

function stratifiedSplit(rows, fraction, seed) {
  let state = seed >>> 0;
  const random = () => { state = (1664525 * state + 1013904223) >>> 0; return state / 4294967296; };
  const groups = [[], []];
  for (const row of rows) groups[Number(row.flag_for_review === 'yes')].push(row);
  const train = [];
  const test = [];
  for (const group of groups) {
    for (let i = group.length - 1; i > 0; i -= 1) { const j = Math.floor(random() * (i + 1)); [group[i], group[j]] = [group[j], group[i]]; }
    const testCount = Math.max(1, Math.round(group.length * fraction));
    test.push(...group.slice(0, testCount));
    train.push(...group.slice(testCount));
  }
  return { train, test };
}

function metrics(rows, probabilities, threshold = 0.5) {
  let tp = 0; let fp = 0; let fn = 0; let tn = 0;
  for (let i = 0; i < rows.length; i += 1) {
    const actual = rows[i].flag_for_review === 'yes';
    const predicted = probabilities[i] >= threshold;
    if (actual && predicted) tp += 1;
    else if (!actual && predicted) fp += 1;
    else if (actual && !predicted) fn += 1;
    else tn += 1;
  }
  const precision = tp + fp ? tp / (tp + fp) : 0;
  const recall = tp + fn ? tp / (tp + fn) : 0;
  return { precision, recall, f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0, accuracy: (tp + tn) / rows.length, tp, fp, fn, tn };
}

function prAuc(rows, probabilities) {
  const ordered = rows.map((row, i) => ({ actual: row.flag_for_review === 'yes', score: probabilities[i] })).sort((a, b) => b.score - a.score);
  const positives = ordered.filter((item) => item.actual).length;
  if (!positives) return 0;
  let tp = 0; let fp = 0; let previousRecall = 0; let area = 0;
  for (const item of ordered) {
    if (item.actual) tp += 1; else fp += 1;
    const recall = tp / positives;
    const precision = tp / (tp + fp);
    area += (recall - previousRecall) * precision;
    previousRecall = recall;
  }
  return area;
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
}

const allRows = parseCsv(fs.readFileSync(csvPath, 'utf8'));
const rows = allRows.filter((row) => row.source === 'synthetic' && ['yes', 'no'].includes(row.flag_for_review));
if (rows.length !== 80) throw new Error(`Expected 80 labeled synthetic examples; found ${rows.length}.`);
const { train, test } = stratifiedSplit(rows, HOLDOUT_FRACTION, RANDOM_SEED);
const algorithms = [
  ['logistic_regression', 'TF-IDF word + character n-grams with Logistic Regression'],
  ['linear_svm', 'TF-IDF word + character n-grams with Linear SVM'],
  ['complement_naive_bayes', 'TF-IDF word + character n-grams with Complement Naive Bayes'],
];
const results = [];
let best = null;
for (const [kind, label] of algorithms) {
  const started = performance.now();
  const validation = stratifiedSplit(train, 0.25, RANDOM_SEED + 1);
  const validationVectorizer = fitVectorizer(validation.train);
  const validationModel = trainLinear(validationVectorizer.vectors, validation.train.map((row) => Number(row.flag_for_review === 'yes')), kind);
  const validationScores = validation.test.map((row) => scoreModel(vectorizeOne(row.title, row.story_text, validationVectorizer), validationModel, kind));
  const thresholdAnalysis = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((threshold) => ({ threshold, ...metrics(validation.test, validationScores, threshold) }));
  const qualifyingThreshold = thresholdAnalysis.filter((row) => row.precision >= MINIMUM_PRECISION && row.tp > 0).sort((a, b) => b.recall - a.recall || b.precision - a.precision || b.threshold - a.threshold)[0];
  const chosenThreshold = qualifyingThreshold?.threshold ?? 0.5;
  const validationMetrics = metrics(validation.test, validationScores, chosenThreshold);
  const vectorizer = fitVectorizer(train);
  const trained = trainLinear(vectorizer.vectors, train.map((row) => Number(row.flag_for_review === 'yes')), kind);
  const scores = test.map((row) => scoreModel(vectorizeOne(row.title, row.story_text, vectorizer), trained, kind));
  const testMetrics = metrics(test, scores, chosenThreshold);
  const elapsedMs = performance.now() - started;
  const result = {
    id: kind,
    name: label,
    featureType: 'word unigrams/bigrams + character 3-5 grams; TF-IDF; title repeated twice before body',
    split: { strategy: 'fixed stratified 60/20 outer holdout; same rows for all models', seed: RANDOM_SEED, trainCount: train.length, testCount: test.length, validationTrainCount: validation.train.length, validationCount: validation.test.length },
    threshold: chosenThreshold,
    validationMetrics,
    validationThresholdAnalysis: thresholdAnalysis,
    validationPrecisionTarget: MINIMUM_PRECISION,
    validationMetPrecisionTarget: Boolean(qualifyingThreshold),
    metrics: { ...testMetrics, prAuc: prAuc(test, scores) },
    testThresholdAnalysis: [0.5, 0.6, 0.7, 0.8, 0.9, 0.95].map((threshold) => ({ threshold, ...metrics(test, scores, threshold) })),
    trainingAndPredictionMs: Number(elapsedMs.toFixed(2)),
    featureCount: vectorizer.vocabulary.length,
    modelBytes: Buffer.byteLength(JSON.stringify({ vocabulary: vectorizer.vocabulary, idf: vectorizer.idf, ...trained })),
  };
  results.push(result);
  result._scores = scores;
  result._vectorizer = vectorizer;
  result._trained = trained;
  result._threshold = chosenThreshold;
}

const eligibleModels = results.filter((result) => result.validationMetPrecisionTarget);
best = eligibleModels.sort((a, b) => b.validationMetrics.precision - a.validationMetrics.precision || b.validationMetrics.recall - a.validationMetrics.recall || b.validationMetrics.f1 - a.validationMetrics.f1)[0]
  || [...results].sort((a, b) => b.validationMetrics.f1 - a.validationMetrics.f1 || b.validationMetrics.precision - a.validationMetrics.precision)[0];
const chosenThreshold = best._threshold;
const selected = results.find((result) => result.id === best.id);
selected.chosenThreshold = chosenThreshold;

// Refit the selected classifier on every labeled synthetic example for serving.
const fullVectorizer = fitVectorizer(rows);
const fullModel = trainLinear(fullVectorizer.vectors, rows.map((row) => Number(row.flag_for_review === 'yes')), best.id);
const artifact = {
  version: `tfidf-${best.id}-synthetic-v1`,
  algorithm: best.id,
  vocabulary: fullVectorizer.vocabulary,
  idf: fullVectorizer.idf,
  weights: fullModel.weights,
  bias: fullModel.bias,
  warningThreshold: chosenThreshold,
  trainingRows: rows.length,
  trainingSource: 'synthetic-only; not representative of production stories',
  scoreTransform: 'sigmoid(2 * linear_svm_margin); score is not calibrated probability',
};
fs.mkdirSync(path.dirname(modelPath), { recursive: true });
fs.writeFileSync(modelPath, `${JSON.stringify(artifact, null, 2)}\n`);

const humanRows = test.map((row, index) => ({ story_id: row.story_id, title: row.title, actual: row.flag_for_review, modelScore: Number(best._scores[index].toFixed(6)), predicted_at_0_5: best._scores[index] >= 0.5 ? 'yes' : 'no', predicted_at_warning_threshold: best._scores[index] >= chosenThreshold ? 'yes' : 'no' }));
// The user confirmed these real snapshot stories are all safe. Keep this as a
// separate sanity check: it must not influence candidate or threshold choice.
const snapshotRows = allRows.filter((row) => row.source === 'existing_snapshot');
const snapshotStarted = performance.now();
const snapshotScores = snapshotRows.map((row) => scoreModel(vectorizeOne(row.title, row.story_text, fullVectorizer), fullModel, best.id));
const snapshotPredictions = snapshotScores.map((score) => score >= chosenThreshold);
const snapshotFlagged = snapshotPredictions.filter(Boolean).length;
const snapshotEvaluation = {
  referenceLabel: 'all 15 existing_snapshot stories are safe, as confirmed by the user; reference labels are evaluation-only and are not written into evaluation-corpus.csv',
  model: best.id,
  modelTraining: 'selected candidate refit on all 80 labeled synthetic examples; snapshot stories were not used for training or selection',
  threshold: chosenThreshold,
  count: snapshotRows.length,
  flaggedCount: snapshotFlagged,
  correctlyClearedCount: snapshotRows.length - snapshotFlagged,
  falsePositiveRate: snapshotRows.length ? snapshotFlagged / snapshotRows.length : null,
  accuracy: snapshotRows.length ? (snapshotRows.length - snapshotFlagged) / snapshotRows.length : null,
  scoringTimeMs: Number((performance.now() - snapshotStarted).toFixed(2)),
  stories: snapshotRows.map((row, index) => ({ story_id: row.story_id, title: row.title, reference: 'safe', modelScore: Number(snapshotScores[index].toFixed(6)), predicted: snapshotPredictions[index] ? 'flagged' : 'clear' })),
  caveat: 'Small, single-class sanity check only. Since every reference example is safe, precision, recall, F1, and PR-AUC for detecting unsafe stories are not meaningful here; this does not estimate performance on unsafe real stories.',
};
const report = {
  dataset: { totalRowsInCorpus: allRows.length, labeledSyntheticRows: rows.length, unlabeledSnapshotRows: allRows.filter((row) => row.source === 'existing_snapshot' && !row.flag_for_review).length, classCounts: { yes: rows.filter((row) => row.flag_for_review === 'yes').length, no: rows.filter((row) => row.flag_for_review === 'no').length }, note: 'Synthetic-only labels; evaluation is exploratory and does not estimate production accuracy.' },
  evaluation: { splitStrategy: 'fixed stratified 60/20 holdout; inner 45/15 stratified validation selects model and score threshold; identical rows for all candidates', randomSeed: RANDOM_SEED, testRows: humanRows },
  realSnapshotSanityCheck: snapshotEvaluation,
  candidates: results.map(({ _scores, _vectorizer, _trained, _threshold, ...result }) => result),
  selectedCandidate: best.id,
  warningThreshold: chosenThreshold,
  thresholdSelection: `On validation data only, select a model and threshold meeting precision >= ${MINIMUM_PRECISION}; favor higher recall, then precision. If no candidate meets the precision target, fall back to best validation F1 at 0.5. The final 20-row holdout is used only for reporting.`,
  caveat: 'The model score is sigmoid-transformed for threshold convenience and is not a calibrated probability. The model and threshold are provisional because all labeled examples are synthetic, the dataset contains 80 stories, and the holdout is small.',
};
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify({ selectedCandidate: best.id, warningThreshold: chosenThreshold, results: results.map(({ _scores, _vectorizer, _trained, _threshold, ...result }) => result) }, null, 2));

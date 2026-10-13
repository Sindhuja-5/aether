import path from 'node:path';
import { tmpdir } from 'node:os';
import { env, pipeline } from '@huggingface/transformers';

const PHISHING_SCAM_MODEL = 'onnx-community/phishing-scam-detector-base-ONNX';
const TOXICITY_MODEL = 'onnx-community/toxic-prompt-roberta-ONNX';
const WARNING_THRESHOLD = 0.5;

env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR || path.join(tmpdir(), 'aether-transformers-cache');

const classifiers = new Map();

function getClassifier(modelId) {
  if (!classifiers.has(modelId)) {
    const loading = pipeline('text-classification', modelId, { dtype: 'q8' });
    loading.catch(() => classifiers.delete(modelId));
    classifiers.set(modelId, loading);
  }
  return classifiers.get(modelId);
}

function visitText(value, parts) {
  if (value == null) return;
  if (typeof value === 'string') { parts.push(value); return; }
  if (Array.isArray(value)) {
    for (const child of value) visitText(child, parts);
    return;
  }
  if (typeof value !== 'object') return;
  if (value.type === 'text' && typeof value.text === 'string') parts.push(value.text);
  else if (value.type === 'hardBreak') parts.push(' ');
  if (value.content) visitText(value.content, parts);
}

function extractPlainText(value) {
  const parts = [];
  visitText(value, parts);
  return parts.join(' ').replace(/\s+/gu, ' ').trim();
}

function labelScores(output) {
  const values = Array.isArray(output) ? output.flat(Infinity) : [output];
  return new Map(values
    .filter((item) => item && typeof item.label === 'string' && Number.isFinite(item.score))
    .map((item) => [item.label.toLowerCase().replaceAll('-', '_'), item.score]));
}

function requireScore(scores, labels) {
  const matched = labels.filter((label) => scores.has(label));
  if (matched.length !== labels.length) {
    throw new Error(`Moderation model output is missing expected labels: ${labels.filter((label) => !scores.has(label)).join(', ')}.`);
  }
  return matched.reduce((sum, label) => sum + scores.get(label), 0);
}

/**
 * Scores a story with pretrained spam/scam and toxicity classifiers.
 * The maximum score is a review signal, not a calibrated probability or a human decision.
 */
export async function classifyStory(title, body) {
  const normalizedTitle = typeof title === 'string' ? title.trim() : '';
  const normalizedBody = extractPlainText(body);
  const text = `${normalizedTitle}\n${normalizedBody}`.slice(0, 12_000);
  const [scamClassifier, toxicityClassifier] = await Promise.all([
    getClassifier(PHISHING_SCAM_MODEL),
    getClassifier(TOXICITY_MODEL),
  ]);
  const options = { top_k: null, truncation: true, max_length: 512 };
  const scamOutput = labelScores(await scamClassifier(text, options));
  const toxicityOutput = labelScores(await toxicityClassifier(text, options));
  const scamScore = requireScore(scamOutput, ['fraud', 'spam']);
  const toxicityScore = requireScore(toxicityOutput, ['toxic']);
  const score = Math.max(scamScore, toxicityScore);

  return {
    status: score >= WARNING_THRESHOLD ? 'flagged' : 'clear',
    score: Number(score.toFixed(6)),
    modelVersion: `${PHISHING_SCAM_MODEL}+${TOXICITY_MODEL}@main:q8:max-score-v1`,
    evaluatedAt: new Date(),
  };
}

export const moderationModelInfo = Object.freeze({
  version: `${PHISHING_SCAM_MODEL}+${TOXICITY_MODEL}@main:q8:max-score-v1`,
  algorithm: 'maximum of pretrained phishing/fraud+spam and toxicity scores',
  threshold: WARNING_THRESHOLD,
});

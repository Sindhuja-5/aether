import { callModelService } from '../model-service-client.mjs';

const PHISHING_SCAM_MODEL = 'onnx-community/phishing-scam-detector-base-ONNX';
const TOXICITY_MODEL = 'onnx-community/toxic-prompt-roberta-ONNX';
const WARNING_THRESHOLD = 0.5;

/**
 * Scores a story with pretrained spam/scam and toxicity classifiers.
 * The maximum score is a review signal, not a calibrated probability or a human decision.
 */
export async function classifyStory(title, body) {
  const result = await callModelService('/v1/moderate', { title, body });
  if (!['flagged', 'clear'].includes(result.status)
    || !Number.isFinite(result.score)
    || typeof result.modelVersion !== 'string'
    || typeof result.evaluatedAt !== 'string') {
    throw new Error('Model service returned an invalid moderation result.');
  }
  return { ...result, evaluatedAt: new Date(result.evaluatedAt) };
}

export const moderationModelInfo = Object.freeze({
  version: `${PHISHING_SCAM_MODEL}+${TOXICITY_MODEL}@main:q8:max-score-v1`,
  algorithm: 'remote model service: maximum of pretrained phishing/fraud+spam and toxicity scores',
  threshold: WARNING_THRESHOLD,
});

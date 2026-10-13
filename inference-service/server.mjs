import { timingSafeEqual } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { env, pipeline } from '@huggingface/transformers';

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || '0.0.0.0';
const MAX_BODY_BYTES = 1_048_576;
const MAX_EMBED_TEXTS = 256;
const EMBEDDING_DIMENSIONS = 384;
const MODEL_ID = 'onnx-community/all-MiniLM-L6-v2-ONNX';
const MODEL_REVISION = 'aff7a1dc4e8a1ea593e6ea21e95c22ef0a25966f';
const EMBEDDING_MODEL_VERSION = `${MODEL_ID}@${MODEL_REVISION}:q4:field-vectors-v3`;
const PHISHING_SCAM_MODEL = 'onnx-community/phishing-scam-detector-base-ONNX';
const TOXICITY_MODEL = 'onnx-community/toxic-prompt-roberta-ONNX';
const MODERATION_MODEL_VERSION = `${PHISHING_SCAM_MODEL}+${TOXICITY_MODEL}@main:q8:max-score-v1`;
const WARNING_THRESHOLD = 0.5;

const serviceToken = process.env.MODEL_SERVICE_TOKEN;
if (!serviceToken) throw new Error('MODEL_SERVICE_TOKEN is required.');
env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR || path.join(tmpdir(), 'aether-transformers-cache');

let extractorPromise;
const classifierPromises = new Map();

function getExtractor() {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', MODEL_ID, {
      revision: MODEL_REVISION,
      dtype: 'q4',
    });
    extractorPromise.catch(() => { extractorPromise = undefined; });
  }
  return extractorPromise;
}

function getClassifier(modelId) {
  if (!classifierPromises.has(modelId)) {
    const loading = pipeline('text-classification', modelId, { dtype: 'q8' });
    loading.catch(() => classifierPromises.delete(modelId));
    classifierPromises.set(modelId, loading);
  }
  return classifierPromises.get(modelId);
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
    throw new Error(`Moderation output missing labels: ${labels.filter((label) => !scores.has(label)).join(', ')}.`);
  }
  return matched.reduce((sum, label) => sum + scores.get(label), 0);
}

function authorized(request) {
  const candidate = request.headers.authorization?.startsWith('Bearer ')
    ? request.headers.authorization.slice(7)
    : '';
  const candidateBuffer = Buffer.from(candidate);
  const tokenBuffer = Buffer.from(serviceToken);
  return candidateBuffer.length === tokenBuffer.length && timingSafeEqual(candidateBuffer, tokenBuffer);
}

function send(response, status, payload) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw Object.assign(new Error('Request body is too large.'), { status: 413 });
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

async function embed(texts) {
  if (!Array.isArray(texts) || texts.length < 1 || texts.length > MAX_EMBED_TEXTS
    || texts.some((text) => typeof text !== 'string' || !text.trim() || text.length > 12_000)) {
    throw Object.assign(new Error(`texts must contain 1–${MAX_EMBED_TEXTS} non-empty strings up to 12,000 characters each.`), { status: 400 });
  }
  const extractor = await getExtractor();
  const tensor = await extractor(texts.map((text) => text.trim()), { pooling: 'mean', normalize: true });
  const vectors = tensor.tolist();
  if (!Array.isArray(vectors) || vectors.length !== texts.length || vectors.some((vector) =>
    !Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || vector.some((n) => !Number.isFinite(n))
  )) throw new Error('Embedding model returned vectors with an invalid shape.');
  return { modelVersion: EMBEDDING_MODEL_VERSION, vectors };
}

async function moderate(title, body) {
  if (title != null && typeof title !== 'string') throw Object.assign(new Error('title must be a string.'), { status: 400 });
  const text = `${typeof title === 'string' ? title.trim() : ''}\n${extractPlainText(body)}`.slice(0, 12_000);
  const [scamClassifier, toxicityClassifier] = await Promise.all([
    getClassifier(PHISHING_SCAM_MODEL),
    getClassifier(TOXICITY_MODEL),
  ]);
  const options = { top_k: null, truncation: true, max_length: 512 };
  const scamOutput = labelScores(await scamClassifier(text, options));
  const toxicityOutput = labelScores(await toxicityClassifier(text, options));
  const score = Math.max(
    requireScore(scamOutput, ['fraud', 'spam']),
    requireScore(toxicityOutput, ['toxic']),
  );
  return {
    status: score >= WARNING_THRESHOLD ? 'flagged' : 'clear',
    score: Number(score.toFixed(6)),
    modelVersion: MODERATION_MODEL_VERSION,
    evaluatedAt: new Date().toISOString(),
  };
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || '/', 'http://localhost').pathname;
  if (request.method === 'GET' && pathname === '/health') {
    return send(response, 200, { status: 'ok' });
  }
  if (request.method !== 'POST' || !['/v1/embed', '/v1/moderate'].includes(pathname)) {
    return send(response, 404, { error: 'Not found.' });
  }
  if (!authorized(request)) return send(response, 401, { error: 'Unauthorized.' });

  try {
    const payload = await readJson(request);
    const result = pathname === '/v1/embed'
      ? await embed(payload?.texts)
      : await moderate(payload?.title, payload?.body);
    return send(response, 200, result);
  } catch (error) {
    const status = Number.isInteger(error?.status) ? error.status : 500;
    if (status >= 500) console.error(`Inference request failed (${pathname}):`, error);
    return send(response, status, { error: status >= 500 ? 'Inference failed.' : error.message });
  }
});

server.listen(PORT, HOST, () => console.log(`Aether inference service listening on ${HOST}:${PORT}`));

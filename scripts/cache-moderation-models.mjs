import path from 'node:path';
import { tmpdir } from 'node:os';
import { env, pipeline } from '@huggingface/transformers';

env.cacheDir = process.env.TRANSFORMERS_CACHE_DIR || path.join(tmpdir(), 'aether-transformers-cache');

for (const modelId of [
  'onnx-community/phishing-scam-detector-base-ONNX',
  'onnx-community/toxic-prompt-roberta-ONNX',
]) {
  console.log(`Caching ${modelId}...`);
  const classifier = await pipeline('text-classification', modelId, { dtype: 'q8' });
  if (typeof classifier.dispose === 'function') await classifier.dispose();
}

console.log(`Moderation model files are cached in ${env.cacheDir}.`);

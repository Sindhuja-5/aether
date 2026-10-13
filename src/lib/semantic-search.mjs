import { createHash } from 'node:crypto';
import { callModelService } from './model-service-client.mjs';

export const MODEL_ID = 'onnx-community/all-MiniLM-L6-v2-ONNX';
export const MODEL_REVISION = 'aff7a1dc4e8a1ea593e6ea21e95c22ef0a25966f';
export const EMBEDDING_DIMENSIONS = 384;
export const EMBEDDING_MODEL_VERSION = `${MODEL_ID}@${MODEL_REVISION}:q4:field-vectors-v3`;

export function tiptapToPlainText(value) {
  const parts = [];
  const visit = (node) => {
    if (!node) return;
    if (typeof node === 'string') {
      parts.push(node);
      return;
    }
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== 'object') return;
    if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text);
    else if (node.type === 'hardBreak') parts.push(' ');
    if (node.content) visit(node.content);
  };
  visit(value);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function tiptapToChunks(value) {
  const chunks = [];
  let current = '';
  const flush = () => {
    const text = current.replace(/\s+/g, ' ').trim();
    if (text) chunks.push(text);
    current = '';
  };
  const visit = (node) => {
    if (!node) return;
    if (Array.isArray(node)) {
      for (const child of node) visit(child);
      return;
    }
    if (typeof node !== 'object') return;
    if (node.type === 'text' && typeof node.text === 'string') current += ` ${node.text}`;
    else if (node.type === 'hardBreak') flush();
    if (node.content) visit(node.content);
    if (['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock'].includes(node.type)) flush();
  };
  visit(value);

  return chunks.flatMap((chunk) => {
    const sentences = chunk.split(/(?<=[.!?])\s+/u).map((sentence) => sentence.trim()).filter(Boolean);
    return sentences.flatMap((sentence) => {
      const words = sentence.split(/\s+/u);
      if (words.length <= 100) return [sentence];
      const parts = [];
      for (let i = 0; i < words.length; i += 100) parts.push(words.slice(i, i + 100).join(' '));
      return parts;
    });
  });
}

export function buildBlogEmbeddingText(blog) {
  const title = typeof blog?.title === 'string' ? blog.title.trim() : '';
  const body = tiptapToPlainText(blog?.body);
  const tags = Array.isArray(blog?.tags)
    ? blog.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
    : [];
  return [title, body, tags.join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

export function buildBlogSemanticInputs(blog) {
  const titleText = typeof blog?.title === 'string' ? blog.title.trim() : '';
  const bodyTexts = tiptapToChunks(blog?.body);
  const topicTexts = Array.isArray(blog?.tags)
    ? blog.tags.filter((tag) => typeof tag === 'string').map((tag) => tag.trim()).filter(Boolean)
    : [];
  return { titleText, bodyTexts, topicTexts };
}

export function hashEmbeddingText(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

export async function embedTexts(texts) {
  const inputs = texts.map((text) => text.trim());
  if (inputs.length === 0 || inputs.some((text) => !text)) throw new Error('Cannot embed empty text.');
  const vectors = [];
  for (let index = 0; index < inputs.length; index += 256) {
    const result = await callModelService('/v1/embed', { texts: inputs.slice(index, index + 256) });
    if (result.modelVersion !== EMBEDDING_MODEL_VERSION) {
      throw new Error(`Model service embedding version mismatch: expected ${EMBEDDING_MODEL_VERSION}.`);
    }
    if (!Array.isArray(result.vectors)) throw new Error('Model service returned an invalid embedding response.');
    vectors.push(...result.vectors);
  }
  if (!Array.isArray(vectors) || vectors.length !== inputs.length || vectors.some((vector) =>
    !Array.isArray(vector) || vector.length !== EMBEDDING_DIMENSIONS || vector.some((n) => !Number.isFinite(n))
  )) {
    throw new Error(`MiniLM returned invalid embeddings; expected ${inputs.length} vectors of ${EMBEDDING_DIMENSIONS} finite values.`);
  }
  return vectors;
}

export async function embedText(text) {
  return (await embedTexts([text]))[0];
}

export interface EmbeddableBlog {
  title?: unknown;
  body?: unknown;
  tags?: unknown;
}

export interface BlogSemanticInputs {
  titleText: string;
  bodyTexts: string[];
  topicTexts: string[];
}

export const MODEL_ID: string;
export const MODEL_REVISION: string;
export const EMBEDDING_DIMENSIONS: number;
export const EMBEDDING_MODEL_VERSION: string;
export function tiptapToPlainText(value: unknown): string;
export function buildBlogEmbeddingText(blog: EmbeddableBlog): string;
export function buildBlogSemanticInputs(blog: EmbeddableBlog): BlogSemanticInputs;
export function hashEmbeddingText(text: string): string;
export function embedTexts(texts: string[]): Promise<number[][]>;
export function embedText(text: string): Promise<number[]>;

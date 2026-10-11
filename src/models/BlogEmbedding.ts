import { Schema, model, models, Types } from 'mongoose';

export interface IBlogEmbedding {
  _id: Types.ObjectId;
  titleEmbedding?: number[];
  bodyEmbeddings: number[][];
  topicEmbeddings: number[][];
  modelVersion: string;
  contentHash: string;
  createdAt: Date;
  updatedAt: Date;
}

const BlogEmbeddingSchema = new Schema<IBlogEmbedding>(
  {
    // Use the story id as this document's _id: MongoDB's built-in unique index
    // keeps writes idempotent without adding a separate lookup index.
    _id: { type: Schema.Types.ObjectId, ref: 'Blog', required: true },
    titleEmbedding: { type: [Number], select: false },
    bodyEmbeddings: { type: [[Number]], default: [], select: false },
    topicEmbeddings: { type: [[Number]], default: [], select: false },
    modelVersion: { type: String, required: true },
    contentHash: { type: String, required: true },
  },
  { timestamps: true, collection: 'blog_embeddings' }
);

const BlogEmbedding = models.BlogEmbedding || model<IBlogEmbedding>('BlogEmbedding', BlogEmbeddingSchema);
export default BlogEmbedding;

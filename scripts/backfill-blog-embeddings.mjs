import mongoose from 'mongoose';
import {
  buildBlogEmbeddingText,
  buildBlogSemanticInputs,
  embedTexts,
  EMBEDDING_MODEL_VERSION,
  hashEmbeddingText,
} from '../src/lib/semantic-search.mjs';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required. Load it from the deployment environment.');

let generated = 0;
let skipped = 0;
let failed = 0;

try {
  await mongoose.connect(uri, { family: 4 });
  const database = mongoose.connection.db;
  const blogs = await database.collection('blogs').find({}, {
    projection: { title: 1, body: 1, tags: 1 },
  }).toArray();
  const embeddings = database.collection('blog_embeddings');

  console.log(`Found ${blogs.length} stories. Building or checking MiniLM embeddings...`);
  for (const blog of blogs) {
    try {
      const text = buildBlogEmbeddingText(blog);
      if (!text) {
        skipped += 1;
        continue;
      }
      const contentHash = hashEmbeddingText(text);
      const current = await embeddings.findOne(
        { _id: blog._id },
        { projection: { modelVersion: 1, contentHash: 1 } }
      );
      if (current?.modelVersion === EMBEDDING_MODEL_VERSION && current.contentHash === contentHash) {
        skipped += 1;
        continue;
      }

      const inputs = buildBlogSemanticInputs(blog);
      const inputTexts = [
        ...(inputs.titleText ? [inputs.titleText] : []),
        ...inputs.bodyTexts,
        ...inputs.topicTexts,
      ];
      const vectors = await embedTexts(inputTexts);
      let vectorIndex = 0;
      const fields = {
        modelVersion: EMBEDDING_MODEL_VERSION,
        contentHash,
        updatedAt: new Date(),
      };
      if (inputs.titleText) fields.titleEmbedding = vectors[vectorIndex++];
      else fields.titleEmbedding = null;
      fields.bodyEmbeddings = vectors.slice(vectorIndex, vectorIndex + inputs.bodyTexts.length);
      fields.topicEmbeddings = vectors.slice(vectorIndex + inputs.bodyTexts.length);
      await embeddings.updateOne(
        { _id: blog._id },
        {
          $set: fields,
          $unset: { embedding: 1, bodyEmbedding: 1, searchText: 1 },
          $setOnInsert: { createdAt: new Date() },
        },
        { upsert: true }
      );
      generated += 1;
      if ((generated + skipped + failed) % 10 === 0) {
        console.log(`Processed ${generated + skipped + failed}/${blogs.length} stories.`);
      }
    } catch (error) {
      failed += 1;
      console.error(`Failed to embed story ${String(blog._id)}:`, error instanceof Error ? error.message : 'unknown error');
    }
  }

  console.log(`Embedding backfill complete: ${generated} generated, ${skipped} current/skipped, ${failed} failed.`);
  if (failed > 0) process.exitCode = 1;
} finally {
  await mongoose.disconnect();
}

import Blog from '@/models/Blog';
import BlogEmbedding from '@/models/BlogEmbedding';
import User from '@/models/User';
import {
  buildBlogEmbeddingText,
  buildBlogSemanticInputs,
  embedTexts,
  embedText,
  EMBEDDING_DIMENSIONS,
  EMBEDDING_MODEL_VERSION,
  hashEmbeddingText,
} from '@/lib/semantic-search.mjs';

// Calibrated on the saved 15-story / 25-query evaluation: 0.44 abstains on
// both judged no-hit queries while retaining 0.84 Recall@3 (0.88 at 0.36).
const MIN_SEMANTIC_SCORE = 0.44;
const MAX_SEMANTIC_RESULTS = 30;

export async function refreshBlogEmbedding(blog: {
  _id: unknown;
  title?: unknown;
  body?: unknown;
  tags?: unknown;
}) {
  const text = buildBlogEmbeddingText(blog);
  const inputs = buildBlogSemanticInputs(blog);
  if (!text) {
    await BlogEmbedding.deleteOne({ _id: blog._id });
    return;
  }

  const inputTexts = [
    ...(inputs.titleText ? [inputs.titleText] : []),
    ...inputs.bodyTexts,
    ...inputs.topicTexts,
  ];
  const vectors = await embedTexts(inputTexts);
  let vectorIndex = 0;
  const setFields: Record<string, unknown> = {
    titleEmbedding: inputs.titleText ? vectors[vectorIndex++] : undefined,
    bodyEmbeddings: vectors.slice(vectorIndex, vectorIndex + inputs.bodyTexts.length),
    topicEmbeddings: vectors.slice(vectorIndex + inputs.bodyTexts.length),
    modelVersion: EMBEDDING_MODEL_VERSION,
    contentHash: hashEmbeddingText(text),
  };
  if (!inputs.titleText) delete setFields.titleEmbedding;
  await BlogEmbedding.updateOne(
    { _id: blog._id },
    {
      $set: setFields,
      $unset: { embedding: 1, bodyEmbedding: 1, searchText: 1 },
    },
    { upsert: true }
  );
}

export async function removeBlogEmbedding(blogId: string) {
  await BlogEmbedding.deleteOne({ _id: blogId });
}

function cosineSimilarity(left: number[], right: number[]) {
  if (left.length !== EMBEDDING_DIMENSIONS || right.length !== EMBEDDING_DIMENSIONS) return -1;
  let dot = 0;
  for (let i = 0; i < EMBEDDING_DIMENSIONS; i += 1) dot += left[i] * right[i];
  return dot;
}

export async function getSemanticBlogResults(query: string, status: string) {
  const indexed = await BlogEmbedding.find({ modelVersion: EMBEDDING_MODEL_VERSION })
    .select('+titleEmbedding +bodyEmbeddings +topicEmbeddings')
    .lean();
  if (indexed.length === 0) {
    return {
      results: [],
      diagnostics: {
        modelVersion: EMBEDDING_MODEL_VERSION,
        indexedCount: 0,
        candidateCount: 0,
        threshold: MIN_SEMANTIC_SCORE,
        candidates: [],
      },
    };
  }

  const queryEmbedding = await embedText(query);
  const blogIds = indexed.map((entry) => entry._id);
  const blogs = await Blog.find({ _id: { $in: blogIds }, status })
    .select('authorId title tags previewImage status createdAt')
    .populate({ path: 'authorId', select: 'penName profilePicture', model: User })
    .lean();
  const embeddingById = new Map(indexed.map((entry) => [String(entry._id), entry]));

  const scored = blogs
    .map((blog) => {
      const vectors = embeddingById.get(String(blog._id));
      const titleScore = vectors?.titleEmbedding
        ? cosineSimilarity(queryEmbedding, vectors.titleEmbedding as number[])
        : -1;
      const bodyScore = Math.max(-1, ...((vectors?.bodyEmbeddings as number[][] | undefined) ?? [])
        .map((vector) => cosineSimilarity(queryEmbedding, vector)));
      const topicsScore = Math.max(-1, ...((vectors?.topicEmbeddings as number[][] | undefined) ?? [])
        .map((vector) => cosineSimilarity(queryEmbedding, vector)));
      return {
        blog,
        titleScore,
        bodyScore,
        topicsScore,
        semanticScore: Math.max(titleScore, bodyScore, topicsScore),
      };
    })
    .sort((a, b) => b.semanticScore - a.semanticScore);

  return {
    results: scored
      .filter((hit) => hit.semanticScore >= MIN_SEMANTIC_SCORE)
      .slice(0, MAX_SEMANTIC_RESULTS),
    diagnostics: {
      modelVersion: EMBEDDING_MODEL_VERSION,
      indexedCount: indexed.length,
      candidateCount: scored.length,
      threshold: MIN_SEMANTIC_SCORE,
      candidates: scored.slice(0, 50).map((hit, index) => ({
        id: String(hit.blog._id),
        title: hit.blog.title,
        cosineSimilarity: Number(hit.semanticScore.toFixed(4)),
        titleSimilarity: hit.titleScore >= 0 ? Number(hit.titleScore.toFixed(4)) : null,
        bodySimilarity: hit.bodyScore >= 0 ? Number(hit.bodyScore.toFixed(4)) : null,
        topicsSimilarity: hit.topicsScore >= 0 ? Number(hit.topicsScore.toFixed(4)) : null,
        bestField: hit.semanticScore === hit.bodyScore ? 'body' : hit.semanticScore === hit.titleScore ? 'title' : 'topics',
        rank: index + 1,
        included: hit.semanticScore >= MIN_SEMANTIC_SCORE,
      })),
    },
  };
}

export function mergeSearchResults(lexicalResults: any[], semanticResults: any[]) {
  const merged = new Map<string, { blog: any; lexicalRank?: number; semanticRank?: number; semanticScore?: number; lexicalScore?: number }>();

  lexicalResults.forEach((blog, index) => {
    const id = String(blog._id);
    merged.set(id, {
      blog,
      lexicalRank: index + 1,
      lexicalScore: typeof blog.score === 'number' ? blog.score : undefined,
    });
  });

  semanticResults.forEach(({ blog, semanticScore }, index) => {
    const id = String(blog._id);
    const existing = merged.get(id);
    merged.set(id, {
      ...existing,
      blog: existing?.blog ?? blog,
      semanticRank: index + 1,
      semanticScore,
    });
  });

  return [...merged.values()]
    .map(({ blog, lexicalRank, semanticRank, semanticScore, lexicalScore }) => ({
      ...blog,
      score: (lexicalRank ? 1 / (60 + lexicalRank) : 0) + (semanticRank ? 1 / (60 + semanticRank) : 0),
      ...(lexicalScore !== undefined ? { lexicalScore } : {}),
      ...(semanticScore !== undefined ? { semanticScore } : {}),
    }))
    .sort((a, b) => b.score - a.score || (b.semanticScore ?? -1) - (a.semanticScore ?? -1));
}

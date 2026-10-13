import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Blog from '@/models/Blog';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/authHelper';
import { getSemanticBlogResults, mergeSearchResults, refreshBlogEmbedding, removeBlogEmbedding } from '@/lib/semantic-search-service';
import { classifyStory } from '@/lib/moderation/classifier.mjs';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status') || 'published';
    const query = searchParams.get('q') || '';
    const exclusive = searchParams.get('exclusive') === 'true';

    // 1. Search Logic using Atlas Search (if query exists)
    if (query) {
      const pipeline: any[] = [
        {
          $search: {
            index: process.env.MONGODB_SEARCH_INDEX || "index-blog",
            compound: {
              must: [
                {
                  text: {
                    query: query,
                    path: { wildcard: "*" },
                    fuzzy: { maxEdits: 2 }
                  }
                }
              ],
              filter: [
                {
                  text: {
                    query: status,
                    path: 'status'
                  }
                }
              ]
            }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'authorId',
            foreignField: '_id',
            as: 'authorId'
          }
        },
        { $unwind: '$authorId' },
        {
          $project: {
            'authorId.auth0Id': 0,
            'authorId.email': 0,
            'authorId.interests': 0
          }
        },
        {
          $addFields: {
            score: { $meta: "searchScore" }
          }
        },
        { $sort: { score: -1 } }
      ];

      const lexicalBlogs = await Blog.aggregate(pipeline);
      let semanticBlogs: Awaited<ReturnType<typeof getSemanticBlogResults>>['results'] = [];
      let semanticDiagnostics: Awaited<ReturnType<typeof getSemanticBlogResults>>['diagnostics'] | undefined;
      try {
        const semanticSearch = await getSemanticBlogResults(query, status);
        semanticBlogs = semanticSearch.results;
        semanticDiagnostics = semanticSearch.diagnostics;
        if (process.env.NODE_ENV !== 'production') {
          console.info('[semantic-search:diagnostics]', JSON.stringify({
            query,
            status,
            lexicalHitCount: lexicalBlogs.length,
            ...semanticSearch.diagnostics,
          }));
        }
      } catch (error) {
        // Keep the current Atlas search available if model loading or inference fails.
        console.error('Semantic search unavailable; returning Atlas results only.', error);
      }
      if (process.env.NODE_ENV !== 'production' && !semanticDiagnostics) {
        console.info('[semantic-search:diagnostics]', JSON.stringify({
          query,
          status,
          lexicalHitCount: lexicalBlogs.length,
          semanticError: 'See server error log above.',
        }));
      }
      return NextResponse.json(mergeSearchResults(lexicalBlogs, semanticBlogs));
    }

    // 2. Exclusive Interest-based Feed (For You)
    if (!query && exclusive) {
      const user = await getAuthenticatedUser(req);
      if (user && status === 'published') {
        const userInterests = user?.interests || [];

        if (userInterests.length > 0) {
          const interestBlogs = await Blog.find({
            status: 'published',
            tags: { $in: userInterests }
          })
            .populate({ path: 'authorId', select: 'penName profilePicture', model: User })
            .sort({ createdAt: -1 });

          return NextResponse.json(interestBlogs);
        }
      }
      return NextResponse.json([]);
    }

    // 3. Global Feed (Discover)
    const blogs = await Blog.find({ status })
      .populate({ path: 'authorId', select: 'penName profilePicture', model: User })
      .sort({ createdAt: -1 });

    return NextResponse.json(blogs);
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch blogs', details: error.toString() }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const input = await req.json();
    const blog = await Blog.create({
      title: input.title,
      body: input.body,
      previewImage: input.previewImage,
      status: input.status,
      tags: input.tags,
      authorId: user._id,
      moderation: await classifyStory(input.title, input.body),
    });

    try {
      await refreshBlogEmbedding(blog);
    } catch (error) {
      await removeBlogEmbedding(String(blog._id)).catch(() => undefined);
      console.error(`Could not create a semantic embedding for story ${String(blog._id)}.`, error);
    }

    return NextResponse.json(blog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 });
  }
}

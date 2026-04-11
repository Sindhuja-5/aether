import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Blog from '@/models/Blog';
import User from '@/models/User';
import { auth0 } from '@/lib/auth0';

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
            index: "index-blog",
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

      const blogs = await Blog.aggregate(pipeline);
      return NextResponse.json(blogs);
    }

    // 2. Exclusive Interest-based Feed (For You)
    if (!query && exclusive) {
      const session = await auth0.getSession();
      if (session?.user && status === 'published') {
        const user = await User.findOne({ auth0Id: session.user.sub });
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
    const session = await auth0.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const user = await User.findOne({ auth0Id: session.user.sub });
    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await req.json();
    const blog = await Blog.create({ ...body, authorId: user._id });

    return NextResponse.json(blog, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create blog' }, { status: 500 });
  }
}

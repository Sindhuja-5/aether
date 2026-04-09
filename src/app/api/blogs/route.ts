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

    // Search Logic
    let searchFilter: any = { status };
    
    if (query) {
      // Search in title, tags, and penName
      searchFilter.$or = [
        { title: { $regex: query, $options: 'i' } },
        { tags: { $regex: query, $options: 'i' } }
      ];

      // If we want to search by author penName, we need to find those users first
      const matchingAuthors = await User.find({ penName: { $regex: query, $options: 'i' } }).select('_id');
      if (matchingAuthors.length > 0) {
        searchFilter.$or.push({ authorId: { $in: matchingAuthors.map(a => a._id) } });
      }

      // Note: Searching inside 'body' (Tiptap JSON) is complex at the DB level 
      // without MongoDB Atlas Search. Here we search the title/tags/author.
    }

    // 1. Exclusive Interest-based Feed (For You)
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
        } else {
          // If user has no interests, For You is empty
          return NextResponse.json([]);
        }
      }
      // If not logged in, For You is empty
      return NextResponse.json([]);
    }

    // 2. Global Feed or Search (Discover)
    const blogs = await Blog.find(searchFilter)
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

import { NextRequest, NextResponse } from 'next/server';
import Blog from '@/models/Blog';
import { getOrCreateUser } from '@/lib/authHelper';

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const blogs = await Blog.find({ authorId: user._id })
      .sort({ createdAt: -1 })
      .populate('authorId', 'penName profilePicture');

    return NextResponse.json(blogs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

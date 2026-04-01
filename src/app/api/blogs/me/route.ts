import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Blog from '@/models/Blog';
import User from '@/models/User';
import { auth0 } from '@/lib/auth0';

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    let user = await User.findOne({ auth0Id: session.user.sub });
    if (!user) {
      user = await User.create({
        auth0Id: session.user.sub,
        email: session.user.email,
        penName: session.user.nickname || session.user.name || (session.user.email?.split('@')[0] || 'user') + '-' + Math.floor(Math.random() * 1000),
      });
    }

    const blogs = await Blog.find({ authorId: user._id }).sort({ createdAt: -1 }).populate('authorId', 'penName profilePicture');

    return NextResponse.json(blogs);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Favorite from '@/models/Favorite';
import User from '@/models/User';
import Blog from '@/models/Blog';
import { auth0 } from '@/lib/auth0';

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const user = await User.findOne({ auth0Id: session.user.sub });
    
    // Support populating the actual blogs
    const favorites = await Favorite.find({ userId: user._id })
      .populate({
        path: 'blogId',
        model: Blog,
        populate: { path: 'authorId', model: User, select: 'penName profilePicture' }
      })
      .sort({ createdAt: -1 });

    return NextResponse.json(favorites);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    const user = await User.findOne({ auth0Id: session.user.sub });
    const { blogId } = await req.json();

    const existing = await Favorite.findOne({ userId: user._id, blogId });
    if (existing) {
      await Favorite.findByIdAndDelete(existing._id);
      return NextResponse.json({ favorited: false });
    } else {
      await Favorite.create({ userId: user._id, blogId });
      return NextResponse.json({ favorited: true });
    }
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

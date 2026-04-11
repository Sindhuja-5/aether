import { NextRequest, NextResponse } from 'next/server';
import Favorite from '@/models/Favorite';
import Blog from '@/models/Blog';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/authHelper';

export async function GET(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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

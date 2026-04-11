import { NextRequest, NextResponse } from 'next/server';
import User from '@/models/User';
import { getOrCreateUser, getAuthenticatedUser } from '@/lib/authHelper';

export async function GET(req: NextRequest) {
  try {
    const user = await getOrCreateUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json();
    const updated = await User.findByIdAndUpdate(user._id, {
      penName: body.penName,
      firstName: body.firstName,
      lastName: body.lastName,
      profilePicture: body.profilePicture,
      interests: body.interests
    }, { new: true });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

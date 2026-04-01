import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';
import { auth0 } from '@/lib/auth0';

export async function GET(req: NextRequest) {
  try {
    const session = await auth0.getSession();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    await dbConnect();
    let user = await User.findOne({ auth0Id: session.user.sub });
    if (!user) {
      const authUser = session.user;
      const firstName = authUser.given_name || authUser.name?.split(' ')[0] || '';
      const lastName = authUser.family_name || authUser.name?.split(' ').slice(1).join(' ') || '';
      
      // Google-style anonymous nicknames
      const animals = ['Panda', 'Whale', 'Fox', 'Koala', 'Owl', 'Dolphin', 'Tiger', 'Capybara', 'Lemur'];
      const adjectives = ['Curious', 'Happy', 'Wise', 'Swift', 'Sleepy', 'Brave', 'Kind', 'Calm'];
      const randomNick = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;
      
      const finalFirstName = firstName || randomNick;
      const finalPenName = finalFirstName;

      // Initials for avatar
      const initials = (finalFirstName.charAt(0) + (lastName.charAt(0) || '')).toUpperCase();
      const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899'];
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      const defaultAvatar = `https://ui-avatars.com/api/?name=${initials}&background=${randomColor}&color=fff&size=128`;

      user = await User.create({
        auth0Id: session.user.sub,
        email: session.user.email,
        firstName: finalFirstName,
        lastName: lastName,
        penName: finalPenName,
        profilePicture: authUser.picture || defaultAvatar
      });
    }
    return NextResponse.json(user);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
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

import { NextRequest } from 'next/server';
import { auth0 } from '@/lib/auth0';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

/**
 * Retrieves the authenticated user from the request.
 * Returns the user document if the session is valid and the user exists in DB.
 * Returns null if unauthenticated or user not found.
 */
export async function getAuthenticatedUser(req?: NextRequest) {
  const session = await auth0.getSession();
  if (!session?.user) {
    return null;
  }
  await dbConnect();
  const user = await User.findOne({ auth0Id: session.user.sub });
  return user ?? null;
}

/**
 * Like getAuthenticatedUser, but also creates the user record in DB
 * if they have a valid Auth0 session but haven't been seen by our system yet.
 * Use this in routes that serve as the user's "first touch" (e.g. /api/user GET).
 */
export async function getOrCreateUser() {
  const session = await auth0.getSession();
  if (!session?.user) return null;

  await dbConnect();
  const existing = await User.findOne({ auth0Id: session.user.sub });
  if (existing) return existing;

  // Build display name from Auth0 profile
  const authUser = session.user;
  const firstName = authUser.given_name || authUser.name?.split(' ')[0] || '';
  const lastName = authUser.family_name || authUser.name?.split(' ').slice(1).join(' ') || '';

  const animals = ['Panda', 'Whale', 'Fox', 'Koala', 'Owl', 'Dolphin', 'Tiger', 'Capybara', 'Lemur'];
  const adjectives = ['Curious', 'Happy', 'Wise', 'Swift', 'Sleepy', 'Brave', 'Kind', 'Calm'];
  const randomNick = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${animals[Math.floor(Math.random() * animals.length)]}`;

  const finalFirstName = firstName || randomNick;
  const finalLastName = lastName;
  const finalPenName = finalFirstName;

  const initials = (finalFirstName.charAt(0) + (finalLastName.charAt(0) || '')).toUpperCase();
  const colors = ['3B82F6', '10B981', 'F59E0B', 'EF4444', '8B5CF6', 'EC4899'];
  const randomColor = colors[Math.floor(Math.random() * colors.length)];
  const defaultAvatar = `https://ui-avatars.com/api/?name=${initials}&background=${randomColor}&color=fff&size=128`;

  return User.create({
    auth0Id: session.user.sub,
    email: session.user.email,
    firstName: finalFirstName,
    lastName: finalLastName,
    penName: finalPenName,
    profilePicture: authUser.picture || defaultAvatar,
  });
}

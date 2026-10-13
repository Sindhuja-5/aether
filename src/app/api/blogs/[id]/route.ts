import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Blog from '@/models/Blog';
import User from '@/models/User';
import { getAuthenticatedUser } from '@/lib/authHelper';
import { refreshBlogEmbedding, removeBlogEmbedding } from '@/lib/semantic-search-service';
import { classifyStory } from '@/lib/moderation/classifier.mjs';

export const maxDuration = 60;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await dbConnect();
    const p = await params;
    const blog = await Blog.findById(p.id).populate({ path: 'authorId', select: 'penName profilePicture', model: User });
    if (!blog) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(blog);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const p = await params;
    const blog = await Blog.findById(p.id);

    if (!blog || blog.authorId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const input = await req.json();
    const changes: Record<string, unknown> = {};
    for (const field of ['title', 'body', 'previewImage', 'status', 'tags']) {
      if (Object.prototype.hasOwnProperty.call(input, field)) changes[field] = input[field];
    }
    const updatedTitle = typeof changes.title === 'string' ? changes.title : blog.title;
    const updatedBody = Object.prototype.hasOwnProperty.call(changes, 'body') ? changes.body : blog.body;
    const updated = await Blog.findByIdAndUpdate(
      p.id,
      { $set: { ...changes, moderation: await classifyStory(updatedTitle, updatedBody) } },
      { new: true, runValidators: true }
    );
    if (updated) {
      try {
        await refreshBlogEmbedding(updated);
      } catch (error) {
        // Never serve a stale vector when the story has changed.
        await removeBlogEmbedding(String(updated._id)).catch(() => undefined);
        console.error(`Could not refresh the semantic embedding for story ${String(updated._id)}.`, error);
      }
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await getAuthenticatedUser(req);
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const p = await params;
    const blog = await Blog.findById(p.id);

    if (!blog || blog.authorId.toString() !== user._id.toString()) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    await Blog.findByIdAndDelete(p.id);
    await removeBlogEmbedding(p.id).catch((error) => {
      console.error(`Could not remove the semantic embedding for deleted story ${p.id}.`, error);
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}

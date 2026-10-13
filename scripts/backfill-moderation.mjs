import mongoose from 'mongoose';
import { classifyStory } from '../src/lib/moderation/classifier.mjs';

const mongoUri = process.env.MONGODB_URI;
if (!mongoUri) throw new Error('Set MONGODB_URI before running the moderation backfill.');

const applyChanges = process.argv.includes('--apply');
const connection = await mongoose.connect(mongoUri, { family: 4 });
try {
  const collection = connection.connection.collection('blogs');
  const cursor = collection.find({ status: 'published' });
  let scanned = 0;
  let flagged = 0;
  let clear = 0;
  for await (const blog of cursor) {
    const moderation = await classifyStory(blog.title, blog.body);
    scanned += 1;
    if (moderation.status === 'flagged') flagged += 1;
    else clear += 1;
    if (applyChanges) {
      await collection.updateOne({ _id: blog._id }, { $set: { moderation } });
    }
  }
  console.info(JSON.stringify({ mode: applyChanges ? 'apply' : 'dry-run', scanned, flagged, clear }, null, 2));
} finally {
  await mongoose.disconnect();
}

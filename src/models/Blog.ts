import mongoose, { Schema, model, models, Types } from 'mongoose';

export interface IBlog {
  _id?: string;
  authorId: Types.ObjectId;
  title: string;
  body: any; // JSON representation of tiptap content
  previewImage?: string;
  status: 'draft' | 'published';
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const BlogSchema = new Schema<IBlog>(
  {
    authorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 300 },
    body: { type: Schema.Types.Mixed, required: true, default: {} },
    previewImage: { type: String },
    status: { type: String, enum: ['draft', 'published'], default: 'draft' },
    tags: {
      type: [String],
      default: [],
      validate: [
        {
          validator: (v: string[]) => v.length <= 10,
          message: 'Story can have a maximum of 10 tags.'
        }
      ]
    },
  },
  { timestamps: true }
);

const Blog = models.Blog || model<IBlog>('Blog', BlogSchema);
export default Blog;

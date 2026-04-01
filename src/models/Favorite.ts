import mongoose, { Schema, model, models, Types } from 'mongoose';

export interface IFavorite {
  _id?: string;
  userId: Types.ObjectId;
  blogId: Types.ObjectId;
  createdAt: Date;
}

const FavoriteSchema = new Schema<IFavorite>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    blogId: { type: Schema.Types.ObjectId, ref: 'Blog', required: true },
  },
  { timestamps: true }
);

FavoriteSchema.index({ userId: 1, blogId: 1 }, { unique: true });

const Favorite = models.Favorite || model<IFavorite>('Favorite', FavoriteSchema);
export default Favorite;

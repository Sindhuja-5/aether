import mongoose, { Schema, model, models } from 'mongoose';

export interface IUser {
  _id?: string;
  auth0Id: string;
  email: string;
  profilePicture?: string;
  firstName?: string;
  lastName?: string;
  penName: string;
  interests: string[];
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    auth0Id: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    profilePicture: { type: String },
    firstName: { type: String, maxlength: 50 },
    lastName: { type: String, maxlength: 50 },
    penName: { type: String, required: true, unique: true, maxlength: 30 },
    interests: { 
      type: [String], 
      default: [],
      validate: [
        {
          validator: (v: string[]) => v.length <= 15,
          message: 'You can select up to 15 interests.'
        }
      ]
    },
  },
  { timestamps: true }
);

const User = models.User || model<IUser>('User', UserSchema);
export default User;

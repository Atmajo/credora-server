import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganisationApplication extends Document {
  user: mongoose.Types.ObjectId;
  type: 'institution' | 'company';
  description: string;
  document: string;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const OrganisationApplicationSchema: Schema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: ['institution', 'company'],
      required: true,
    },
    description: {
      type: String,
      required: true,
    },
    document: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    rejectionReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model<IOrganisationApplication>(
  'OrganisationApplication',
  OrganisationApplicationSchema
);

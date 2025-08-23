import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganisationApplication extends Document {
  user: mongoose.Types.ObjectId;
  description: string;
  documents: {
    name: string;
    fileUrl: string;
    uploadedAt: Date;
  }[];
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
    description: {
      type: String,
      required: true,
    },
    documents: [
      {
        name: {
          type: String,
          required: true,
        },
        fileUrl: {
          type: String,
          required: true,
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
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

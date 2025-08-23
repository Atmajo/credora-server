import mongoose, { Document, Schema, Model } from 'mongoose';
import { IUser, ICredentialOwnership } from '../types';

export interface IUserDocument extends Omit<IUser, '_id'>, Document {
  toSafeObject(): Omit<IUser, 'credentialsOwned'>;
  addCredential(credential: ICredentialOwnership): Promise<IUserDocument>;
  removeCredential(tokenId: string): Promise<IUserDocument>;
}

export interface IUserModel extends Model<IUserDocument> {
  findByWalletAddress(walletAddress: string): Promise<IUserDocument | null>;
  findByEmail(email: string): Promise<IUserDocument | null>;
  findVerifiedInstitutions(): Promise<IUserDocument[]>;
}

const CredentialOwnershipSchema = new Schema<ICredentialOwnership>(
  {
    tokenId: {
      type: String,
      required: true,
    },
    issuer: {
      type: String,
      required: true,
    },
    credentialType: {
      type: String,
      required: true,
    },
    issueDate: {
      type: Date,
      required: true,
    },
    onChain: {
      type: Boolean,
      required: true,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUserDocument>(
  {
    walletAddress: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v),
        message: 'Invalid Ethereum address format',
      },
    },
    email: {
      type: String,
      unique: true,
      lowercase: true,
      validate: {
        validator: (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
        message: 'Invalid email format',
      },
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    profile: {
      bio: {
        type: String,
        maxlength: 500,
      },
      avatar: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Invalid URL format for avatar',
        },
      },
      linkedin: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Invalid URL format for LinkedIn',
        },
      },
      website: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Invalid URL format for website',
        },
      },
      documents: [String],
    },
    userType: {
      type: String,
      enum: ['user', 'institution', 'employer', 'verifier'],
      required: true,
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isAdmin: {
      type: Boolean,
      default: false,
    },
    credentialsOwned: [CredentialOwnershipSchema],
    preferences: {
      notifications: {
        type: Boolean,
        default: true,
      },
      publicProfile: {
        type: Boolean,
        default: false,
      },
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for efficient queries
UserSchema.index({ walletAddress: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ userType: 1 });
UserSchema.index({ isVerified: 1 });

// Pre-save middleware
UserSchema.pre('save', function (next) {
  if (this.isModified('walletAddress')) {
    this.walletAddress = this.walletAddress.toLowerCase();
  }
  if (this.isModified('email')) {
    this.email = this.email.toLowerCase();
  }
  next();
});

// Instance methods
UserSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.credentialsOwned;
  return obj;
};

UserSchema.methods.addCredential = function (credential: ICredentialOwnership) {
  this.credentialsOwned = this.credentialsOwned || [];
  this.credentialsOwned.push(credential);
  return this.save();
};

UserSchema.methods.removeCredential = function (tokenId: string) {
  this.credentialsOwned = this.credentialsOwned?.filter(
    (cred: ICredentialOwnership) => cred.tokenId !== tokenId
  );
  return this.save();
};

// Static methods
UserSchema.statics.findByWalletAddress = function (walletAddress: string) {
  return this.findOne({ walletAddress: walletAddress.toLowerCase() });
};

UserSchema.statics.findByEmail = function (email: string) {
  return this.findOne({ email: email.toLowerCase() });
};

UserSchema.statics.findVerifiedInstitutions = function () {
  return this.find({
    userType: 'institution',
    isVerified: true,
  }).select('name email walletAddress profile.website');
};

export default mongoose.model<IUserDocument, IUserModel>('User', UserSchema);

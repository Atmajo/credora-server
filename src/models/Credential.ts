import mongoose, { Document, Schema, Model } from 'mongoose';
import { ICredential } from '../types';

export interface ICredentialDocument
  extends Omit<ICredential, '_id'>,
    Document {
  revoke(reason?: string): Promise<ICredentialDocument>;
}

export interface ICredentialModel extends Model<ICredentialDocument> {
  findByTokenId(tokenId: string): Promise<ICredentialDocument | null>;
  findByRecipient(recipientAddress: string): Promise<ICredentialDocument[]>;
  findByIssuer(issuerAddress: string): Promise<ICredentialDocument[]>;
  getIssuerStats(issuerAddress: string): Promise<any>;
  getRecipientStats(recipientAddress: string): Promise<any>;
}

const CredentialSchema = new Schema<ICredentialDocument>(
  {
    tokenId: {
      type: String,
      required: true,
      unique: true,
    },
    issuer: {
      address: {
        type: String,
        required: true,
        validate: {
          validator: (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v),
          message: 'Invalid Ethereum address format',
        },
      },
      name: {
        type: String,
        required: true,
        trim: true,
      },
    },
    recipient: {
      address: {
        type: String,
        required: true,
        validate: {
          validator: (v: string) => /^0x[a-fA-F0-9]{40}$/.test(v),
          message: 'Invalid Ethereum address format',
        },
      },
      name: {
        type: String,
        trim: true,
      },
    },
    credentialData: {
      title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 200,
      },
      description: {
        type: String,
        maxlength: 1000,
      },
      credentialType: {
        type: String,
        required: true,
        enum: ['Degree', 'Certificate', 'Course', 'Workshop', 'License'],
      },
      subject: {
        type: String,
        trim: true,
      },
      grade: {
        type: String,
        trim: true,
      },
      gpa: {
        type: Number,
        min: 0,
        max: 4.0,
      },
      credits: {
        type: Number,
        min: 0,
      },
      skills: [String],
    },
    metadata: {
      ipfsHash: String,
      imageUrl: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Invalid URL format',
        },
      },
      documentUrl: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Invalid URL format',
        },
      },
      verificationUrl: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^https?:\/\/.+/.test(v),
          message: 'Invalid URL format',
        },
      },
    },
    blockchain: {
      transactionHash: {
        type: String,
        validate: {
          validator: (v: string) => !v || /^0x[a-fA-F0-9]{64}$/.test(v),
          message: 'Invalid transaction hash format',
        },
      },
      blockNumber: {
        type: Number,
        min: 0,
      },
      gasUsed: String,
      issueDate: Date,
      expiryDate: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'issued', 'revoked', 'expired'],
      default: 'pending',
    },
    verificationCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    revocationReason: String,
    revokedAt: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc: any, ret: any) {
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Indexes for efficient queries
CredentialSchema.index({ tokenId: 1 });
CredentialSchema.index({ 'recipient.address': 1 });
CredentialSchema.index({ 'issuer.address': 1 });
CredentialSchema.index({ status: 1 });
CredentialSchema.index({ 'credentialData.credentialType': 1 });
CredentialSchema.index({ createdAt: -1 });

// Compound indexes
CredentialSchema.index({ 'recipient.address': 1, status: 1 });
CredentialSchema.index({ 'issuer.address': 1, status: 1 });

// Pre-save middleware
CredentialSchema.pre('save', function (next: any) {
  if (this.isModified('issuer.address')) {
    this.issuer.address = this.issuer.address.toLowerCase();
  }
  if (this.isModified('recipient.address')) {
    this.recipient.address = this.recipient.address.toLowerCase();
  }
  next();
});

// Instance methods
CredentialSchema.methods.revoke = function (reason?: string) {
  this.status = 'revoked';
  this.revocationReason = reason;
  this.revokedAt = new Date();
  return this.save();
};

CredentialSchema.methods.incrementVerificationCount = function () {
  this.verificationCount += 1;
  return this.save();
};

CredentialSchema.methods.isExpired = function (): boolean {
  if (!this.blockchain?.expiryDate) return false;
  return new Date() > this.blockchain.expiryDate;
};

CredentialSchema.methods.isActive = function (): boolean {
  return this.status === 'issued' && !this.isExpired();
};

// Static methods
CredentialSchema.statics.findByTokenId = function (tokenId: string) {
  return this.findOne({ tokenId });
};

CredentialSchema.statics.findByRecipient = function (
  recipientAddress: string,
  status?: string
) {
  const query: any = { 'recipient.address': recipientAddress.toLowerCase() };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

CredentialSchema.statics.findByIssuer = function (
  issuerAddress: string,
  status?: string
) {
  const query: any = { 'issuer.address': issuerAddress.toLowerCase() };
  if (status) query.status = status;
  return this.find(query).sort({ createdAt: -1 });
};

CredentialSchema.statics.getIssuerStats = function (issuerAddress: string) {
  return this.aggregate([
    { $match: { 'issuer.address': issuerAddress.toLowerCase() } },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalVerifications: { $sum: '$verificationCount' },
      },
    },
  ]);
};

CredentialSchema.statics.getRecipientStats = function (
  recipientAddress: string
) {
  return this.aggregate([
    { $match: { 'recipient.address': recipientAddress.toLowerCase() } },
    {
      $group: {
        _id: '$credentialData.credentialType',
        count: { $sum: 1 },
      },
    },
  ]);
};

export default mongoose.model<ICredentialDocument, ICredentialModel>(
  'Credential',
  CredentialSchema
);

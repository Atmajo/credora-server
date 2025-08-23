import { Request } from 'express';
import { IUser } from './index';

// Extend the Express Request interface to include our custom properties
export interface AuthenticatedRequest extends Request {
  user: IUser;
}

export interface SignatureVerificationRequest extends Request {
  verifiedAddress: string;
}

export interface SignatureRequest extends Request {
  body: {
    message: string;
    signature: string;
    walletAddress: string;
  };
}

export interface UpdateProfileRequest extends AuthenticatedRequest {
  body: {
    name?: string;
    email?: string;
    profile?: {
      bio?: string;
      avatar?: string;
      linkedin?: string;
      website?: string;
    };
    preferences?: {
      notifications?: boolean;
      publicProfile?: boolean;
    };
  };
}

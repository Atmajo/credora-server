import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ethers } from 'ethers';
import User from '../models/User';
import { IUser } from '../types';
import {
  AuthenticatedRequest,
  SignatureVerificationRequest,
} from '../types/express';

interface JWTPayload {
  id: string;
  walletAddress: string;
  iat?: number;
  exp?: number;
}

interface SignatureRequest extends Request {
  body: {
    walletAddress: string;
    signature: string;
    message: string;
  };
}

/**
 * JWT Authentication Middleware
 */
export const auth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = req.session.token;

    if (!token) {
      res.status(401).json({ error: 'Authentication token is required' });
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      throw new Error('JWT_SECRET is not defined');
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    const user = await User.findById(decoded.id);

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    // Attach user to request object
    (req as AuthenticatedRequest).user = user;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
};

/**
 * Middleware for wallet signature verification
 */
export const verifySignature = async (
  req: SignatureRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      res.status(400).json({
        error: 'Missing required fields: walletAddress, signature, message',
      });
      return;
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);

    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }

    // Attach verified address to request
    (req as SignatureVerificationRequest).verifiedAddress =
      recoveredAddress.toLowerCase();
    next();
  } catch (error) {
    console.error('Signature verification error:', error);
    res.status(401).json({ error: 'Signature verification failed' });
  }
};

/**
 * Admin authorization middleware
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user?.isAdmin) {
      res.status(403).json({ error: 'Admin access required' });
      return;
    }
    next();
  } catch (error) {
    console.error('Admin auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Institution authorization middleware
 */
export const requireInstitution = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.userType !== 'institution') {
      res.status(403).json({ error: 'Institution access required' });
      return;
    }
    next();
  } catch (error) {
    console.error('Institution auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Verified institution middleware
 */
export const requireVerifiedInstitution = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user?.userType !== 'institution' || !req.user?.isVerified) {
      res.status(403).json({
        error: 'Verified institution access required',
      });
      return;
    }
    next();
  } catch (error) {
    console.error('Verified institution auth error:', error);
    res.status(500).json({ error: 'Authorization check failed' });
  }
};

/**
 * Check if user owns the resource (for user-specific endpoints)
 */
export const requireOwnership = (paramName: string = 'walletAddress') => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const resourceAddress = req.params[paramName]?.toLowerCase();
      const userAddress = req.user?.walletAddress?.toLowerCase();

      if (!resourceAddress || !userAddress) {
        res.status(400).json({ error: 'Invalid request parameters' });
        return;
      }

      if (resourceAddress !== userAddress && !req.user?.isAdmin) {
        res.status(403).json({ error: 'Access denied' });
        return;
      }

      next();
    } catch (error) {
      console.error('Ownership check error:', error);
      res.status(500).json({ error: 'Ownership check failed' });
    }
  };
};

/**
 * Rate limiting middleware for sensitive operations
 */
export const sensitiveOperation = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  // Add any additional checks for sensitive operations
  // This could include checking user's recent activity, etc.
  next();
};

/**
 * Validation middleware to ensure user exists and is active
 */
export const validateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'User not authenticated' });
      return;
    }

    // Refresh user data to ensure it's current
    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      res.status(401).json({ error: 'User no longer exists' });
      return;
    }

    // Update request with fresh user data
    req.user = currentUser;
    next();
  } catch (error) {
    console.error('User validation error:', error);
    res.status(500).json({ error: 'User validation failed' });
  }
};

/**
 * Optional authentication - doesn't fail if no token provided
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      next();
      return;
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      next();
      return;
    }

    const decoded = jwt.verify(token, jwtSecret) as JWTPayload;
    const user = await User.findById(decoded.id);

    if (user) {
      (req as AuthenticatedRequest).user = user;
    }

    next();
  } catch (error) {
    // Don't fail on optional auth errors
    next();
  }
};

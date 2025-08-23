import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { IAuthRequest, IAuthResponse, ILoginChallenge } from '../types';
import { AuthenticatedRequest } from '../types/express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { generateOtp } from '../utils/generate';
import { sendVerificationMail } from '../mails/sendVerificationMail';

declare module 'express-session' {
  interface SessionData {
    token?: string;
    trust?: boolean;
    otp?: string;
    walletAddress?: string;
  }
}

interface LoginRequest extends Request {
  session: Request['session'];
  body: IAuthRequest;
}

interface UpdateProfileRequest extends AuthenticatedRequest {
  body: Partial<{
    name: string;
    email: string;
    profile: {
      bio?: string;
      avatar?: string;
      linkedin?: string;
      website?: string;
    };
    preferences: {
      notifications?: boolean;
      publicProfile?: boolean;
    };
  }>;
}

class AuthController {
  /**
   * Generate login message for wallet signature
   */
  public static generateLoginMessage(
    walletAddress: string,
    nonce: number
  ): string {
    return `Please sign this message to authenticate with Credential Passport.

    Wallet: ${walletAddress}
    Nonce: ${nonce}
    Timestamp: ${Date.now()}

    This request will not trigger a blockchain transaction or cost any gas fees.`;
  }

  /**
   * Get login challenge
   */
  public static async getLoginChallenge(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.body;

      if (!walletAddress) {
        res.status(400).json({ error: 'Wallet address is required' });
        return;
      }

      // Validate wallet address format
      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: 'Invalid wallet address format' });
        return;
      }

      const nonce = Math.floor(Math.random() * 1000000);
      const message = AuthController.generateLoginMessage(walletAddress, nonce);

      const challenge: ILoginChallenge = {
        message,
        nonce,
      };

      res.json(challenge);
    } catch (error) {
      console.error('Login challenge error:', error);
      res.status(500).json({ error: 'Failed to generate challenge' });
    }
  }

  /**
   * Login with wallet signature
   */
  public static async loginWithWallet(
    req: LoginRequest,
    res: Response
  ): Promise<void> {
    try {
      const { email, walletAddress, signature, message, trust } = req.body;

      if (!walletAddress || !signature || !message) {
        res.status(400).json({
          error: 'Missing required fields: walletAddress, signature, message',
        });
        return;
      }

      // Verify signature
      let recoveredAddress: string;
      try {
        recoveredAddress = ethers.verifyMessage(message, signature);
      } catch (error) {
        res.status(401).json({ error: 'Invalid signature format' });
        return;
      }

      if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      // Find or create user
      let user = await User.findByWalletAddress(walletAddress);

      if (!user) {
        user = new User({
          walletAddress: walletAddress.toLowerCase(),
          name: `User_${walletAddress.slice(0, 8)}`,
          email,
          userType: 'user',
          isVerified: false,
        });
        await user.save();
      }

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const tokenPayload = {
        id: user._id,
        walletAddress: user.walletAddress,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '30D',
      });

      req.session.token = token;
      req.session.trust = trust;

      if (!user.isVerified) {
        req.session.otp = generateOtp();
        req.session.walletAddress = user.walletAddress;

        const token = jwt.sign(
          {
            otp: req.session.otp,
            walletAddress: req.session.walletAddress,
          },
          jwtSecret,
          {
            expiresIn: '5M',
          }
        );

        await sendVerificationMail(user.email, token);
      }

      const response: IAuthResponse = {
        success: true,
        user: {
          id: user._id!.toString(),
          walletAddress: user.walletAddress,
          name: user.name,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified,
        },
      };

      res.json(response);
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }

  /**
   * Verify user
   */
  public static async verifyProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { token } = req.query;

      // Generate JWT token
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const { otp, walletAddress } = jwt.verify(
        token as any as string,
        jwtSecret
      ) as { otp: string; walletAddress: string };

      if (!req.session.otp || !req.session.walletAddress) {
        res.status(400).json({ error: 'Invalid session data' });
        return;
      }

      if (
        req.session.otp !== otp ||
        req.session.walletAddress !== walletAddress
      ) {
        res.status(400).json({ error: 'Invalid OTP or wallet address' });
        return;
      }

      const user = await User.findByWalletAddress(walletAddress);
      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      user.isVerified = true;
      await user.save();

      const response: IAuthResponse = {
        success: true,
        user: {
          id: user._id!.toString(),
          walletAddress: user.walletAddress,
          name: user.name,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified,
        },
      };

      res.json(response);
    } catch (error) {
      console.error(error);
      res.status(500).json({ error: 'Failed to verify profile' });
    }
  }

  /**
   * Verify institution or employers
   */
  public static async verifyInstitutionOrEmployer(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
    } catch (error) {
      console.error('Check valid institution or employer error:', error);
      res
        .status(500)
        .json({ error: 'Failed to check valid institution or employer' });
    }
  }

  /**
   * Get current user profile
   */
  public static async getProfile(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user;

      const safeUser = {
        id: user._id?.toString(),
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        userType: user.userType,
        isVerified: user.isVerified,
        profile: user.profile,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      res.json({
        success: true,
        user: safeUser,
      });
    } catch (error) {
      console.error('Get profile error:', error);
      res.status(500).json({ error: 'Failed to get profile' });
    }
  }

  /**
   * Update user profile
   */
  public static async updateProfile(
    req: UpdateProfileRequest,
    res: Response
  ): Promise<void> {
    try {
      const updates = req.body;
      const userId = req.user._id;

      // Validate email if provided
      if (updates.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(updates.email)) {
          res.status(400).json({ error: 'Invalid email format' });
          return;
        }

        // Check if email is already taken by another user
        const existingUser = await User.findByEmail(updates.email);
        if (
          existingUser &&
          existingUser._id!.toString() !== userId!.toString()
        ) {
          res.status(400).json({ error: 'Email already in use' });
          return;
        }
      }

      // Validate name if provided
      if (updates.name) {
        if (updates.name.length < 2 || updates.name.length > 100) {
          res.status(400).json({
            error: 'Name must be between 2 and 100 characters',
          });
          return;
        }
      }

      const user = await User.findByIdAndUpdate(
        userId,
        { $set: updates },
        {
          new: true,
          runValidators: true,
        }
      );

      if (!user) {
        res.status(404).json({ error: 'User not found' });
        return;
      }

      // Create safe user object without sensitive data
      const safeUser = {
        id: user._id?.toString(),
        email: user.email,
        name: user.name,
        walletAddress: user.walletAddress,
        userType: user.userType,
        isVerified: user.isVerified,
        profile: user.profile,
        preferences: user.preferences,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      };

      res.json({
        success: true,
        user: safeUser,
      });
    } catch (error) {
      console.error('Update profile error:', error);
      if ((error as any).code === 11000) {
        res.status(400).json({ error: 'Email already in use' });
      } else {
        res.status(500).json({ error: 'Failed to update profile' });
      }
    }
  }

  /**
   * Refresh JWT token
   */
  public static async refreshToken(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user;
      const jwtSecret = process.env.JWT_SECRET;

      if (!jwtSecret) {
        throw new Error('JWT_SECRET is not configured');
      }

      const tokenPayload = {
        id: user._id,
        walletAddress: user.walletAddress,
      };

      const token = jwt.sign(tokenPayload, jwtSecret, {
        expiresIn: process.env.JWT_EXPIRES_IN || '7d',
      });

      res.json({
        success: true,
        token,
        user: {
          id: user._id!.toString(),
          walletAddress: user.walletAddress,
          name: user.name,
          email: user.email,
          userType: user.userType,
          isVerified: user.isVerified,
        },
      });
    } catch (error) {
      console.error('Token refresh error:', error);
      res.status(500).json({ error: 'Failed to refresh token' });
    }
  }

  /**
   * Logout (client-side token removal)
   */
  public static async logout(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      // Since we're using stateless JWT, logout is primarily client-side
      // We could implement a token blacklist here if needed
      res.json({
        success: true,
        message: 'Logged out successfully',
      });
    } catch (error) {
      console.error('Logout error:', error);
      res.status(500).json({ error: 'Logout failed' });
    }
  }

  /**
   * Delete user account
   */
  public static async deleteAccount(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const userId = req.user._id;

      // Note: In a production system, you might want to:
      // 1. Revoke all issued credentials
      // 2. Archive user data instead of deleting
      // 3. Handle cleanup of related data

      await User.findByIdAndDelete(userId);

      res.json({
        success: true,
        message: 'Account deleted successfully',
      });
    } catch (error) {
      console.error('Delete account error:', error);
      res.status(500).json({ error: 'Failed to delete account' });
    }
  }

  /**
   * Check if wallet address is available for registration
   */
  public static async checkWalletAvailability(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.params;

      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: 'Invalid wallet address format' });
        return;
      }

      const existingUser = await User.findByWalletAddress(walletAddress);

      res.json({
        available: !existingUser,
        registered: !!existingUser,
      });
    } catch (error) {
      console.error('Wallet availability check error:', error);
      res.status(500).json({ error: 'Failed to check wallet availability' });
    }
  }

  /**
   * Check if email is available for registration
   */
  public static async checkEmailAvailability(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { email } = req.params;

      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({ error: 'Invalid email format' });
        return;
      }

      const existingUser = await User.findByEmail(email);

      res.json({
        available: !existingUser,
        registered: !!existingUser,
      });
    } catch (error) {
      console.error('Email availability check error:', error);
      res.status(500).json({ error: 'Failed to check email availability' });
    }
  }
}

export default AuthController;

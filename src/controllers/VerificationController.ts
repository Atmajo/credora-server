import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { AuthenticatedRequest } from '../types/express';
import blockchain from '../config/blockchain';
import Credential from '../models/Credential';
import { IVerificationResult } from '../types';

interface VerifyCredentialRequest extends Request {
  body: {
    tokenId: string;
    verifierAddress?: string;
  };
}

interface BatchVerifyRequest extends Request {
  body: {
    tokenIds: string[];
    verifierAddress?: string;
  };
}

interface CreateVerificationRequest extends AuthenticatedRequest {
  body: {
    tokenId: string;
    verificationData: {
      purpose: string;
      scope: string;
      requiredFields?: string[];
    };
  };
}

class VerificationController {
  /**
   * Verify a credential on blockchain
   */
  public static async verifyCredential(
    req: VerifyCredentialRequest,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId, verifierAddress } = req.body;

      if (!tokenId) {
        res.status(400).json({ error: 'Token ID is required' });
        return;
      }

      // Check if credential exists on blockchain
      let credentialExists = false;
      let credentialData: any = null;
      let owner: string = '';

      try {
        // Check if token exists
        owner = await blockchain.credentialContract.ownerOf(tokenId);
        credentialExists = true;

        // Get token URI and metadata
        const tokenURI = await blockchain.credentialContract.tokenURI(tokenId);
        
        // If using IPFS, you might want to fetch the metadata
        credentialData = {
          tokenId,
          owner,
          tokenURI,
        };

      } catch (error) {
        console.log('Credential not found on blockchain:', error);
      }

      // Get credential from database for additional verification
      const dbCredential = await Credential.findOne({ tokenId });

      if (!credentialExists && !dbCredential) {
        res.status(404).json({ 
          error: 'Credential not found',
          tokenId 
        });
        return;
      }

      // Verify credential integrity
      const verificationResult: IVerificationResult = {
        isValid: credentialExists,
        exists: credentialExists,
        tokenId,
        issuer: {
          address: dbCredential?.issuer?.address || '',
          name: dbCredential?.issuer?.name || '',
        },
        recipient: {
          address: owner || dbCredential?.recipient?.address || '',
        },
        credentialType: dbCredential?.credentialData?.credentialType || '',
        issueDate: dbCredential?.blockchain?.issueDate || new Date(),
        status: {
          expired: false,
          revoked: false,
          message: 'Valid',
        },
        verificationTimestamp: new Date(),
      };

      // Check if credential is expired
      if (dbCredential?.blockchain?.expiryDate) {
        const now = new Date();
        const expiryDate = new Date(dbCredential.blockchain.expiryDate);
        verificationResult.status.expired = now > expiryDate;
        verificationResult.isValid = verificationResult.isValid && !verificationResult.status.expired;
        if (verificationResult.status.expired) {
          verificationResult.status.message = 'Credential has expired';
        }
      }

      // Check if credential is revoked
      if (dbCredential?.status === 'revoked') {
        verificationResult.isValid = false;
        verificationResult.status.revoked = true;
        verificationResult.status.message = `Credential revoked: ${dbCredential.revocationReason || 'No reason provided'}`;
      }

      // Verify issuer authorization
      let issuerVerified = false;
      if (dbCredential?.issuer?.address) {
        try {
          issuerVerified = await blockchain.registryContract.isAuthorizedIssuer(
            dbCredential.issuer.address
          );
          
          if (!issuerVerified) {
            verificationResult.isValid = false;
            verificationResult.status.message = 'Issuer is not authorized';
          }
        } catch (error) {
          console.log('Error verifying issuer:', error);
        }
      }

      // Record verification event if verifier address is provided
      if (verifierAddress && credentialExists) {
        try {
          // You might want to record this verification on-chain or in database
          if (dbCredential) {
            dbCredential.verificationCount += 1;
            await dbCredential.save();
          }
        } catch (error) {
          console.log('Error recording verification:', error);
        }
      }

      res.json({
        success: true,
        verification: verificationResult,
        credential: credentialData,
        metadata: dbCredential ? {
          title: dbCredential.credentialData.title,
          type: dbCredential.credentialData.credentialType,
          issuerName: dbCredential.issuer.name,
          recipientName: dbCredential.recipient.name,
        } : null,
      });

    } catch (error) {
      console.error('Verify credential error:', error);
      res.status(500).json({ 
        error: 'Failed to verify credential',
        details: (error as Error).message 
      });
    }
  }

  /**
   * Batch verify multiple credentials
   */
  public static async batchVerifyCredentials(
    req: BatchVerifyRequest,
    res: Response
  ): Promise<void> {
    try {
      const { tokenIds, verifierAddress } = req.body;

      if (!Array.isArray(tokenIds) || tokenIds.length === 0) {
        res.status(400).json({ error: 'Token IDs array is required' });
        return;
      }

      if (tokenIds.length > 50) {
        res.status(400).json({ error: 'Maximum 50 credentials can be verified at once' });
        return;
      }

      const verificationResults: any[] = [];

      for (const tokenId of tokenIds) {
        try {
          // Verify each credential
          let credentialExists = false;
          let owner: string = '';

          try {
            owner = await blockchain.credentialContract.ownerOf(tokenId);
            credentialExists = true;
          } catch (error) {
            // Credential doesn't exist on blockchain
          }

          const dbCredential = await Credential.findOne({ tokenId });

          const result = {
            tokenId,
            isValid: credentialExists,
            exists: credentialExists,
            owner: owner || null,
            status: dbCredential?.status || 'unknown',
            issuer: dbCredential?.issuer?.address || null,
          };

          // Quick validation checks
          if (dbCredential?.status === 'revoked') {
            result.isValid = false;
          }

          if (dbCredential?.blockchain?.expiryDate) {
            const now = new Date();
            const expiryDate = new Date(dbCredential.blockchain.expiryDate);
            if (now > expiryDate) {
              result.isValid = false;
            }
          }

          verificationResults.push(result);

        } catch (error) {
          verificationResults.push({
            tokenId,
            isValid: false,
            error: (error as Error).message,
          });
        }
      }

      const validCount = verificationResults.filter(r => r.isValid).length;
      const invalidCount = verificationResults.length - validCount;

      res.json({
        success: true,
        batchVerification: {
          total: verificationResults.length,
          valid: validCount,
          invalid: invalidCount,
          results: verificationResults,
        },
        timestamp: new Date(),
      });

    } catch (error) {
      console.error('Batch verify credentials error:', error);
      res.status(500).json({ 
        error: 'Failed to batch verify credentials' 
      });
    }
  }

  /**
   * Get credential verification history
   */
  public static async getVerificationHistory(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const credential = await Credential.findOne({ tokenId });

      if (!credential) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      // In a full implementation, you'd have a separate verification logs collection
      // For now, we'll return basic information
      const history = {
        tokenId,
        totalVerifications: credential.verificationCount,
        lastVerified: credential.updatedAt,
        // In production, you'd query verification events from blockchain or database
        verifications: [],
      };

      res.json({
        success: true,
        history,
      });

    } catch (error) {
      console.error('Get verification history error:', error);
      res.status(500).json({ 
        error: 'Failed to get verification history' 
      });
    }
  }

  /**
   * Verify issuer authority
   */
  public static async verifyIssuerAuthority(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { issuerAddress } = req.params;

      if (!ethers.isAddress(issuerAddress)) {
        res.status(400).json({ error: 'Invalid issuer address format' });
        return;
      }

      const isAuthorized = await blockchain.registryContract.isAuthorizedIssuer(
        issuerAddress
      );

      let institutionData = null;
      if (isAuthorized) {
        try {
          institutionData = await blockchain.registryContract.getInstitution(
            issuerAddress
          );
        } catch (error) {
          console.log('Could not fetch institution data:', error);
        }
      }

      res.json({
        success: true,
        issuerAddress,
        isAuthorized,
        institution: institutionData ? {
          name: institutionData.name,
          description: institutionData.description,
          website: institutionData.website,
          isVerified: institutionData.isVerified,
          registrationDate: new Date(Number(institutionData.registrationDate) * 1000),
        } : null,
      });

    } catch (error) {
      console.error('Verify issuer authority error:', error);
      res.status(500).json({ 
        error: 'Failed to verify issuer authority' 
      });
    }
  }

  /**
   * Create verification request (for verifiers who want to verify credentials)
   */
  public static async createVerificationRequest(
    req: CreateVerificationRequest,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId, verificationData } = req.body;
      const verifier = req.user;

      if (!tokenId || !verificationData) {
        res.status(400).json({ 
          error: 'Token ID and verification data are required' 
        });
        return;
      }

      // Check if credential exists
      const credential = await Credential.findOne({ tokenId });
      if (!credential) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      // In a full implementation, you might store verification requests
      // and allow credential owners to approve/deny them
      const verificationRequest = {
        id: `vr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        tokenId,
        verifier: {
          address: verifier.walletAddress,
          name: verifier.name,
        },
        purpose: verificationData.purpose,
        scope: verificationData.scope,
        requiredFields: verificationData.requiredFields || [],
        status: 'pending',
        createdAt: new Date(),
      };

      // In production, you'd save this to a database and possibly notify the credential owner

      res.json({
        success: true,
        verificationRequest,
        message: 'Verification request created successfully',
      });

    } catch (error) {
      console.error('Create verification request error:', error);
      res.status(500).json({ 
        error: 'Failed to create verification request' 
      });
    }
  }

  /**
   * Get verification statistics
   */
  public static async getVerificationStats(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Get various statistics about verifications
      const totalCredentials = await Credential.countDocuments();
      const activeCredentials = await Credential.countDocuments({ 
        status: 'issued' 
      });
      const revokedCredentials = await Credential.countDocuments({ 
        status: 'revoked' 
      });

      // Get total verification count
      const verificationStats = await Credential.aggregate([
        {
          $group: {
            _id: null,
            totalVerifications: { $sum: '$verificationCount' },
            avgVerificationsPerCredential: { $avg: '$verificationCount' },
          }
        }
      ]);

      const stats = {
        credentials: {
          total: totalCredentials,
          active: activeCredentials,
          revoked: revokedCredentials,
          expired: 0, // Would need to calculate based on expiry dates
        },
        verifications: {
          total: verificationStats[0]?.totalVerifications || 0,
          average: verificationStats[0]?.avgVerificationsPerCredential || 0,
        },
        timestamp: new Date(),
      };

      res.json({
        success: true,
        stats,
      });

    } catch (error) {
      console.error('Get verification stats error:', error);
      res.status(500).json({ 
        error: 'Failed to get verification statistics' 
      });
    }
  }
}

export default VerificationController;

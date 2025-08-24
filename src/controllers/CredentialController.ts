import { Request, Response } from 'express';
import Credential from '../models/Credential';
import User from '../models/User';
import blockchain from '../config/blockchain';
import ipfsService from '../utils/ipfs';
import qrService from '../utils/qrcode';
import { AuthenticatedRequest } from '../types/express';
import {
  ICredentialMetadata,
  IVerificationResult,
  IBatchCredentialRequest,
} from '../types';

interface IssueCredentialRequest extends AuthenticatedRequest {
  body: {
    recipientAddress: string;
    recipientName?: string;
    credentialData: {
      title: string;
      description?: string;
      credentialType:
        | 'Degree'
        | 'Certificate'
        | 'Course'
        | 'Workshop'
        | 'License';
      subject?: string;
      grade?: string;
      gpa?: number;
      credits?: number;
      skills?: string[];
      imageUrl?: string;
    };
    expiryDate?: number; // Unix timestamp
  };
}

interface BatchIssueRequest extends AuthenticatedRequest {
  body: {
    credentials: IBatchCredentialRequest[];
  };
}

interface RevokeCredentialRequest extends AuthenticatedRequest {
  body: {
    reason?: string;
  };
}

class CredentialController {
  /**
   * Issue a new credential
   */
  public static async issueCredential(
    req: IssueCredentialRequest,
    res: Response
  ): Promise<void> {
    try {
      const { recipientAddress, recipientName, credentialData, expiryDate } =
        req.body;
      const issuerAddress = req.user.walletAddress;

      // Validate recipient address
      if (!/^0x[a-fA-F0-9]{40}$/.test(recipientAddress)) {
        res.status(400).json({ error: 'Invalid recipient address format' });
        return;
      }

      // Verify issuer is authorized
      const isAuthorized =
        await blockchain.registryContract.isAuthorizedIssuer(issuerAddress);
      if (!isAuthorized) {
        res.status(403).json({ error: 'Not authorized to issue credentials' });
        return;
      }

      // Create metadata object
      const metadata: ICredentialMetadata = {
        name: credentialData.title,
        description: credentialData.description || '',
        image: credentialData.imageUrl || '',
        attributes: [
          {
            trait_type: 'Credential Type',
            value: credentialData.credentialType,
          },
          { trait_type: 'Subject', value: credentialData.subject || '' },
          { trait_type: 'Issuer', value: req.user.name },
          { trait_type: 'Issue Date', value: new Date().toISOString() },
        ],
      };

      if (credentialData.grade) {
        metadata.attributes.push({
          trait_type: 'Grade',
          value: credentialData.grade,
        });
      }

      if (credentialData.gpa) {
        metadata.attributes.push({
          trait_type: 'GPA',
          value: credentialData.gpa.toString(),
        });
      }

      if (credentialData.skills && credentialData.skills.length > 0) {
        metadata.attributes.push({
          trait_type: 'Skills',
          value: credentialData.skills.join(', '),
        });
      }

      // Store metadata on IPFS
      console.log('📤 Storing credential metadata on IPFS...');
      const ipfsHash = await ipfsService.uploadMetadata(metadata);
      const tokenURI = ipfsService.getPublicUrl(ipfsHash);
      console.log('✅ Metadata stored on IPFS with hash:', ipfsHash);

      // Issue credential on blockchain
      console.log('⛓️ Issuing credential on blockchain...');
      const tx = await blockchain.credentialContract.issueCredential(
        recipientAddress,
        credentialData.credentialType,
        req.user.name,
        expiryDate || 0,
        ipfsHash,
        tokenURI
      );

      console.log('⏳ Waiting for transaction confirmation...');
      const receipt = await tx.wait();
      console.log('✅ Blockchain transaction confirmed:', tx.hash);
      
      // Parse the transaction logs to get the token ID
      let tokenId: string | null = null;
      
      for (const log of receipt.logs) {
        try {
          // Parse the log using the contract interface
          const parsedLog = blockchain.credentialContract.interface.parseLog({
            topics: [...log.topics],
            data: log.data
          });
          
          if (parsedLog && parsedLog.name === 'CredentialIssued') {
            tokenId = parsedLog.args.tokenId.toString();
            console.log('🎯 Token ID extracted from event:', tokenId);
            break;
          }
        } catch (parseError) {
          // Skip logs that don't match our contract interface
          continue;
        }
      }
      
      if (!tokenId) {
        console.error('❌ Failed to parse CredentialIssued event from logs');
        console.log('📋 Receipt logs:', receipt.logs);
        throw new Error('Failed to get token ID from transaction receipt');
      }
      
      // Save to database
      const credential = new Credential({
        tokenId,
        issuer: {
          address: issuerAddress,
          name: req.user.name,
        },
        recipient: {
          address: recipientAddress.toLowerCase(),
          name: recipientName,
        },
        credentialData,
        metadata: {
          ipfsHash,
          imageUrl: credentialData.imageUrl,
          verificationUrl: `${process.env.FRONTEND_URL}/verify/${tokenId}`,
        },
        blockchain: {
          transactionHash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed.toString(),
          issueDate: new Date(),
          expiryDate: expiryDate ? new Date(expiryDate * 1000) : undefined,
        },
        status: 'issued',
      });

      await credential.save();
      
      // Update user's credential list
      await User.findOneAndUpdate(
        { walletAddress: recipientAddress.toLowerCase() },
        {
          $push: {
            credentialsOwned: {
              tokenId,
              issuer: issuerAddress,
              credentialType: credentialData.credentialType,
              issueDate: new Date(),
              onChain: true,
            },
          },
        },
        { upsert: true }
      );

      // Generate QR code for easy sharing
      const qrCode = await qrService.generateQR(tokenId);

      res.status(201).json({
        success: true,
        credential: {
          ...credential.toObject(),
          qrCode,
        },
        transactionHash: tx.hash,
      });
    } catch (error) {
      console.error('Error issuing credential:', error);
      res.status(500).json({
        error: 'Failed to issue credential',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Batch issue credentials
   */
  public static async batchIssueCredentials(
    req: BatchIssueRequest,
    res: Response
  ): Promise<void> {
    try {
      const { credentials } = req.body;
      const issuerAddress = req.user.walletAddress;

      if (!Array.isArray(credentials) || credentials.length === 0) {
        res
          .status(400)
          .json({ error: 'Credentials array is required and cannot be empty' });
        return;
      }

      // Verify issuer authorization
      const isAuthorized =
        await blockchain.registryContract.isAuthorizedIssuer(issuerAddress);
      if (!isAuthorized) {
        res.status(403).json({ error: 'Not authorized to issue credentials' });
        return;
      }

      const results: string[] = [];
      const recipients: string[] = [];
      const types: string[] = [];
      const ipfsHashes: string[] = [];
      const tokenURIs: string[] = [];

      // Process each credential
      for (const credData of credentials) {
        // Validate recipient address
        if (!/^0x[a-fA-F0-9]{40}$/.test(credData.recipientAddress)) {
          res.status(400).json({
            error: `Invalid recipient address format: ${credData.recipientAddress}`,
          });
          return;
        }

        const metadata: ICredentialMetadata = {
          name: credData.title,
          description: credData.description || '',
          attributes: [
            { trait_type: 'Credential Type', value: credData.credentialType },
            { trait_type: 'Subject', value: credData.subject || '' },
            { trait_type: 'Issuer', value: req.user.name },
            { trait_type: 'Issue Date', value: new Date().toISOString() },
          ],
        };

        if (credData.skills && credData.skills.length > 0) {
          metadata.attributes.push({
            trait_type: 'Skills',
            value: credData.skills.join(', '),
          });
        }

        const ipfsHash = await ipfsService.uploadMetadata(metadata);
        const tokenURI = ipfsService.getPublicUrl(ipfsHash);

        recipients.push(credData.recipientAddress.toLowerCase());
        types.push(credData.credentialType);
        ipfsHashes.push(ipfsHash);
        tokenURIs.push(tokenURI);
      }

      // Batch mint on blockchain
      const tx = await blockchain.credentialContract.batchIssueCredentials(
        recipients,
        types,
        req.user.name,
        0, // No expiry for batch
        ipfsHashes,
        tokenURIs
      );

      const receipt = await tx.wait();

      res.json({
        success: true,
        transactionHash: tx.hash,
        credentialsIssued: credentials.length,
        gasUsed: receipt.gasUsed.toString(),
        recipients: recipients,
      });
    } catch (error) {
      console.error('Batch issue error:', error);
      res.status(500).json({
        error: 'Failed to batch issue credentials',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Verify a credential
   */
  public static async verifyCredential(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId } = req.params;

      if (!tokenId || isNaN(Number(tokenId))) {
        res.status(400).json({ error: 'Valid token ID is required' });
        return;
      }

      // Get verification result from blockchain
      const verificationResult =
        await blockchain.verificationContract.verifyCredentialDetailed(tokenId);

      // Update verification count in database
      await Credential.findOneAndUpdate(
        { tokenId },
        { $inc: { verificationCount: 1 } }
      );

      // Get additional metadata from database
      const credential = await Credential.findByTokenId(tokenId);

      const response: IVerificationResult = {
        isValid: verificationResult.isValid,
        exists: verificationResult.exists,
        tokenId,
        issuer: {
          address: verificationResult.issuer,
          name: verificationResult.institutionName,
        },
        recipient: {
          address: verificationResult.recipient,
        },
        credentialType: verificationResult.credentialType,
        issueDate: new Date(Number(verificationResult.issueDate) * 1000),
        status: {
          expired: verificationResult.expired,
          revoked: verificationResult.revoked,
          message: verificationResult.message,
        },
        metadata: credential?.metadata || null,
        verificationTimestamp: new Date(),
      };

      res.json(response);
    } catch (error) {
      console.error('Verification error:', error);
      res.status(500).json({
        error: 'Failed to verify credential',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get user's credentials
   */
  public static async getUserCredentials(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.params;

      if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
        res.status(400).json({ error: 'Invalid wallet address format' });
        return;
      }

      // Get credentials from blockchain
      const tokenIds =
        await blockchain.credentialContract.getUserCredentials(walletAddress);

      // Get detailed information from database
      const credentials = await Credential.findByRecipient(walletAddress);

      res.json({
        success: true,
        count: credentials.length,
        credentials,
        onChainTokenIds: tokenIds.map((id: any) => id.toString()),
      });
    } catch (error) {
      console.error('Error fetching user credentials:', error);
      res.status(500).json({
        error: 'Failed to fetch credentials',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get credentials issued by an institution
   */
  public static async getIssuedCredentials(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const issuerAddress = req.user.walletAddress;
      const { status, page = 1, limit = 10 } = req.query;

      const pageNum = parseInt(page as string);
      const limitNum = parseInt(limit as string);

      if (pageNum < 1 || limitNum < 1 || limitNum > 100) {
        res.status(400).json({ error: 'Invalid pagination parameters' });
        return;
      }

      const skip = (pageNum - 1) * limitNum;

      // Build query
      const query: any = { 'issuer.address': issuerAddress };
      if (status && typeof status === 'string') {
        query.status = status;
      }

      // Get total count for pagination
      const totalCount = await Credential.countDocuments(query);

      // Get credentials with pagination
      const credentials = await Credential.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum);

      res.json({
        success: true,
        credentials,
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalItems: totalCount,
          hasNext: pageNum * limitNum < totalCount,
          hasPrev: pageNum > 1,
        },
      });
    } catch (error) {
      console.error('Error fetching issued credentials:', error);
      res.status(500).json({
        error: 'Failed to fetch issued credentials',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Revoke a credential
   */
  public static async revokeCredential(
    req: RevokeCredentialRequest,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId } = req.params;
      const { reason } = req.body;

      if (!tokenId || isNaN(Number(tokenId))) {
        res.status(400).json({ error: 'Valid token ID is required' });
        return;
      }

      // Check if credential exists and belongs to the issuer
      const credential = await Credential.findByTokenId(tokenId);
      if (!credential) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      if (credential.issuer.address !== req.user.walletAddress) {
        res
          .status(403)
          .json({ error: 'Only the issuer can revoke this credential' });
        return;
      }

      if (credential.status === 'revoked') {
        res.status(400).json({ error: 'Credential is already revoked' });
        return;
      }

      // Revoke on blockchain (only issuer can do this)
      const tx = await blockchain.credentialContract.revokeCredential(tokenId);
      await tx.wait();

      // Update database
      await credential.revoke(reason);

      res.json({
        success: true,
        message: 'Credential revoked successfully',
        transactionHash: tx.hash,
      });
    } catch (error) {
      console.error('Revocation error:', error);
      res.status(500).json({
        error: 'Failed to revoke credential',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Get credential details by token ID
   */
  public static async getCredentialDetails(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId } = req.params;

      if (!tokenId || isNaN(Number(tokenId))) {
        res.status(400).json({ error: 'Valid token ID is required' });
        return;
      }

      const credential = await Credential.findByTokenId(tokenId);

      if (!credential) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      // Generate fresh QR code
      const qrCode = await qrService.generateQR(tokenId);

      res.json({
        success: true,
        credential: {
          ...credential.toObject(),
          qrCode,
        },
      });
    } catch (error) {
      console.error('Error fetching credential details:', error);
      res.status(500).json({
        error: 'Failed to fetch credential details',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }

  /**
   * Generate QR code for a credential
   */
  public static async generateCredentialQR(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { tokenId } = req.params;
      const { format = 'png', size = 300 } = req.query;

      if (!tokenId || isNaN(Number(tokenId))) {
        res.status(400).json({ error: 'Valid token ID is required' });
        return;
      }

      const sizeNum = parseInt(size as string);
      if (sizeNum < 100 || sizeNum > 1000) {
        res
          .status(400)
          .json({ error: 'Size must be between 100 and 1000 pixels' });
        return;
      }

      // Check if credential exists
      const credential = await Credential.findByTokenId(tokenId);
      if (!credential) {
        res.status(404).json({ error: 'Credential not found' });
        return;
      }

      let qrCode: string;

      if (format === 'svg') {
        qrCode = await qrService.generateQRSVG(tokenId, { width: sizeNum });
        res.setHeader('Content-Type', 'image/svg+xml');
        res.send(qrCode);
      } else {
        qrCode = await qrService.generateQR(tokenId, { width: sizeNum });
        res.json({
          success: true,
          qrCode,
          verificationUrl: `${process.env.FRONTEND_URL}/verify/${tokenId}`,
        });
      }
    } catch (error) {
      console.error('QR generation error:', error);
      res.status(500).json({
        error: 'Failed to generate QR code',
        details:
          process.env.NODE_ENV === 'development'
            ? (error as Error).message
            : undefined,
      });
    }
  }
}

export default CredentialController;

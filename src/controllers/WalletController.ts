import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { AuthenticatedRequest } from '../types/express';
import blockchain from '../config/blockchain';
import User from '../models/User';

interface ImportWalletRequest extends AuthenticatedRequest {
  body: {
    privateKey: string;
    walletName?: string;
  };
}

interface SignMessageRequest extends AuthenticatedRequest {
  body: {
    message: string;
    privateKey?: string; // Optional if using server wallet
  };
}

interface TransferRequest extends AuthenticatedRequest {
  body: {
    to: string;
    amount: string; // in ETH
    privateKey?: string;
  };
}

class WalletController {
  /**
   * Get wallet information for the authenticated user
   */
  public static async getWalletInfo(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.user;

      // Get balance
      const balance = await blockchain.provider.getBalance(walletAddress);
      const balanceInEth = ethers.formatEther(balance);

      // Get transaction count (nonce)
      const transactionCount = await blockchain.provider.getTransactionCount(
        walletAddress
      );

      // Check if wallet is authorized issuer
      const isAuthorizedIssuer = await blockchain.registryContract.isAuthorizedIssuer(
        walletAddress
      );

      // Get credential count (if any)
      let credentialCount = 0;
      try {
        credentialCount = await blockchain.credentialContract.balanceOf(walletAddress);
      } catch (error) {
        console.log('Could not fetch credential count:', error);
      }

      res.json({
        success: true,
        wallet: {
          address: walletAddress,
          balance: balanceInEth,
          transactionCount,
          isAuthorizedIssuer,
          credentialCount: credentialCount.toString(),
        },
      });

    } catch (error) {
      console.error('Get wallet info error:', error);
      res.status(500).json({ 
        error: 'Failed to get wallet information' 
      });
    }
  }

  /**
   * Validate wallet address format
   */
  public static async validateWalletAddress(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { address } = req.params;

      const isValid = ethers.isAddress(address);
      
      let additionalInfo = null;
      if (isValid) {
        try {
          const balance = await blockchain.provider.getBalance(address);
          const balanceInEth = ethers.formatEther(balance);
          
          additionalInfo = {
            balance: balanceInEth,
            hasBalance: parseFloat(balanceInEth) > 0,
          };
        } catch (error) {
          console.log('Could not fetch additional wallet info:', error);
        }
      }

      res.json({
        success: true,
        isValid,
        address: isValid ? ethers.getAddress(address) : null, // Checksummed address
        additionalInfo,
      });

    } catch (error) {
      console.error('Validate wallet address error:', error);
      res.status(500).json({ 
        error: 'Failed to validate wallet address' 
      });
    }
  }

  /**
   * Sign a message with user's wallet
   */
  public static async signMessage(
    req: SignMessageRequest,
    res: Response
  ): Promise<void> {
    try {
      const { message, privateKey } = req.body;
      const user = req.user;

      if (!message) {
        res.status(400).json({ error: 'Message is required' });
        return;
      }

      let wallet;
      if (privateKey) {
        // Use provided private key
        try {
          wallet = new ethers.Wallet(privateKey, blockchain.provider);
          
          // Verify the wallet matches the user's address
          if (wallet.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
            res.status(400).json({ 
              error: 'Private key does not match user wallet address' 
            });
            return;
          }
        } catch (error) {
          res.status(400).json({ error: 'Invalid private key format' });
          return;
        }
      } else {
        // Use server wallet (only if it matches the user)
        if (blockchain.wallet.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
          res.status(400).json({ 
            error: 'Server wallet does not match user address. Please provide private key.' 
          });
          return;
        }
        wallet = blockchain.wallet;
      }

      const signature = await wallet.signMessage(message);
      
      // Verify the signature
      const recoveredAddress = ethers.verifyMessage(message, signature);
      
      res.json({
        success: true,
        signature,
        message,
        signerAddress: wallet.address,
        verified: recoveredAddress.toLowerCase() === wallet.address.toLowerCase(),
      });

    } catch (error) {
      console.error('Sign message error:', error);
      res.status(500).json({ 
        error: 'Failed to sign message',
        details: (error as Error).message 
      });
    }
  }

  /**
   * Get transaction history for wallet
   */
  public static async getTransactionHistory(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.user;
      const { limit = 10, offset = 0 } = req.query;

      const currentBlock = await blockchain.getCurrentBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 10000); // Last ~10k blocks

      // This is a simplified version - in production you'd want to use
      // indexing services like The Graph or Alchemy for better performance
      const filter = {
        fromBlock,
        toBlock: 'latest',
        address: null, // Will be set based on contract
      };

      const transactions: any[] = [];

      // Get credential-related transactions
      try {
        const credentialEvents = await blockchain.credentialContract.queryFilter(
          '*',
          fromBlock,
          'latest'
        );

        const userEvents = credentialEvents.filter(event => {
          const eventLog = event as any;
          return eventLog.args && (
            eventLog.args.to?.toLowerCase() === walletAddress.toLowerCase() ||
            eventLog.args.from?.toLowerCase() === walletAddress.toLowerCase() ||
            eventLog.args.issuer?.toLowerCase() === walletAddress.toLowerCase()
          );
        });

        transactions.push(...userEvents.map(event => {
          const eventLog = event as any;
          return {
            type: 'credential',
            event: eventLog.fragment?.name || 'Unknown',
            transactionHash: event.transactionHash,
            blockNumber: event.blockNumber,
            timestamp: null, // Would need to fetch block for timestamp
            args: eventLog.args || {},
          };
        }));
      } catch (error) {
        console.log('Error fetching credential events:', error);
      }

      // Sort by block number (descending)
      transactions.sort((a, b) => b.blockNumber - a.blockNumber);

      // Apply pagination
      const paginatedTransactions = transactions.slice(
        Number(offset),
        Number(offset) + Number(limit)
      );

      res.json({
        success: true,
        transactions: paginatedTransactions,
        total: transactions.length,
        limit: Number(limit),
        offset: Number(offset),
      });

    } catch (error) {
      console.error('Get transaction history error:', error);
      res.status(500).json({ 
        error: 'Failed to get transaction history' 
      });
    }
  }

  /**
   * Estimate gas for a potential transaction
   */
  public static async estimateTransactionGas(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { to, value, data } = req.body;

      if (!ethers.isAddress(to)) {
        res.status(400).json({ error: 'Invalid recipient address' });
        return;
      }

      const transaction = {
        to,
        value: value ? ethers.parseEther(value) : 0,
        data: data || '0x',
      };

      const gasEstimate = await blockchain.provider.estimateGas(transaction);
      const feeData = await blockchain.provider.getFeeData();

      const gasPrice = feeData.gasPrice || BigInt(0);
      const maxFeePerGas = feeData.maxFeePerGas;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

      const estimatedCost = gasEstimate * gasPrice;

      res.json({
        success: true,
        gasEstimate: {
          gasLimit: gasEstimate.toString(),
          gasPrice: gasPrice.toString(),
          maxFeePerGas: maxFeePerGas?.toString(),
          maxPriorityFeePerGas: maxPriorityFeePerGas?.toString(),
          estimatedCost: ethers.formatEther(estimatedCost),
        },
      });

    } catch (error) {
      console.error('Estimate transaction gas error:', error);
      res.status(500).json({ 
        error: 'Failed to estimate transaction gas',
        details: (error as Error).message 
      });
    }
  }

  /**
   * Get network fee recommendations
   */
  public static async getNetworkFees(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const feeData = await blockchain.provider.getFeeData();
      const gasPrice = feeData.gasPrice || BigInt(0);

      // Calculate different speed options (this is simplified)
      const slow = gasPrice;
      const standard = gasPrice * BigInt(110) / BigInt(100); // 10% higher
      const fast = gasPrice * BigInt(125) / BigInt(100); // 25% higher

      res.json({
        success: true,
        fees: {
          slow: {
            gasPrice: slow.toString(),
            gwei: ethers.formatUnits(slow, 'gwei'),
            estimatedTime: '5-10 minutes',
          },
          standard: {
            gasPrice: standard.toString(),
            gwei: ethers.formatUnits(standard, 'gwei'),
            estimatedTime: '2-5 minutes',
          },
          fast: {
            gasPrice: fast.toString(),
            gwei: ethers.formatUnits(fast, 'gwei'),
            estimatedTime: '30 seconds - 2 minutes',
          },
        },
        eip1559: {
          maxFeePerGas: feeData.maxFeePerGas?.toString(),
          maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
        },
      });

    } catch (error) {
      console.error('Get network fees error:', error);
      res.status(500).json({ 
        error: 'Failed to get network fees' 
      });
    }
  }

  /**
   * Get wallet's credential ownership summary
   */
  public static async getCredentialSummary(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.user;

      // Get total credential count
      const totalCredentials = await blockchain.credentialContract.balanceOf(
        walletAddress
      );

      // Get individual token IDs (this might be expensive for large numbers)
      const tokenIds: string[] = [];
      const credentials: any[] = [];

      if (totalCredentials <= 100) { // Limit to prevent timeout
        for (let i = 0; i < totalCredentials; i++) {
          try {
            const tokenId = await blockchain.credentialContract.tokenOfOwnerByIndex(
              walletAddress,
              i
            );
            tokenIds.push(tokenId.toString());

            // Get token URI for metadata
            try {
              const tokenURI = await blockchain.credentialContract.tokenURI(tokenId);
              credentials.push({
                tokenId: tokenId.toString(),
                tokenURI,
              });
            } catch (error) {
              console.log(`Could not fetch URI for token ${tokenId}:`, error);
            }
          } catch (error) {
            console.log(`Could not fetch token at index ${i}:`, error);
            break;
          }
        }
      }

      res.json({
        success: true,
        summary: {
          totalCredentials: totalCredentials.toString(),
          tokenIds,
          credentials,
          note: totalCredentials > 100 ? 'Only showing token IDs due to large collection size' : null,
        },
      });

    } catch (error) {
      console.error('Get credential summary error:', error);
      res.status(500).json({ 
        error: 'Failed to get credential summary' 
      });
    }
  }
}

export default WalletController;

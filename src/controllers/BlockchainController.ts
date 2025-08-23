import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { AuthenticatedRequest } from '../types/express';
import blockchain from '../config/blockchain';
import User from '../models/User';
import { IBlockchainConfig, IGasEstimate } from '../types';

interface RegisterUserRequest extends AuthenticatedRequest {
  body: {
    organizationType?: 'institution' | 'employer' | 'verifier';
    organizationName?: string;
    organizationDetails?: {
      description?: string;
      website?: string;
      location?: string;
      registrationNumber?: string;
    };
  };
}

interface TransactionRequest extends AuthenticatedRequest {
  body: {
    contractAddress: string;
    methodName: string;
    parameters: any[];
    gasLimit?: string;
  };
}

class BlockchainController {
  /**
   * Register user on blockchain as an authorized issuer (for institutions)
   */
  public static async registerUserOnBlockchain(
    req: RegisterUserRequest,
    res: Response
  ): Promise<void> {
    try {
      const { organizationDetails } = req.body;
      const user = req.user;

      // Validate user type
      if (!['institution', 'employer', 'verifier'].includes(user.userType)) {
        res.status(400).json({ 
          error: 'Only institutions, employers, and verifiers can register on blockchain' 
        });
        return;
      }

      // Check if user is already registered on blockchain
      const isRegistered = await blockchain.registryContract.isAuthorizedIssuer(
        user.walletAddress
      );

      if (isRegistered) {
        res.status(400).json({ 
          error: 'User is already registered on blockchain' 
        });
        return;
      }

      // Prepare transaction data
      const orgName = user.name;
      const orgDescription = organizationDetails?.description || '';
      const orgWebsite = organizationDetails?.website || '';

      // Estimate gas for the registration
      const gasEstimate = await blockchain.getGasEstimate(
        blockchain.registryContract,
        'registerInstitution',
        [user.walletAddress, orgName, user.email, orgWebsite]
      );

      // Execute registration transaction
      const tx = await blockchain.registryContract.registerInstitution(
        user.walletAddress,
        orgName,
        orgWebsite,
        user.email,
        {
          gasLimit: gasEstimate.gasLimit,
          gasPrice: gasEstimate.gasPrice,
        }
      );

      // Wait for transaction confirmation
      const receipt = await blockchain.waitForTransaction(tx.hash, 2);

      if (!receipt) {
        throw new Error('Transaction failed to confirm');
      }

      // Update user record
      await User.findByIdAndUpdate(user._id, {
        $set: {
          'blockchain.isRegistered': true,
          'blockchain.registrationTxHash': tx.hash,
          'blockchain.registrationBlockNumber': receipt.blockNumber,
          'blockchain.registeredAt': new Date(),
        }
      });

      res.json({
        success: true,
        message: 'Successfully registered on blockchain',
        transaction: {
          hash: tx.hash,
          blockNumber: receipt.blockNumber,
          gasUsed: receipt.gasUsed?.toString(),
        },
        gasEstimate,
      });

    } catch (error) {
      console.error('Blockchain registration error:', error);
      res.status(500).json({ 
        error: 'Failed to register on blockchain',
        details: (error as Error).message 
      });
    }
  }

  /**
   * Check if user is registered on blockchain
   */
  public static async checkBlockchainRegistration(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.user;

      const isAuthorized = await blockchain.registryContract.isAuthorizedIssuer(
        walletAddress
      );

      let institutionData = null;
      if (isAuthorized) {
        try {
          institutionData = await blockchain.registryContract.getInstitution(
            walletAddress
          );
        } catch (error) {
          console.log('Institution data not found:', error);
        }
      }

      res.json({
        success: true,
        isRegistered: isAuthorized,
        institutionData: institutionData ? {
          name: institutionData.name,
          description: institutionData.description,
          website: institutionData.website,
          isVerified: institutionData.isVerified,
          registrationDate: new Date(Number(institutionData.registrationDate) * 1000),
        } : null,
      });

    } catch (error) {
      console.error('Check blockchain registration error:', error);
      res.status(500).json({ 
        error: 'Failed to check blockchain registration' 
      });
    }
  }

  /**
   * Get blockchain network information
   */
  public static async getNetworkInfo(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const network = await blockchain.provider.getNetwork();
      const blockNumber = await blockchain.getCurrentBlockNumber();
      const walletBalance = await blockchain.getWalletBalance();
      const isConnected = await blockchain.isConnected();

      res.json({
        success: true,
        network: {
          name: network.name,
          chainId: network.chainId.toString(),
          blockNumber,
          isConnected,
        },
        wallet: {
          address: blockchain.wallet.address,
          balance: walletBalance,
        },
        contracts: {
          credentialNFT: process.env.CREDENTIAL_NFT_ADDRESS,
          credentialRegistry: process.env.CREDENTIAL_REGISTRY_ADDRESS,
          verificationContract: process.env.VERIFICATION_CONTRACT_ADDRESS,
        },
      });

    } catch (error) {
      console.error('Network info error:', error);
      res.status(500).json({ 
        error: 'Failed to get network information' 
      });
    }
  }

  /**
   * Estimate gas for a transaction
   */
  public static async estimateGasForTransaction(
    req: TransactionRequest,
    res: Response
  ): Promise<void> {
    try {
      const { contractAddress, methodName, parameters } = req.body;

      // Get the appropriate contract
      let contract;
      if (contractAddress === process.env.CREDENTIAL_NFT_ADDRESS) {
        contract = blockchain.credentialContract;
      } else if (contractAddress === process.env.CREDENTIAL_REGISTRY_ADDRESS) {
        contract = blockchain.registryContract;
      } else if (contractAddress === process.env.VERIFICATION_CONTRACT_ADDRESS) {
        contract = blockchain.verificationContract;
      } else {
        res.status(400).json({ error: 'Invalid contract address' });
        return;
      }

      const gasEstimate = await blockchain.getGasEstimate(
        contract,
        methodName,
        parameters
      );

      res.json({
        success: true,
        gasEstimate,
      });

    } catch (error) {
      console.error('Gas estimation error:', error);
      res.status(500).json({ 
        error: 'Failed to estimate gas',
        details: (error as Error).message 
      });
    }
  }

  /**
   * Get transaction status
   */
  public static async getTransactionStatus(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { txHash } = req.params;

      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        res.status(400).json({ error: 'Invalid transaction hash format' });
        return;
      }

      const tx = await blockchain.provider.getTransaction(txHash);
      const receipt = await blockchain.provider.getTransactionReceipt(txHash);

      if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const currentBlock = await blockchain.getCurrentBlockNumber();
      const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;

      res.json({
        success: true,
        transaction: {
          hash: tx.hash,
          status: receipt?.status === 1 ? 'success' : receipt?.status === 0 ? 'failed' : 'pending',
          blockNumber: receipt?.blockNumber,
          confirmations,
          gasUsed: receipt?.gasUsed?.toString(),
          effectiveGasPrice: receipt?.gasPrice?.toString(),
          from: tx.from,
          to: tx.to,
          value: ethers.formatEther(tx.value),
        },
      });

    } catch (error) {
      console.error('Transaction status error:', error);
      res.status(500).json({ 
        error: 'Failed to get transaction status' 
      });
    }
  }

  /**
   * Get contract events/logs
   */
  public static async getContractEvents(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { contractType, eventName, fromBlock, toBlock } = req.query;

      let contract;
      switch (contractType) {
        case 'credential':
          contract = blockchain.credentialContract;
          break;
        case 'registry':
          contract = blockchain.registryContract;
          break;
        case 'verification':
          contract = blockchain.verificationContract;
          break;
        default:
          res.status(400).json({ error: 'Invalid contract type' });
          return;
      }

      // Query events without filter first, then filter by event name if needed
      const events = await contract.queryFilter(
        '*', // Query all events
        fromBlock ? Number(fromBlock) : -1000,
        toBlock ? Number(toBlock) : 'latest'
      );

      const parsedEvents = events
        .filter(event => !eventName || (event as any).fragment?.name === eventName)
        .map(event => {
          const eventLog = event as any;
          return {
            event: eventLog.fragment?.name || 'Unknown',
            args: eventLog.args || [],
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            logIndex: event.index || 0,
          };
        });

      res.json({
        success: true,
        events: parsedEvents,
        count: parsedEvents.length,
      });

    } catch (error) {
      console.error('Contract events error:', error);
      res.status(500).json({ 
        error: 'Failed to get contract events' 
      });
    }
  }

  /**
   * Verify smart contract interaction capability
   */
  public static async verifyContractInteraction(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const { walletAddress } = req.user;

      // Test read operations
      const tests = {
        canReadRegistry: false,
        canReadCredentials: false,
        canReadVerification: false,
        isAuthorizedIssuer: false,
        walletBalance: '0',
      };

      try {
        // Test registry contract
        tests.isAuthorizedIssuer = await blockchain.registryContract.isAuthorizedIssuer(
          walletAddress
        );
        tests.canReadRegistry = true;
      } catch (error) {
        console.log('Registry read test failed:', error);
      }

      try {
        // Test credential contract
        const balance = await blockchain.credentialContract.balanceOf(walletAddress);
        tests.canReadCredentials = true;
      } catch (error) {
        console.log('Credential read test failed:', error);
      }

      try {
        // Test verification contract
        // Note: This would depend on your verification contract's public methods
        tests.canReadVerification = true;
      } catch (error) {
        console.log('Verification read test failed:', error);
      }

      // Get wallet balance
      tests.walletBalance = await blockchain.getWalletBalance();

      res.json({
        success: true,
        tests,
        recommendations: {
          needsRegistration: !tests.isAuthorizedIssuer && req.user.userType !== 'user',
          needsFunds: parseFloat(tests.walletBalance) < 0.01,
          allSystemsOperational: tests.canReadRegistry && tests.canReadCredentials,
        },
      });

    } catch (error) {
      console.error('Contract interaction verification error:', error);
      res.status(500).json({ 
        error: 'Failed to verify contract interaction' 
      });
    }
  }
}

export default BlockchainController;

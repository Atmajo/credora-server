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
   * Wait for transaction with timeout and progress updates
   */
  private static async waitForTransactionWithTimeout(
    txHash: string,
    confirmations: number = 1,
    timeoutMs: number = 60000
  ): Promise<ethers.TransactionReceipt | null> {
    return new Promise(async (resolve) => {
      let timeoutId: NodeJS.Timeout;
      let intervalId: NodeJS.Timeout;

      // Set up timeout
      timeoutId = setTimeout(() => {
        console.log(`Transaction ${txHash} timed out after ${timeoutMs}ms`);
        clearInterval(intervalId);
        resolve(null);
      }, timeoutMs);

      // Set up progress checking
      let attempts = 0;
      intervalId = setInterval(async () => {
        attempts++;
        try {
          console.log(`Checking transaction status... (attempt ${attempts})`);

          const receipt =
            await blockchain.provider.getTransactionReceipt(txHash);
          if (receipt) {
            const currentBlock = await blockchain.getCurrentBlockNumber();
            const confirmationCount = currentBlock - receipt.blockNumber;

            console.log(
              `Transaction confirmed! Block: ${receipt.blockNumber}, Confirmations: ${confirmationCount}`
            );

            if (confirmationCount >= confirmations) {
              clearTimeout(timeoutId);
              clearInterval(intervalId);
              resolve(receipt);
            }
          } else {
            console.log('Transaction still pending...');
          }
        } catch (error) {
          console.log(`Error checking transaction: ${error}`);
        }
      }, 10000); // Check every 10 seconds
    });
  }

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
      if (!['institution', 'company', 'verifier'].includes(user.userType)) {
        res.status(400).json({
          error:
            'Only institutions, employers, and verifiers can register on blockchain',
        });
        return;
      }

      // Check if user is already authorized (verified) on blockchain
      const isAuthorized = await blockchain.registryContract.isAuthorizedIssuer(
        user.walletAddress
      );

      if (isAuthorized) {
        res.status(400).json({
          error: 'User is already registered and verified on blockchain',
        });
        return;
      }

      // Check if user is already registered but not verified
      let institutionData;
      let isRegistered = false;

      try {
        institutionData = await blockchain.registryContract.getInstitution(
          user.walletAddress
        );
        isRegistered = institutionData.name !== '';
      } catch (error) {
        // User is not registered
        isRegistered = false;
      }

      let registrationTx, verificationTx;
      let registrationReceipt, verificationReceipt;

      if (!isRegistered) {
        // Step 1: Register the institution
        console.log('Registering institution on blockchain...');

        const orgName = user.name;
        const orgWebsite = organizationDetails?.website || '';
        const documentHash = ''; // Empty for now, can be updated later via updateInstitutionDocuments

        // Estimate gas for the registration
        const registrationGasEstimate = await blockchain.getGasEstimate(
          blockchain.registryContract,
          'registerInstitution',
          [user.walletAddress, orgName, orgWebsite, user.email, documentHash]
        );

        console.log('Estimated gas for registration:', registrationGasEstimate);

        // Execute registration transaction
        registrationTx = await blockchain.registryContract.registerInstitution(
          user.walletAddress,
          orgName,
          orgWebsite,
          user.email,
          documentHash,
          {
            gasLimit: registrationGasEstimate.gasLimit,
            gasPrice: registrationGasEstimate.gasPrice,
          }
        );

        // Wait for registration confirmation with timeout
        registrationReceipt =
          await BlockchainController.waitForTransactionWithTimeout(
            registrationTx.hash,
            2,
            60000 // 60 seconds timeout
          );

        if (!registrationReceipt) {
          throw new Error(
            'Registration transaction timed out - please check transaction status manually'
          );
        }

        console.log('Institution registered successfully');
      } else {
        console.log(
          'Institution already registered, proceeding to verification...'
        );
      }

      // Step 2: Verify the institution (whether just registered or already registered)
      console.log('Verifying institution on blockchain...');

      const verificationGasEstimate = await blockchain.getGasEstimate(
        blockchain.registryContract,
        'verifyInstitution',
        [user.walletAddress]
      );

      console.log('Estimated gas for verification:', verificationGasEstimate);

      verificationTx = await blockchain.registryContract.verifyInstitution(
        user.walletAddress,
        {
          gasLimit: verificationGasEstimate.gasLimit,
          gasPrice: verificationGasEstimate.gasPrice,
        }
      );

      console.log('Verification transaction sent:', verificationTx.hash);

      // Wait for verification confirmation with timeout and progress updates
      console.log('Waiting for verification transaction confirmation...');
      verificationReceipt =
        await BlockchainController.waitForTransactionWithTimeout(
          verificationTx.hash,
          2,
          60000 // 60 seconds timeout
        );

      if (!verificationReceipt) {
        console.log(
          'Verification transaction is still pending, but proceeding with database update...'
        );

        // Update user record with pending verification
        await User.findByIdAndUpdate(user._id, {
          $set: {
            'blockchain.isRegistered': true,
            'blockchain.registrationTxHash':
              registrationTx?.hash || 'Already registered',
            'blockchain.verificationTxHash': verificationTx.hash,
            'blockchain.registrationBlockNumber':
              registrationReceipt?.blockNumber,
            'blockchain.verificationBlockNumber': null, // Will be updated later
            'blockchain.registeredAt': new Date(),
            'blockchain.verificationStatus': 'pending',
          },
        });

        res.json({
          success: true,
          message:
            'Registration completed and verification transaction submitted',
          status: 'verification_pending',
          transactions: {
            registration: registrationTx
              ? {
                  hash: registrationTx.hash,
                  blockNumber: registrationReceipt?.blockNumber,
                  gasUsed: registrationReceipt?.gasUsed?.toString(),
                }
              : null,
            verification: {
              hash: verificationTx.hash,
              status: 'pending',
              message: 'Transaction is still being processed by the network',
            },
          },
          note: 'Verification transaction is pending. You can check its status using the transaction hash.',
          nextSteps: [
            'Your verification transaction is being processed by the blockchain network',
            'This may take several minutes depending on network congestion',
            `Check transaction status at: https://sepolia.etherscan.io/tx/${verificationTx.hash}`,
            'You will be able to issue credentials once verification is complete',
          ],
        });
        return;
      }

      console.log('Institution verified successfully');

      // Update user record
      await User.findByIdAndUpdate(user._id, {
        $set: {
          'blockchain.isRegistered': true,
          'blockchain.registrationTxHash':
            registrationTx?.hash || 'Already registered',
          'blockchain.verificationTxHash': verificationTx.hash,
          'blockchain.registrationBlockNumber':
            registrationReceipt?.blockNumber,
          'blockchain.verificationBlockNumber': verificationReceipt.blockNumber,
          'blockchain.verificationStatus': 'confirmed',
          'blockchain.registeredAt': new Date(),
        },
      });

      // Double-check that the user is now an authorized issuer
      const isNowAuthorized =
        await blockchain.registryContract.isAuthorizedIssuer(
          user.walletAddress
        );

      res.json({
        success: true,
        message: 'Successfully registered and verified on blockchain',
        isAuthorizedIssuer: isNowAuthorized,
        transactions: {
          registration: registrationTx
            ? {
                hash: registrationTx.hash,
                blockNumber: registrationReceipt?.blockNumber,
                gasUsed: registrationReceipt?.gasUsed?.toString(),
              }
            : null,
          verification: {
            hash: verificationTx.hash,
            blockNumber: verificationReceipt.blockNumber,
            gasUsed: verificationReceipt.gasUsed?.toString(),
          },
        },
        note: isRegistered
          ? 'Institution was already registered, only verification was needed'
          : 'Institution was registered and verified',
        status: isNowAuthorized ? 'fully_verified' : 'verification_pending',
      });
    } catch (error) {
      console.error('Blockchain registration error:', error);

      // Enhanced error logging for debugging
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      }

      // Log contract state for debugging
      console.log(
        'Registry contract address:',
        process.env.CREDENTIAL_REGISTRY_ADDRESS
      );
      console.log('User wallet address:', req.user?.walletAddress);
      console.log('Organization name:', req.user?.name);

      res.status(500).json({
        error: 'Failed to register on blockchain',
        details: (error as Error).message,
      });
    }
  }

  /**
   * Check the status of a pending verification transaction
   */
  public static async checkVerificationStatus(
    req: AuthenticatedRequest,
    res: Response
  ): Promise<void> {
    try {
      const user = req.user;
      const { txHash } = req.params;

      // Validate transaction hash format
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        res.status(400).json({ error: 'Invalid transaction hash format' });
        return;
      }

      // Get transaction details
      const tx = await blockchain.provider.getTransaction(txHash);
      const receipt = await blockchain.provider.getTransactionReceipt(txHash);

      if (!tx) {
        res.status(404).json({ error: 'Transaction not found' });
        return;
      }

      const currentBlock = await blockchain.getCurrentBlockNumber();
      const confirmations = receipt ? currentBlock - receipt.blockNumber : 0;

      // If transaction is confirmed, update user record
      if (receipt && receipt.status === 1) {
        // Check if this user has this transaction as their verification tx
        const userRecord = await User.findById(user._id);
        if (userRecord?.blockchain?.verificationTxHash === txHash) {
          await User.findByIdAndUpdate(user._id, {
            $set: {
              'blockchain.verificationBlockNumber': receipt.blockNumber,
              'blockchain.verificationStatus': 'confirmed',
            },
          });
        }
      }

      res.json({
        success: true,
        transaction: {
          hash: tx.hash,
          status:
            receipt?.status === 1
              ? 'success'
              : receipt?.status === 0
                ? 'failed'
                : 'pending',
          blockNumber: receipt?.blockNumber,
          confirmations,
          gasUsed: receipt?.gasUsed?.toString(),
          from: tx.from,
          to: tx.to,
        },
        message:
          receipt?.status === 1
            ? 'Verification completed successfully!'
            : receipt?.status === 0
              ? 'Verification transaction failed'
              : 'Verification transaction is still pending',
        explorerUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      });
    } catch (error) {
      console.error('Check verification status error:', error);
      res.status(500).json({
        error: 'Failed to check verification status',
        details: (error as Error).message,
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

      // Check if user is authorized (verified)
      const isAuthorized =
        await blockchain.registryContract.isAuthorizedIssuer(walletAddress);

      // Check if user is registered (has institution data)
      let institutionData = null;
      let isRegistered = false;

      try {
        institutionData =
          await blockchain.registryContract.getInstitution(walletAddress);
        isRegistered = institutionData.name !== '';

        const user = await User.findByWalletAddress(walletAddress);

        if (user && !user?.blockchain?.isRegistered && isRegistered) {
          await User.findByIdAndUpdate(user._id, {
            $set: {
              'blockchain.isRegistered': true,
              'blockchain.registrationTxHash':
                institutionData.registrationTxHash,
              'blockchain.registrationBlockNumber':
                institutionData.registrationBlockNumber,
              'blockchain.verificationBlockNumber': institutionData.blockNumber,
              'blockchain.verificationStatus': 'confirmed',
              'blockchain.registeredAt': new Date(
                Number(institutionData.registrationDate) * 1000
              ),
            },
          });
        }
      } catch (error) {
        console.log('Institution data not found:', error);
        isRegistered = false;
      }

      res.json({
        success: true,
        isRegistered,
        isAuthorized,
        institutionData:
          institutionData && isRegistered
            ? {
                name: institutionData.name,
                website: institutionData.website,
                email: institutionData.email,
                isVerified: institutionData.verified,
                registrationDate: new Date(
                  Number(institutionData.registrationDate) * 1000
                ),
                credentialsIssued: Number(institutionData.credentialsIssued),
              }
            : null,
        status: isAuthorized
          ? 'Fully registered and verified'
          : isRegistered
            ? 'Registered but not verified'
            : 'Not registered',
      });
    } catch (error) {
      console.error('Check blockchain registration error:', error);
      res.status(500).json({
        error: 'Failed to check blockchain registration',
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
        error: 'Failed to get network information',
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
      } else if (
        contractAddress === process.env.VERIFICATION_CONTRACT_ADDRESS
      ) {
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
        details: (error as Error).message,
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
          status:
            receipt?.status === 1
              ? 'success'
              : receipt?.status === 0
                ? 'failed'
                : 'pending',
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
        error: 'Failed to get transaction status',
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
        .filter(
          (event) => !eventName || (event as any).fragment?.name === eventName
        )
        .map((event) => {
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
        error: 'Failed to get contract events',
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
        tests.isAuthorizedIssuer =
          await blockchain.registryContract.isAuthorizedIssuer(walletAddress);
        tests.canReadRegistry = true;
      } catch (error) {
        console.log('Registry read test failed:', error);
      }

      try {
        // Test credential contract
        const balance =
          await blockchain.credentialContract.balanceOf(walletAddress);
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
          needsRegistration:
            !tests.isAuthorizedIssuer && req.user.userType !== 'user',
          needsFunds: parseFloat(tests.walletBalance) < 0.01,
          allSystemsOperational:
            tests.canReadRegistry && tests.canReadCredentials,
        },
      });
    } catch (error) {
      console.error('Contract interaction verification error:', error);
      res.status(500).json({
        error: 'Failed to verify contract interaction',
      });
    }
  }
}

export default BlockchainController;

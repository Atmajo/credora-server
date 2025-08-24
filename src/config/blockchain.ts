import { configDotenv } from 'dotenv';
import { ethers } from 'ethers';
import { IBlockchainConfig, IGasEstimate } from '../types';

configDotenv();

class BlockchainConfig implements IBlockchainConfig {
  public provider: ethers.JsonRpcProvider;
  public wallet: ethers.Wallet;
  public credentialContract: ethers.Contract;
  public registryContract: ethers.Contract;
  public verificationContract: ethers.Contract;

  constructor() {
    // Initialize provider
    const rpcUrl = process.env.RPC_URL;
    if (!rpcUrl) {
      throw new Error('RPC_URL is not defined in environment variables');
    }
    this.provider = new ethers.JsonRpcProvider(rpcUrl);

    // Initialize wallet
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      throw new Error('PRIVATE_KEY is not defined in environment variables');
    }
    this.wallet = new ethers.Wallet(privateKey, this.provider);

    // Initialize contract instances
    this.credentialContract = this.initializeContract(
      process.env.CREDENTIAL_NFT_ADDRESS!,
      require('../abis/CredentialNFT.json'),
      this.wallet
    );

    this.registryContract = this.initializeContract(
      process.env.CREDENTIAL_REGISTRY_ADDRESS!,
      require('../abis/CredentialRegistry.json'),
      this.wallet
    );

    // Debug the registry contract methods
    this.debugContractMethods(this.registryContract, 'CredentialRegistry');

    this.verificationContract = this.initializeContract(
      process.env.VERIFICATION_CONTRACT_ADDRESS!,
      require('../abis/VerificationContract.json'),
      this.provider
    );
  }

  private initializeContract(
    address: string,
    abi: any[],
    signerOrProvider: ethers.Wallet | ethers.JsonRpcProvider
  ): ethers.Contract {
    if (!address) {
      throw new Error(`Contract address is not defined`);
    }

    if (!abi || abi.length === 0) {
      throw new Error(`Contract ABI is not defined or empty`);
    }

    try {
      const contract = new ethers.Contract(address, abi, signerOrProvider);
      console.log(`Contract initialized successfully at address: ${address}`);
      return contract;
    } catch (error) {
      console.error(`Failed to initialize contract at ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get contract instance with a specific signer
   */
  public getContractWithSigner(
    contractAddress: string,
    abi: any[],
    privateKey: string
  ): ethers.Contract {
    const wallet = new ethers.Wallet(privateKey, this.provider);
    return new ethers.Contract(contractAddress, abi, wallet);
  }

  /**
   * Debug contract methods - list all available methods
   */
  public debugContractMethods(
    contract: ethers.Contract,
    contractName: string
  ): void {
    console.log(`\n=== ${contractName} Contract Methods ===`);
    const contractInterface = contract.interface;
    const methods = contractInterface.fragments.filter(
      (fragment) => fragment.type === 'function'
    );

    methods.forEach((method) => {
      if (method.type === 'function') {
        const funcFragment = method as ethers.FunctionFragment;
        console.log(
          `- ${funcFragment.name}(${funcFragment.inputs.map((input) => `${input.type} ${input.name}`).join(', ')})`
        );
      }
    });
    console.log(`Total methods: ${methods.length}\n`);
  }

  /**
   * Estimate gas for transactions
   */
  public async estimateGas(
    contract: ethers.Contract,
    method: string,
    params: any[]
  ): Promise<bigint> {
    try {
      // Check if the method exists on the contract
      if (!contract[method]) {
        console.error(`Method ${method} does not exist on contract`);
        return BigInt(500000); // Default gas limit
      }

      // Check if estimateGas exists for this method
      if (!contract[method].estimateGas) {
        console.error(`EstimateGas not available for method ${method}`);
        return BigInt(500000); // Default gas limit
      }

      const gasEstimate = await contract[method].estimateGas(...params);
      return gasEstimate;
    } catch (error) {
      console.error('Gas estimation failed:', error);
      return BigInt(500000); // Default gas limit
    }
  }

  /**
   * Get current gas price
   */
  public async getGasPrice(): Promise<bigint> {
    try {
      const feeData = await this.provider.getFeeData();
      return feeData.gasPrice || BigInt(0);
    } catch (error) {
      console.error('Failed to get gas price:', error);
      return BigInt(20000000000); // 20 gwei default
    }
  }

  /**
   * Get comprehensive gas estimate
   */
  public async getGasEstimate(
    contract: ethers.Contract,
    method: string,
    params: any[]
  ): Promise<IGasEstimate> {
    const gasLimit = await this.estimateGas(contract, method, params);
    const feeData = await this.provider.getFeeData();

    return {
      gasLimit: gasLimit.toString(),
      gasPrice: feeData.gasPrice?.toString() || '0',
      maxFeePerGas: feeData.maxFeePerGas?.toString(),
      maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString(),
    };
  }

  /**
   * Check if provider is connected
   */
  public async isConnected(): Promise<boolean> {
    try {
      await this.provider.getNetwork();
      return true;
    } catch (error) {
      console.error('Provider connection check failed:', error);
      return false;
    }
  }

  /**
   * Get current block number
   */
  public async getCurrentBlockNumber(): Promise<number> {
    return await this.provider.getBlockNumber();
  }

  /**
   * Get wallet balance
   */
  public async getWalletBalance(): Promise<string> {
    const balance = await this.provider.getBalance(this.wallet.address);
    return ethers.formatEther(balance);
  }

  /**
   * Wait for transaction confirmation with configurable timeout
   */
  public async waitForTransaction(
    txHash: string,
    confirmations: number = 1,
    timeoutMs: number = 300000 // 5 minutes default
  ): Promise<ethers.TransactionReceipt | null> {
    try {
      // Use a timeout promise to prevent indefinite waiting
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), timeoutMs);
      });

      const txPromise = this.provider.waitForTransaction(
        txHash,
        confirmations,
        timeoutMs
      );

      const result = await Promise.race([txPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('Transaction wait error:', error);
      return null;
    }
  }
}

// Export singleton instance
export default new BlockchainConfig();

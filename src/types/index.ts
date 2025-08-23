export interface IUser {
  _id?: string;
  walletAddress: string;
  email: string;
  name: string;
  profile?: {
    bio?: string;
    avatar?: string;
    linkedin?: string;
    website?: string;
    documents?: string[];
  };
  userType: 'student' | 'institution' | 'verifier';
  isVerified: boolean;
  isAdmin?: boolean;
  credentialsOwned?: ICredentialOwnership[];
  preferences?: {
    notifications: boolean;
    publicProfile: boolean;
  };
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICredentialOwnership {
  tokenId: string;
  issuer: string;
  credentialType: string;
  issueDate: Date;
  onChain: boolean;
}

export interface ICredential {
  _id?: string;
  tokenId: string;
  issuer: {
    address: string;
    name: string;
  };
  recipient: {
    address: string;
    name?: string;
  };
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
  };
  metadata?: {
    ipfsHash?: string;
    imageUrl?: string;
    documentUrl?: string;
    verificationUrl?: string;
  };
  blockchain?: {
    transactionHash?: string;
    blockNumber?: number;
    gasUsed?: string;
    issueDate?: Date;
    expiryDate?: Date;
  };
  status: 'pending' | 'issued' | 'revoked' | 'expired';
  verificationCount: number;
  revocationReason?: string;
  revokedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ICredentialMetadata {
  name: string;
  description?: string;
  image?: string;
  attributes: Array<{
    trait_type: string;
    value: string;
  }>;
}

export interface IBlockchainCredential {
  tokenId: string;
  issuer: string;
  recipient: string;
  credentialType: string;
  institutionName: string;
  issueDate: number;
  expiryDate: number;
  ipfsHash: string;
  tokenURI: string;
  revoked: boolean;
}

export interface IVerificationResult {
  isValid: boolean;
  exists: boolean;
  tokenId: string;
  issuer: {
    address: string;
    name: string;
  };
  recipient: {
    address: string;
  };
  credentialType: string;
  issueDate: Date;
  status: {
    expired: boolean;
    revoked: boolean;
    message: string;
  };
  metadata?: any;
  verificationTimestamp: Date;
}

export interface IInstitutionData {
  name: string;
  verified: boolean;
  registrationDate: Date;
  credentialsIssued: string;
}

export interface IDashboardStats {
  totalCredentials: number;
  activeCredentials: number;
  revokedCredentials: number;
  totalVerifications: number;
  recentCredentials: ICredential[];
}

export interface IBatchCredentialRequest {
  recipientAddress: string;
  recipientName?: string;
  title: string;
  description?: string;
  credentialType: string;
  subject?: string;
  grade?: string;
  skills?: string[];
}

export interface IAuthRequest {
  email: string;
  walletAddress: string;
  signature: string;
  message: string;
  trust: boolean;
}

export interface IAuthResponse {
  success: boolean;
  user: {
    id: string;
    walletAddress: string;
    name: string;
    email: string;
    userType: string;
    isVerified: boolean;
  };
}

export interface ILoginChallenge {
  message: string;
  nonce: number;
}

export interface IApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}

export interface IPaginationQuery {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface IPaginatedResponse<T> extends IApiResponse<T[]> {
  pagination: {
    currentPage: number;
    totalPages: number;
    totalItems: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface IContractConfig {
  address: string;
  abi: any[];
}

export interface IBlockchainConfig {
  provider: any;
  wallet: any;
  credentialContract: any;
  registryContract: any;
  verificationContract: any;
}

export interface IGasEstimate {
  gasLimit: string;
  gasPrice: string;
  maxFeePerGas?: string;
  maxPriorityFeePerGas?: string;
}

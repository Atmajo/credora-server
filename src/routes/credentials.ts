import { Router } from 'express';
import { body, param, validationResult } from 'express-validator';
import CredentialController from '../controllers/CredentialController';
import {
  auth,
  requireVerifiedInstitution,
  requireOwnership,
  optionalAuth,
} from '../middleware/auth';

const router = Router();

// Validation middleware
const handleValidationErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array(),
    });
  }
  next();
};

// Issue credential
router.post(
  '/issue',
  auth,
  requireVerifiedInstitution as any,
  [
    body('recipientAddress')
      .isEthereumAddress()
      .withMessage('Invalid recipient address format'),
    body('credentialData.title')
      .notEmpty()
      .withMessage('Credential title is required')
      .isLength({ max: 200 })
      .withMessage('Title must be less than 200 characters'),
    body('credentialData.credentialType')
      .isIn(['Degree', 'Certificate', 'Course', 'Workshop', 'License'])
      .withMessage('Invalid credential type'),
    body('credentialData.description')
      .optional()
      .isLength({ max: 1000 })
      .withMessage('Description must be less than 1000 characters'),
    body('credentialData.gpa')
      .optional()
      .isFloat({ min: 0, max: 4.0 })
      .withMessage('GPA must be between 0 and 4.0'),
    body('credentialData.credits')
      .optional()
      .isInt({ min: 0 })
      .withMessage('Credits must be a positive integer'),
    body('credentialData.skills')
      .optional()
      .isArray()
      .withMessage('Skills must be an array'),
    body('expiryDate')
      .optional()
      .isInt({ min: Date.now() / 1000 })
      .withMessage('Expiry date must be in the future'),
  ],
  handleValidationErrors,
  CredentialController.issueCredential as any
);

// Batch issue credentials
router.post(
  '/batch-issue',
  auth,
  requireVerifiedInstitution as any,
  [
    body('credentials')
      .isArray({ min: 1 })
      .withMessage('Credentials array is required and cannot be empty'),
    body('credentials.*.recipientAddress')
      .isEthereumAddress()
      .withMessage('Invalid recipient address format'),
    body('credentials.*.title')
      .notEmpty()
      .withMessage('Credential title is required'),
    body('credentials.*.credentialType')
      .isIn(['Degree', 'Certificate', 'Course', 'Workshop', 'License'])
      .withMessage('Invalid credential type'),
  ],
  handleValidationErrors,
  CredentialController.batchIssueCredentials as any
);

// Verify credential (public endpoint)
router.get(
  '/verify/:tokenId',
  [param('tokenId').isNumeric().withMessage('Token ID must be numeric')],
  handleValidationErrors,
  CredentialController.verifyCredential
);

// Get user credentials
router.get(
  '/user/:walletAddress',
  optionalAuth,
  [
    param('walletAddress')
      .isEthereumAddress()
      .withMessage('Invalid wallet address format'),
  ],
  handleValidationErrors,
  CredentialController.getUserCredentials
);

// Get credentials issued by the authenticated institution
router.get(
  '/issued',
  auth,
  requireVerifiedInstitution as any,
  CredentialController.getIssuedCredentials as any
);

// Get credential details by token ID
router.get(
  '/details/:tokenId',
  [param('tokenId').isNumeric().withMessage('Token ID must be numeric')],
  handleValidationErrors,
  CredentialController.getCredentialDetails
);

// Generate QR code for credential
router.get(
  '/qr/:tokenId',
  [param('tokenId').isNumeric().withMessage('Token ID must be numeric')],
  handleValidationErrors,
  CredentialController.generateCredentialQR
);

// Revoke credential
router.post(
  '/revoke/:tokenId',
  auth,
  requireVerifiedInstitution as any,
  [
    param('tokenId').isNumeric().withMessage('Token ID must be numeric'),
    body('reason')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Reason must be less than 500 characters'),
  ],
  handleValidationErrors,
  CredentialController.revokeCredential as any
);

export default router;

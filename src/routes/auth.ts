import { Router } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import AuthController from '../controllers/AuthController';
import { auth, verifySignature } from '../middleware/auth';

const router = Router();

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

router.post(
  '/challenge',
  [
    body('walletAddress')
      .isEthereumAddress()
      .withMessage('Invalid Ethereum address format'),
  ],
  handleValidationErrors,
  AuthController.getLoginChallenge
);

router.post(
  '/login',
  [
    body('walletAddress')
      .isEthereumAddress()
      .withMessage('Invalid Ethereum address format'),
    body('signature').notEmpty().withMessage('Signature is required'),
    body('message').notEmpty().withMessage('Message is required'),
  ],
  handleValidationErrors,
  verifySignature,
  AuthController.loginWithWallet
);

router.get(
  '/verify',
  [query('token').notEmpty().withMessage('Token is required')],
  AuthController.verifyProfile as any
);

router.get('/profile', auth, AuthController.getProfile as any);

router.put(
  '/profile',
  auth,
  [
    body('name')
      .optional()
      .isLength({ min: 2, max: 100 })
      .withMessage('Name must be between 2 and 100 characters'),
    body('email').optional().isEmail().withMessage('Invalid email format'),
    body('profile.bio')
      .optional()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('profile.avatar')
      .optional()
      .isURL()
      .withMessage('Avatar must be a valid URL'),
    body('profile.linkedin')
      .optional()
      .isURL()
      .withMessage('LinkedIn must be a valid URL'),
    body('profile.website')
      .optional()
      .isURL()
      .withMessage('Website must be a valid URL'),
  ],
  handleValidationErrors,
  AuthController.updateProfile as any
);

router.post('/refresh', auth, AuthController.refreshToken as any);

router.post('/logout', auth, AuthController.logout as any);

router.delete('/account', auth, AuthController.deleteAccount as any);

router.get(
  '/check-wallet/:walletAddress',
  [
    param('walletAddress')
      .isEthereumAddress()
      .withMessage('Invalid Ethereum address format'),
  ],
  handleValidationErrors,
  AuthController.checkWalletAvailability
);

router.get(
  '/check-email/:email',
  [param('email').isEmail().withMessage('Invalid email format')],
  handleValidationErrors,
  AuthController.checkEmailAvailability
);

export default router;

import { Router } from 'express';
import { auth } from '../middleware/auth';
import VerificationController from '../controllers/VerificationController';

const router = Router();

// Credential verification
router.post('/verify', VerificationController.verifyCredential);
router.post('/batch-verify', VerificationController.batchVerifyCredentials);

// Verification history
router.get('/history/:tokenId', VerificationController.getVerificationHistory);

// Issuer verification
router.get('/issuer/:issuerAddress', VerificationController.verifyIssuerAuthority);

// Verification requests
router.post('/request', auth, VerificationController.createVerificationRequest as any);

// Verification statistics
router.get('/stats', VerificationController.getVerificationStats);

export default router;

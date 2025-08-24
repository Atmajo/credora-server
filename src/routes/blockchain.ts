import { Router } from 'express';
import { auth } from '../middleware/auth';
import BlockchainController from '../controllers/BlockchainController';

const router = Router();

// Blockchain registration routes
router.post('/register', auth, BlockchainController.registerUserOnBlockchain as any);
router.get('/registration-status', auth, BlockchainController.checkBlockchainRegistration as any);

// Verification status checking
router.get('/verification-status/:txHash', auth, BlockchainController.checkVerificationStatus as any);

// Network information
router.get('/network', BlockchainController.getNetworkInfo);

// Gas estimation
router.post('/estimate-gas', BlockchainController.estimateGasForTransaction as any);

// Transaction monitoring
router.get('/transaction/:txHash', BlockchainController.getTransactionStatus);

// Contract events
router.get('/events', BlockchainController.getContractEvents);

// Contract interaction verification
router.get('/verify-interaction', auth, BlockchainController.verifyContractInteraction as any);

export default router;

import { Router } from 'express';
import { auth } from '../middleware/auth';
import WalletController from '../controllers/WalletController';

const router = Router();

// Wallet information
router.get('/info', auth, WalletController.getWalletInfo as any);

// Wallet validation
router.get('/validate/:address', WalletController.validateWalletAddress);

// Message signing
router.post('/sign-message', auth, WalletController.signMessage as any);

// Transaction history
router.get('/transactions', auth, WalletController.getTransactionHistory as any);

// Gas estimation for transactions
router.post('/estimate-gas', WalletController.estimateTransactionGas);

// Network fees
router.get('/fees', WalletController.getNetworkFees);

// Credential summary
router.get('/credentials', auth, WalletController.getCredentialSummary as any);

export default router;

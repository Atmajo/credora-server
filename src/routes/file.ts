import { Router } from 'express';
import { auth } from '../middleware/auth';
import { fileDownload } from '../controllers/files/fileDownload';
import { fileUpload } from '../controllers/files/fileUpload';
import multer from 'multer';

const router = Router();

const upload = multer({ dest: 'uploads/' });

router.post('/upload', auth, upload.array('files'), fileUpload as any);
router.post('/download', auth, fileDownload as any);

export default router;

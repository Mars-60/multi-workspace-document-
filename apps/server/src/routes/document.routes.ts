import { Router } from 'express';
import multer from 'multer';

import { DocumentController } from '../controllers/document.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { requireWorkspaceAccess } from '../middleware/workspace.middleware.js';

const router = Router({ mergeParams: true });
const upload = multer({ storage: multer.memoryStorage() });
const controller = new DocumentController();

router.get('/', requireAuth, requireWorkspaceAccess, controller.list);
router.post('/', requireAuth, requireWorkspaceAccess, upload.single('file'), controller.upload);

export default router;

import { Router } from 'express';

import { WorkspaceController } from '../controllers/workspace.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();
const controller = new WorkspaceController();

router.get('/', requireAuth, controller.list);
router.post('/', requireAuth, controller.create);

export default router;

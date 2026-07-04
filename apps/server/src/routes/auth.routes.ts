import { Router } from 'express';

import { AuthController } from '../controllers/auth/auth.controller.js';

const router = Router();
const controller = new AuthController();

router.post('/sign-up', controller.signUp);
router.post('/sign-in', controller.signIn);
router.post('/sign-out', controller.signOut);
router.get('/session', controller.session);

export default router;

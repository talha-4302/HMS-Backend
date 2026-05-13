import { Router } from 'express';

import { authenticate } from '../../shared/middleware/authenticate.js';
import { validateRequest } from '../../shared/middleware/validateRequest.js';
import * as authController from './auth.controller.js';
import { loginValidators, registerValidators } from './auth.validators.js';

export const authRoutes = Router();

authRoutes.post('/register', registerValidators, validateRequest, authController.register);
authRoutes.post('/login', loginValidators, validateRequest, authController.login);
authRoutes.post('/refresh', authController.refresh);
authRoutes.post('/logout', authController.logout);
authRoutes.get('/me', authenticate, authController.me);

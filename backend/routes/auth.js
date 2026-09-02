import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  // TODO (Phase 5): implement registration logic
  res.status(501).json({ message: 'Register — not yet implemented.' });
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  // TODO (Phase 5): implement login logic
  res.status(501).json({ message: 'Login — not yet implemented.' });
});

// POST /api/auth/refresh
router.post('/refresh', (req, res) => {
  // TODO (Phase 5): implement token refresh logic
  res.status(501).json({ message: 'Refresh — not yet implemented.' });
});

// POST /api/auth/logout  (protected)
router.post('/logout', authMiddleware, (req, res) => {
  // TODO (Phase 5): implement logout / token revocation
  res.status(501).json({ message: 'Logout — not yet implemented.' });
});

export default router;

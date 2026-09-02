import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();

// All endpoint management routes require authentication
router.use(authMiddleware);

// GET /api/endpoints — list saved endpoints for the authenticated user
router.get('/', (req, res) => {
  // TODO (Phase 5): query DB for user's saved endpoints
  res.status(501).json({ message: 'List endpoints — not yet implemented.' });
});

// POST /api/endpoints — save a new endpoint
router.post('/', (req, res) => {
  // TODO (Phase 5): persist endpoint to MongoDB
  res.status(501).json({ message: 'Save endpoint — not yet implemented.' });
});

// GET /api/endpoints/:id
router.get('/:id', (req, res) => {
  res.status(501).json({ message: 'Get endpoint — not yet implemented.' });
});

// PUT /api/endpoints/:id
router.put('/:id', (req, res) => {
  res.status(501).json({ message: 'Update endpoint — not yet implemented.' });
});

// DELETE /api/endpoints/:id
router.delete('/:id', (req, res) => {
  res.status(501).json({ message: 'Delete endpoint — not yet implemented.' });
});

export default router;

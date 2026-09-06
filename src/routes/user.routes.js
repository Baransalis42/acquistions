import express from 'express';
import {
  fetchAllUsers,
  getUserById,
  updateUser,
  deleteUser,
} from '#controllers/users.controller.js';
import { requireAuth } from '#middleware/auth.middleware.js';

const router = express.Router();

router.get('/', requireAuth, fetchAllUsers);
router.get('/:id', requireAuth, getUserById);
router.put('/:id', updateUser);
router.delete('/:id', deleteUser);

export default router;

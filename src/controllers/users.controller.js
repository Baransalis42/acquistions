import logger from "#config/logger.js";
import {
  getAllUsers,
  getUserById as getUserByIdService,
  updateUser as updateUserService,
  deleteUser as deleteUserService,
} from "#services/users.services.js";
import { userIdSchema, updateUserSchema } from "#validations/users.validation.js";
import { formatValidationErrors } from "#utils/format.js";

export const fetchAllUsers = async (req, res, next) => {
  try {
    logger.info('Getting users ...');

    const allUsers = await getAllUsers();

    res.json({
      message: 'Successfully retrieved users',
      users: allUsers,
      count: allUsers.length,
    });
  } catch (e) {
    logger.error(e);
    next(e);
  }
};

export const getUserById = async (req, res, next) => {
  try {
    const validationResult = userIdSchema.safeParse(req.params);
    if (!validationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: formatValidationErrors(validationResult.error),
      });
    }

    const { id } = validationResult.data;

    logger.info(`Getting user by id: ${id}`);

    const user = await getUserByIdService(id);

    res.json({
      message: 'Successfully retrieved user',
      user,
    });
  } catch (e) {
    logger.error(e);
    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(e);
  }
};

export const updateUser = async (req, res, next) => {
  try {
    const idValidationResult = userIdSchema.safeParse(req.params);
    if (!idValidationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: formatValidationErrors(idValidationResult.error),
      });
    }

    const bodyValidationResult = updateUserSchema.safeParse(req.body);
    if (!bodyValidationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: formatValidationErrors(bodyValidationResult.error),
      });
    }

    const { id } = idValidationResult.data;
    const updates = bodyValidationResult.data;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only update your own information',
      });
    }

    if (updates.role && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Only admins can change a user role',
      });
    }

    logger.info(`Updating user: ${id}`);

    const updatedUser = await updateUserService(id, updates);

    res.json({
      message: 'User updated successfully',
      user: updatedUser,
    });
  } catch (e) {
    logger.error(e);
    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(e);
  }
};

export const deleteUser = async (req, res, next) => {
  try {
    const idValidationResult = userIdSchema.safeParse(req.params);
    if (!idValidationResult.success) {
      return res.status(400).json({
        error: 'Validation error',
        details: formatValidationErrors(idValidationResult.error),
      });
    }

    const { id } = idValidationResult.data;

    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const isSelf = req.user.id === id;
    const isAdmin = req.user.role === 'admin';

    if (!isSelf && !isAdmin) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You can only delete your own account',
      });
    }

    logger.info(`Deleting user: ${id}`);

    const deletedUser = await deleteUserService(id);

    res.json({
      message: 'User deleted successfully',
      user: deletedUser,
    });
  } catch (e) {
    logger.error(e);
    if (e.message === 'User not found') {
      return res.status(404).json({ error: 'User not found' });
    }
    next(e);
  }
};
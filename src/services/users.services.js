import logger from "#config/logger.js";
import { db } from "#config/database.js";
import { users } from "#models/user.model.js";
import { hashPassword } from "#services/auth.service.js";
import { eq } from "drizzle-orm";

const publicUserColumns = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  created_at: users.created_at,
  updated_at: users.updated_at,
};

export const getAllUsers = async () => {
  try {
    return await db.select(publicUserColumns).from(users);
  } catch (e) {
    logger.error('Error getting users', e);
    throw e;
  }
};

export const getUserById = async (id) => {
  try {
    const [user] = await db
      .select(publicUserColumns)
      .from(users)
      .where(eq(users.id, id))
      .limit(1);

    if (!user) throw new Error('User not found');

    return user;
  } catch (e) {
    logger.error(`Error getting user by id: ${id}`, e);
    throw e;
  }
};

export const updateUser = async (id, updates) => {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existingUser) throw new Error('User not found');

    const updateValues = { ...updates, updated_at: new Date() };
    if (updateValues.password) {
      updateValues.password = await hashPassword(updateValues.password);
    }

    const [updatedUser] = await db
      .update(users)
      .set(updateValues)
      .where(eq(users.id, id))
      .returning(publicUserColumns);

    logger.info(`User updated: ${id}`);
    return updatedUser;
  } catch (e) {
    logger.error(`Error updating user: ${id}`, e);
    throw e;
  }
};

export const deleteUser = async (id) => {
  try {
    const [existingUser] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    if (!existingUser) throw new Error('User not found');

    const [deletedUser] = await db
      .delete(users)
      .where(eq(users.id, id))
      .returning(publicUserColumns);

    logger.info(`User deleted: ${id}`);
    return deletedUser;
  } catch (e) {
    logger.error(`Error deleting user: ${id}`, e);
    throw e;
  }
};
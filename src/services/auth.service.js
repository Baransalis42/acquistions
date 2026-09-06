import logger from '#config/logger.js';
import bcrypt from 'bcrypt';
import { eq } from 'drizzle-orm';
import { db } from '#config/database.js';
import { users } from '#models/user.model.js';

export const hashPassword = async password => {
  try {
    return await bcrypt.hash(password, 10);
  } catch (error) {
    logger.error('Error hashing password', error);
    throw new Error('Error creating user', { cause: error });
  }
};

export const comparePassword = async (password, hashedPassword) => {
  try {
    return await bcrypt.compare(password, hashedPassword);
  } catch (error) {
    logger.error('Error comparing password', error);
    throw new Error('Error comparing password', { cause: error });
  }
};

export const authenticateUser = async (email, password) => {
  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (!user) {
      logger.warn(`Authentication failed: no user with email ${email}`);
      throw new Error('Invalid credentials');
    }

    const isValid = await comparePassword(password, user.password);
    if (!isValid) {
      logger.warn(`Authentication failed: wrong password for ${email}`);
      throw new Error('Invalid credentials');
    }

    logger.info(`User authenticated successfully: ${email}`);
    return user;
  } catch (error) {
    // Both failure cases above are logged with more detail at the point they're
    // thrown; avoid double-logging them here, and reserve this for the unexpected case.
    if (error.message !== 'Invalid credentials') {
      logger.error('Error authenticating user', error);
    }
    throw error;
  }
};

export const createUser = async user => {
  try {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, user.email))
      .limit(1);
    if (existingUser.length > 0) throw new Error('User already exists');

    const password_hash = await hashPassword(user.password);

    const [newUser] = await db
      .insert(users)
      .values({
        name: user.name,
        email: user.email,
        password: password_hash,
        role: user.role,
        created_at: user.created_at,
      })
      .returning({
        id: users.id,
        name: users.name,
        email: users.email,
        role: users.role,
        created_at: users.created_at,
      });
    logger.info(`User created with email: ${newUser.email}`);
    return newUser;
  } catch (error) {
    logger.error('Error creating user', error);
    if (error.message === 'User already exists') {
      throw error;
    }
    throw new Error('Error creating user', { cause: error });
  }
};

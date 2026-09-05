import logger from '#config/logger.js';
import bcrypt from 'bcrypt';
import {eq} from 'drizzle-orm';
import { db } from '#config/database.js';
import { users } from '#models/user.model.js';


export const hashPassword = async (password) => {
    try {
        return await bcrypt.hash(password, 10);
    } catch (error) {
        logger.error('Error hashing password', error.message);
        throw new Error('Error hashing password');
    }   
};    

export const createUser = async (user) => {
    try {
        const existingUser =await db.select().from(users).where(eq(users.email, user.email)).limit(1);
        if (existingUser.length > 0) throw new Error('User already exists');

        const password_hash = await hashPassword(user.password);

        const [newUser] = await db
        .insert(users)
        .values({ name: user.name, email: user.email, password: password_hash, role: user.role, created_at: user.created_at })
        .returning({id: users.id, name: users.name, email: users.email, role: users.role, created_at: users.created_at});   
       logger.info(`User created with email: ${newUser.email}`);
       return newUser;
    } catch (error) {   
    logger.error('Error creating user', error.message);
    throw new Error('Error creating user');
}
};
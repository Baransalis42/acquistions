import { z } from 'zod';

export const signUpSchema = z.object({
  name: z.string().min(2).trim(),
  email: z.string().max(255).trim().email(),
  password: z.string().min(6).max(255),
  role: z.enum(['user', 'admin']).default('user'),
});

export const signinSchema = z.object({
  email: z.string().max(255).trim().email(),
  password: z.string().min(6).max(255),
});

import { z } from 'zod';

export const userIdSchema = z.object({
    id: z.coerce.number().int().positive(),
});

export const updateUserSchema = z.object({
    name: z.string().min(2).max(255).trim().optional(),
    email: z.string().max(255).trim().email().optional(),
    password: z.string().min(6).max(255).optional(),
    role: z.enum(['user', 'admin']).optional(),
}).refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided to update',
});

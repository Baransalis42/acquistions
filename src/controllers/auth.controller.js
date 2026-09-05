import logger from '#config/logger.js';
import { signUpSchema } from '#validations/auth.validation.js';
import { formatValidationErrors } from '#utils/format.js';
import { createUser } from '#services/auth.service.js';
import { jwttoken } from '#utils/jwt.js';
import { cookies } from '#utils/cookies.js';

export const signUp = async (req, res, next) => {
    try {
        const validationResult = signUpSchema.safeParse(req.body);
        if(!validationResult.success) {
            return res.status(400).json({
                error: "Validation error",
                details: formatValidationErrors(validationResult.error)
            });
        }

        const { name, email, role } = validationResult.data;

        const user = await createUser({ name, email, password: validationResult.data.password, role, created_at: new Date() });

        const token = jwttoken.sign({ id: user.id, email: user.email, role: user.role });

        cookies.setCookie(res, 'token', token);

        logger.info(`Creating user with email: ${email}`);
        res.status(201).json({ 
            message: 'User created successfully',
            user: {
                id: user.id, name: user.name, email: user.email, role: user.role
            }
         });
    } catch (e) {
        logger.error('Sign up error', e.message);

            if(e.message === 'User already exists') {
                return res.status(409).json({error: "email already exists"});
        }
        next(e);

    }
};
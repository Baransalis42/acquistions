import { jwttoken } from '#utils/jwt.js';
import { cookies } from '#utils/cookies.js';
import logger from '#config/logger.js';

const authenticateToken = (req, res, next) => {
  try {
    const token = cookies.getCookie(req, 'token');

    if (token) {
      req.user = jwttoken.verify(token);
    }
  } catch (e) {
    logger.warn('Ignoring invalid or expired auth token', e.message);
  }

  next();
};

export const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  next();
};

export default authenticateToken;

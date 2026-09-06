import express from 'express';
import logger from '#config/logger.js';
import helmet from 'helmet';
import morgan from 'morgan';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.routes.js';
import securityMiddleware from '#middleware/security.middleware.js';
import authenticateToken from '#middleware/auth.middleware.js';
import errorHandler from '#middleware/error.middleware.js';
import userRoutes from '#routes/user.routes.js';

const app = express();

// In production, only origins listed in ALLOWED_ORIGINS (comma-separated) may
// make cross-origin browser requests; unset means none are allowed. Non-production
// stays permissive so local dev/testing isn't blocked by missing configuration.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

app.use(
  cors(
    process.env.NODE_ENV === 'production'
      ? { origin: allowedOrigins }
      : undefined
  )
);
app.use(helmet());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

app.use(
  morgan('combined', {
    stream: { write: message => logger.info(message.trim()) },
  })
);

app.use(authenticateToken);
app.use(securityMiddleware);

app.get('/', (req, res) => {
  logger.info('Hello, from Acquisitions!');
  res.status(200).send('Hello, from Acquisitions!');
});

app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.get('/api', (req, res) => {
  res.status(200).json({ message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use(errorHandler);

export default app;

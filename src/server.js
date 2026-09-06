import logger from '#config/logger.js';
import app from './app.js';
import { sql } from '#config/database.js';

const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  logger.info(`Server is running on http://localhost:${PORT}`);
});

const shutdown = signal => {
  logger.info(`${signal} received: shutting down gracefully`);

  server.close(async err => {
    if (err) {
      logger.error('Error while closing HTTP server', err);
      process.exitCode = 1;
    }

    try {
      await sql.end?.();
    } catch (closeErr) {
      logger.error('Error while closing database connections', closeErr);
    }

    process.exit(process.exitCode || 0);
  });

  // Don't hang forever if in-flight requests never finish.
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10_000).unref();
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

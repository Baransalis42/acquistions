import logger from '#config/logger.js';

// Express recognizes error-handling middleware by arity (4 params) — _next
// must stay, even though this handler never calls it.
const errorHandler = (err, req, res, _next) => {
  logger.error(err.message, {
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  const status = err.status || err.statusCode || 500;
  const message =
    status === 500 && process.env.NODE_ENV === 'production'
      ? 'Internal Server Error'
      : err.message || 'Internal Server Error';

  res.status(status).json({ error: message });
};

export default errorHandler;

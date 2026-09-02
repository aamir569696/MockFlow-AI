/**
 * Global error handler — always returns a structured JSON envelope.
 * Raw stack traces are suppressed in production.
 */
export function errorHandler(err, req, res, _next) {
  const status = err.status || err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[Error] ${status} — ${err.message}`);

  res.status(status).json({
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred.',
      details: isProduction ? undefined : err.stack,
    },
  });
}

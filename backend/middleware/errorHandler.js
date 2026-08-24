/**
 * Centralized Error Handler Middleware
 */
function errorHandler(err, req, res, next) {
  console.error('[SERVER ERROR]:', err);

  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred. Please try again later.';

  const response = {
    success: false,
    message,
    code
  };

  if (err.attemptsRemaining !== undefined) {
    response.attemptsRemaining = err.attemptsRemaining;
  }

  return res.status(statusCode).json(response);
}

module.exports = errorHandler;

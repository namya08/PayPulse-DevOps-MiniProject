'use strict';

const logger = require('../logger');
const { ApiError } = require('../services/paymentService');

function notFoundHandler(req, res, next) {
  next(new ApiError(404, 'ROUTE_NOT_FOUND', `No route matches ${req.method} ${req.path}.`));
}

// Centralized error handler: every failure leaves through here with the
// same envelope: { error: { code, message, details? } }
function errorHandler(err, req, res, next) { // eslint-disable-line no-unused-vars
  const status = err.status || err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = status === 500 ? 'Internal server error.' : err.message;

  if (status === 500) {
    logger.error('unhandled error', {
      method: req.method,
      path: req.path,
      error: err.message,
      stack: err.stack
    });
  }

  const payload = { error: { code, message } };
  if (err.details) payload.error.details = err.details;
  res.status(status).json(payload);
}

module.exports = { errorHandler, notFoundHandler };

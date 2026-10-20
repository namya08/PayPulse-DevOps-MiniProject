'use strict';

const { randomUUID } = require('crypto');
const logger = require('../logger');

// Structured JSON request log with a request id for correlation.
function requestLogger(req, res, next) {
  const requestId = req.get('x-request-id') || randomUUID().slice(0, 12);
  req.requestId = requestId;
  res.set('x-request-id', requestId);
  const start = process.hrtime.bigint();

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    logger.info('http_request', {
      requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100
    });
  });

  next();
}

module.exports = { requestLogger };

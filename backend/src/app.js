'use strict';

const express = require('express');
const paymentsRouter = require('./routes/payments');
const { requestLogger } = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { metricsMiddleware, metricsHandler } = require('./metrics/metrics');

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(requestLogger);
  app.use(metricsMiddleware);

  // Liveness: process is up.
  app.get('/healthz', (req, res) => {
    res.json({ status: 'ok', uptimeSec: Math.round(process.uptime()) });
  });

  // Readiness: able to serve traffic.
  app.get('/readyz', (req, res) => {
    res.json({ status: 'ready', env: process.env.NODE_ENV || 'development' });
  });

  app.get('/metrics', metricsHandler);

  app.use('/api/payments', paymentsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };

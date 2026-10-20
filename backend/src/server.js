'use strict';

const { createApp } = require('./app');
const config = require('./config');
const logger = require('./logger');
const { store } = require('./services/paymentService');
const { setStoredGauges } = require('./metrics/metrics');

// Keep in-memory-store gauges in sync with the store (0 on startup).
setStoredGauges(store.countsByStatus());

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info('server_started', {
    port: config.port,
    env: config.env,
    failurePercent: config.failurePercent,
    pendingPercent: config.pendingPercent
  });
});

function shutdown(signal) {
  logger.info('server_stopping', { signal });
  server.close(() => {
    logger.info('server_stopped', {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

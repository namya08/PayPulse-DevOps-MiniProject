'use strict';

const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  env: process.env.NODE_ENV || 'development',
  // Deterministic simulation knobs (percentages 0-100, must total <= 100).
  // Remaining percentage becomes PENDING. Same orderId -> same outcome, always.
  failurePercent: clampPercent(process.env.SIM_FAILURE_PERCENT, 20),
  pendingPercent: clampPercent(process.env.SIM_PENDING_PERCENT, 10),
  logLevel: process.env.LOG_LEVEL || 'info'
};

function clampPercent(raw, fallback) {
  const n = parseInt(raw ?? '', 10);
  if (Number.isNaN(n) || n < 0 || n > 100) return fallback;
  return n;
}

module.exports = config;

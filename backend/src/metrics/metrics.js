'use strict';

const client = require('prom-client');

// Shared registry so tests can inspect and re-collect safely.
const register = new client.Registry();
register.setDefaultLabels({ app: 'payment-api' });
client.collectDefaultMetrics({ register });

const HTTP_BUCKETS = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5];

const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests handled, by method, route and status code.',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request latency in seconds, by method and route.',
  labelNames: ['method', 'route', 'status'],
  buckets: HTTP_BUCKETS,
  registers: [register]
});

const httpErrorsTotal = new client.Counter({
  name: 'http_errors_total',
  help: 'HTTP error responses (status >= 400), by route and status code.',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

const paymentTransactionsTotal = new client.Counter({
  name: 'payment_transactions_total',
  help: 'Payment transactions created, by simulated status.',
  labelNames: ['status'],
  registers: [register]
});

const paymentAmountTotal = new client.Counter({
  name: 'payment_amount_total',
  help: 'Simulated payment amount total, by status and currency (educational only).',
  labelNames: ['status', 'currency'],
  registers: [register]
});

const paymentTransactionsStored = new client.Gauge({
  name: 'payment_transactions_stored',
  help: 'Payment transactions currently held in the in-memory store, by status.',
  labelNames: ['status'],
  registers: [register]
});

// Resolve a low-cardinality route label after routing completed.
function normalizePath(full) {
  if (full.length > 1 && full.endsWith('/')) full = full.slice(0, -1);
  return full || '/';
}

function routeLabel(req) {
  if (req.route && req.route.path) {
    const full = normalizePath((req.baseUrl || '') + req.route.path);
    if (full !== '/') return full;
  }
  // Error responses leave the router (Express restores req.url), so route/
  // baseUrl can be empty or just "/" — fall back to a coarse, low-cardinality
  // mapping of the original URL so error series stay attached to the API.
  const path = (req.originalUrl || req.url || '').split('?')[0];
  if (path === '/metrics') return '/metrics';
  if (path === '/healthz') return '/healthz';
  if (path === '/readyz') return '/readyz';
  if (path === '/api/payments' || path.startsWith('/api/payments/')) return '/api/payments';
  return 'unmatched';
}

function metricsMiddleware(req, res, next) {
  const end = httpRequestDuration.startTimer();
  res.on('finish', () => {
    const route = routeLabel(req);
    const labels = {
      method: req.method,
      route,
      status: String(res.statusCode)
    };
    httpRequestsTotal.inc(labels);
    end(labels);
    if (res.statusCode >= 400) {
      httpErrorsTotal.inc({ method: req.method, route, status: String(res.statusCode) });
    }
  });
  next();
}

function recordTransaction(status, amount, currency) {
  paymentTransactionsTotal.inc({ status });
  paymentAmountTotal.inc({ status, currency }, amount);
  paymentTransactionsStored.inc({ status });
}

function setStoredGauges(counts) {
  for (const status of ['SUCCESS', 'FAILED', 'PENDING']) {
    paymentTransactionsStored.set({ status }, counts[status] || 0);
  }
}

async function metricsHandler(req, res) {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (err) {
    res.status(500).end();
  }
}

module.exports = {
  register,
  metricsMiddleware,
  metricsHandler,
  recordTransaction,
  setStoredGauges
};

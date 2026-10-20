'use strict';

const config = require('../config');
const { TransactionStore } = require('../store/transactionStore');

const store = new TransactionStore();

class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

// Deterministic outcome: hash(orderId) -> 0..99 bucket mapped through
// configured failure/pending percentages. Same orderId always yields the
// same status, which keeps load tests and demos reproducible.
function outcomeFor(orderId) {
  const bucket = hashBucket(orderId);
  if (bucket < config.failurePercent) return 'FAILED';
  if (bucket < config.failurePercent + config.pendingPercent) return 'PENDING';
  return 'SUCCESS';
}

function hashBucket(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h + str.charCodeAt(i)) >>> 0; // djb2, unsigned
  }
  return h % 100;
}

function createPayment(input) {
  const existing = store.getByOrderId(input.orderId);
  if (existing) {
    throw new ApiError(
      409,
      'DUPLICATE_ORDER_ID',
      `Order ID "${input.orderId}" already exists (transaction ${existing.id}).`,
      [{ field: 'orderId', issue: 'duplicate' }]
    );
  }
  const status = outcomeFor(input.orderId);
  const record = store.create({
    orderId: input.orderId,
    amount: input.amount,
    currency: input.currency,
    method: input.method,
    status,
    createdAt: new Date().toISOString()
  });
  return record;
}

function getPayment(id) {
  const record = store.getById(id);
  if (!record) {
    throw new ApiError(404, 'NOT_FOUND', `Transaction "${id}" was not found.`);
  }
  return record;
}

function listPayments(query) {
  return store.list(query);
}

function summary() {
  return store.summary();
}

module.exports = {
  store,
  ApiError,
  outcomeFor,
  createPayment,
  getPayment,
  listPayments,
  summary
};

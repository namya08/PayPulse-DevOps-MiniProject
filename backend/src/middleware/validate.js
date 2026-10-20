'use strict';

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const METHODS = ['card', 'upi', 'netbanking', 'wallet'];
const STATUSES = ['SUCCESS', 'FAILED', 'PENDING'];

function validatePaymentBody(body) {
  const details = [];
  const source = body && typeof body === 'object' ? body : {};

  const orderId = typeof source.orderId === 'string' ? source.orderId.trim() : '';
  if (!orderId) {
    details.push({ field: 'orderId', issue: 'required' });
  } else if (orderId.length < 3 || orderId.length > 40) {
    details.push({ field: 'orderId', issue: 'must be 3-40 characters' });
  } else if (!/^[A-Za-z0-9_-]+$/.test(orderId)) {
    details.push({ field: 'orderId', issue: 'only letters, digits, - and _ allowed' });
  }

  const amount = source.amount;
  if (amount === undefined || amount === null || amount === '') {
    details.push({ field: 'amount', issue: 'required' });
  } else if (typeof amount !== 'number' || Number.isNaN(amount)) {
    details.push({ field: 'amount', issue: 'must be a number' });
  } else if (amount <= 0) {
    details.push({ field: 'amount', issue: 'must be greater than 0' });
  } else if (amount > 1000000) {
    details.push({ field: 'amount', issue: 'must be 1000000 or less' });
  }

  const currency = source.currency;
  if (currency === undefined || currency === null || currency === '') {
    details.push({ field: 'currency', issue: 'required' });
  } else if (!CURRENCIES.includes(currency)) {
    details.push({ field: 'currency', issue: `must be one of ${CURRENCIES.join(', ')}` });
  }

  const method = source.method;
  if (method === undefined || method === null || method === '') {
    details.push({ field: 'method', issue: 'required' });
  } else if (!METHODS.includes(method)) {
    details.push({ field: 'method', issue: `must be one of ${METHODS.join(', ')}` });
  }

  if (details.length > 0) return { ok: false, details };
  return {
    ok: true,
    value: { orderId, amount: round2(amount), currency, method }
  };
}

function validateListQuery(query) {
  const details = [];
  const result = { page: 1, pageSize: 10 };

  if (query.status !== undefined && query.status !== '') {
    if (!STATUSES.includes(query.status)) {
      details.push({ field: 'status', issue: `must be one of ${STATUSES.join(', ')}` });
    } else {
      result.status = query.status;
    }
  }

  if (query.search !== undefined && query.search !== '') {
    const s = String(query.search);
    if (s.length > 60) details.push({ field: 'search', issue: 'must be 60 characters or less' });
    else result.search = s;
  }

  for (const key of ['page', 'pageSize']) {
    if (query[key] !== undefined && query[key] !== '') {
      const n = Number(query[key]);
      if (!Number.isInteger(n) || n < 1) {
        details.push({ field: key, issue: 'must be a positive integer' });
      } else if (key === 'pageSize' && n > 100) {
        details.push({ field: key, issue: 'must be 100 or less' });
      } else {
        result[key] = n;
      }
    }
  }

  if (details.length > 0) return { ok: false, details };
  return { ok: true, value: result };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

module.exports = { validatePaymentBody, validateListQuery, CURRENCIES, METHODS, STATUSES };

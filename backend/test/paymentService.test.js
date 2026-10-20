'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');
const { outcomeFor, createPayment, getPayment, ApiError, store } = require('../src/services/paymentService');
const config = require('../src/config');

describe('paymentService.outcomeFor (deterministic simulation)', () => {
  const original = { failure: config.failurePercent, pending: config.pendingPercent };

  afterEach(() => {
    config.failurePercent = original.failure;
    config.pendingPercent = original.pending;
  });

  test('same orderId always yields the same status', () => {
    const first = outcomeFor('ORD-DETERMINISTIC-1');
    const second = outcomeFor('ORD-DETERMINISTIC-1');
    expect(first).toBe(second);
    expect(['SUCCESS', 'FAILED', 'PENDING']).toContain(first);
  });

  test('different orderIds are not forced to one status', () => {
    const statuses = new Set();
    for (let i = 0; i < 200; i++) statuses.add(outcomeFor(`ORD-BATCH-${i}`));
    expect(statuses.size).toBeGreaterThan(1);
  });

  test('simulation percentages are respected when configured', () => {
    config.failurePercent = 0;
    config.pendingPercent = 0;
    for (let i = 0; i < 100; i++) expect(outcomeFor(`ALL-SUCCESS-${i}`)).toBe('SUCCESS');

    config.failurePercent = 100;
    config.pendingPercent = 0;
    for (let i = 0; i < 100; i++) expect(outcomeFor(`ALL-FAILED-${i}`)).toBe('FAILED');

    config.failurePercent = 0;
    config.pendingPercent = 100;
    for (let i = 0; i < 100; i++) expect(outcomeFor(`ALL-PENDING-${i}`)).toBe('PENDING');
  });
});

describe('paymentService.createPayment / getPayment', () => {
  test('creates a transaction and retrieves it by id', () => {
    const created = createPayment({
      orderId: 'ORD-SVC-001',
      amount: 250.5,
      currency: 'INR',
      method: 'upi'
    });
    expect(created.id).toMatch(/^TXN-[A-F0-9]{8}$/);
    expect(created.status).toMatch(/^(SUCCESS|FAILED|PENDING)$/);
    expect(getPayment(created.id)).toEqual(created);
    expect(store.getByOrderId('ORD-SVC-001').id).toBe(created.id);
  });

  test('rejects duplicate order IDs with ApiError 409', () => {
    createPayment({ orderId: 'ORD-SVC-DUP', amount: 10, currency: 'USD', method: 'card' });
    try {
      createPayment({ orderId: 'ORD-SVC-DUP', amount: 20, currency: 'USD', method: 'card' });
      throw new Error('expected duplicate to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(409);
      expect(err.code).toBe('DUPLICATE_ORDER_ID');
    }
  });

  test('throws ApiError 404 for unknown transaction id', () => {
    try {
      getPayment('TXN-00000000');
      throw new Error('expected not found to throw');
    } catch (err) {
      expect(err).toBeInstanceOf(ApiError);
      expect(err.status).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    }
  });
});

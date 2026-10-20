'use strict';

const request = require('supertest');
const { createApp } = require('../src/app');

const app = createApp();

function postPayment(body) {
  return request(app).post('/api/payments').send(body);
}

describe('health and readiness', () => {
  test('GET /healthz returns 200 ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSec).toBe('number');
  });

  test('GET /readyz returns 200 ready', async () => {
    const res = await request(app).get('/readyz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ready');
  });
});

describe('POST /api/payments', () => {
  test('creates a payment and returns 201 with full transaction shape', async () => {
    const res = await postPayment({
      orderId: 'ORD-1001',
      amount: 1999.99,
      currency: 'INR',
      method: 'card'
    });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      orderId: 'ORD-1001',
      amount: 1999.99,
      currency: 'INR',
      method: 'card'
    });
    expect(res.body.id).toMatch(/^TXN-/);
    expect(['SUCCESS', 'FAILED', 'PENDING']).toContain(res.body.status);
    expect(typeof res.body.createdAt).toBe('string');
  });

  test('rejects an empty body with 400 VALIDATION_ERROR', async () => {
    const res = await postPayment({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual(['amount', 'currency', 'method', 'orderId']);
  });

  test('rejects invalid values with 400 and field-level details', async () => {
    const res = await postPayment({
      orderId: 'x',
      amount: -5,
      currency: 'JPY',
      method: 'crypto'
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    const fields = res.body.error.details.map((d) => d.field).sort();
    expect(fields).toEqual(['amount', 'currency', 'method', 'orderId']);
  });

  test('rejects a non-numeric amount with 400', async () => {
    const res = await postPayment({
      orderId: 'ORD-1002',
      amount: 'abc',
      currency: 'USD',
      method: 'upi'
    });
    expect(res.status).toBe(400);
    expect(res.body.error.details.some((d) => d.field === 'amount')).toBe(true);
  });

  test('duplicate order ID returns 409 DUPLICATE_ORDER_ID', async () => {
    const first = await postPayment({
      orderId: 'ORD-DUP-1',
      amount: 100,
      currency: 'INR',
      method: 'wallet'
    });
    expect(first.status).toBe(201);

    const second = await postPayment({
      orderId: 'ORD-DUP-1',
      amount: 200,
      currency: 'INR',
      method: 'wallet'
    });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe('DUPLICATE_ORDER_ID');
    expect(second.body.error.details[0].field).toBe('orderId');
  });

  test('malformed JSON body returns 400 with consistent error envelope', async () => {
    const res = await request(app)
      .post('/api/payments')
      .set('Content-Type', 'application/json')
      .send('{ not json');
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
    expect(typeof res.body.error.code).toBe('string');
  });
});

describe('GET /api/payments', () => {
  test('returns items, pagination and summary', async () => {
    await postPayment({ orderId: 'ORD-LIST-1', amount: 10, currency: 'INR', method: 'upi' });
    await postPayment({ orderId: 'ORD-LIST-2', amount: 20, currency: 'USD', method: 'card' });

    const res = await request(app).get('/api/payments?page=1&pageSize=10');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.pagination).toMatchObject({ page: 1, pageSize: 10 });
    expect(res.body.pagination.total).toBeGreaterThanOrEqual(2);
    expect(res.body.summary).toHaveProperty('total');
    expect(res.body.summary).toHaveProperty('counts');
    expect(res.body.summary.counts).toHaveProperty('SUCCESS');
    expect(res.body.summary.counts).toHaveProperty('FAILED');
    expect(res.body.summary.counts).toHaveProperty('PENDING');
  });

  test('filters by status', async () => {
    const res = await request(app).get('/api/payments?status=PENDING&pageSize=100');
    expect(res.status).toBe(200);
    for (const item of res.body.items) expect(item.status).toBe('PENDING');
  });

  test('rejects invalid status filter with 400', async () => {
    const res = await request(app).get('/api/payments?status=BOGUS');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('rejects invalid pagination with 400', async () => {
    const res = await request(app).get('/api/payments?page=-3');
    expect(res.status).toBe(400);
    expect(res.body.error.details[0].field).toBe('page');
  });

  test('paginates newest first with hasNext/hasPrev flags', async () => {
    for (let i = 0; i < 5; i++) {
      await postPayment({ orderId: `ORD-PAGE-${i}`, amount: 11, currency: 'EUR', method: 'netbanking' });
    }
    const res = await request(app).get('/api/payments?page=1&pageSize=2');
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBe(2);
    expect(res.body.pagination.hasNext).toBe(true);
    expect(res.body.pagination.hasPrev).toBe(false);

    const page2 = await request(app).get('/api/payments?page=2&pageSize=2');
    expect(page2.body.pagination.hasPrev).toBe(true);
    expect(page2.body.items[0].id).not.toBe(res.body.items[0].id);
  });
});

describe('GET /api/payments/:id and /summary', () => {
  test('returns a created transaction by id', async () => {
    const created = await postPayment({
      orderId: 'ORD-BYID-1',
      amount: 55.5,
      currency: 'GBP',
      method: 'netbanking'
    });
    const res = await request(app).get(`/api/payments/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
  });

  test('unknown transaction id returns 404 NOT_FOUND', async () => {
    const res = await request(app).get('/api/payments/TXN-DEADBEEF');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  test('GET /api/payments/summary returns totals', async () => {
    const res = await request(app).get('/api/payments/summary');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('counts');
    expect(res.body).toHaveProperty('amounts');
    const total = Object.values(res.body.counts).reduce((a, b) => a + b, 0);
    expect(total).toBe(res.body.total);
  });
});

describe('errors, logging headers and metrics', () => {
  test('unknown route returns 404 with consistent envelope', async () => {
    const res = await request(app).get('/api/unknown-thing');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ROUTE_NOT_FOUND');
    expect(typeof res.body.error.message).toBe('string');
  });

  test('responses carry an x-request-id correlation header', async () => {
    const res = await request(app).get('/healthz');
    expect(res.headers['x-request-id']).toBeTruthy();
  });

  test('GET /metrics exposes Prometheus metrics including app counters', async () => {
    await postPayment({ orderId: 'ORD-METRICS-1', amount: 1, currency: 'INR', method: 'card' });
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('http_requests_total');
    expect(res.text).toContain('http_request_duration_seconds');
    expect(res.text).toContain('http_errors_total');
    expect(res.text).toContain('payment_transactions_total');
    expect(res.text).toContain('payment_amount_total');
    expect(res.text).toContain('nodejs_heap_size_used_bytes');
    // route label should be the real route, not the raw id (cardinality control)
    expect(res.text).toContain('route="/api/payments"');
  });

  test('404s are counted in http_errors_total', async () => {
    const labels = ['http_errors_total{', 'method="GET"', 'route="unmatched"', 'status="404"'];
    const before = extractMetric((await request(app).get('/metrics')).text, labels);
    await request(app).get('/definitely-missing');
    const after = extractMetric((await request(app).get('/metrics')).text, labels);
    expect(after).toBeGreaterThan(before);
  });

  test('error responses keep their mounted route label (no cardinality leak)', async () => {
    await postPayment({ orderId: 'ORD-LABEL-1', amount: 10, currency: 'INR', method: 'card' });
    await postPayment({ orderId: 'ORD-LABEL-1', amount: 10, currency: 'INR', method: 'card' }); // 409
    const text = (await request(app).get('/metrics')).text;
    expect(text).toContain('http_errors_total{method="POST",route="/api/payments",status="409"');
    expect(text).not.toContain('route="/",status="409"');
  });

  function extractMetric(text, labels) {
    const lines = text
      .split('\n')
      .filter((l) => labels.every((s) => l.includes(s)));
    if (lines.length === 0) return 0;
    const last = lines[lines.length - 1];
    return Number(last.trim().split(/\s+/).pop());
  }
});

'use strict';

const express = require('express');
const service = require('../services/paymentService');
const { ApiError } = service;
const { validatePaymentBody, validateListQuery } = require('../middleware/validate');
const { recordTransaction } = require('../metrics/metrics');
const logger = require('../logger');

const router = express.Router();

// POST /api/payments
router.post('/', (req, res, next) => {
  try {
    const validated = validatePaymentBody(req.body);
    if (!validated.ok) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Request body failed validation.', validated.details);
    }
    const txn = service.createPayment(validated.value);
    recordTransaction(txn.status, txn.amount, txn.currency);
    logger.info('payment_created', {
      transactionId: txn.id,
      orderId: txn.orderId,
      status: txn.status,
      currency: txn.currency
    });
    res.status(201).json(txn);
  } catch (err) {
    next(err);
  }
});

// GET /api/payments?page=&pageSize=&status=&search=
router.get('/', (req, res, next) => {
  try {
    const validated = validateListQuery(req.query);
    if (!validated.ok) {
      throw new ApiError(400, 'VALIDATION_ERROR', 'Query parameters failed validation.', validated.details);
    }
    const { items, total, page, pageSize } = service.listPayments(validated.value);
    res.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
        hasNext: page * pageSize < total,
        hasPrev: page > 1
      },
      summary: service.summary()
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/payments/summary
router.get('/summary', (req, res) => {
  res.json(service.summary());
});

// GET /api/payments/:id
router.get('/:id', (req, res, next) => {
  try {
    res.json(service.getPayment(req.params.id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;

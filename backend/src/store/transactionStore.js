'use strict';

const { randomUUID } = require('crypto');

// Simple in-memory store. Educational simulation only - data is lost on restart.
class TransactionStore {
  constructor() {
    this.byOrderId = new Map(); // orderId -> transaction (duplicate detection)
    this.byId = new Map(); // id -> transaction
    this.order = []; // insertion order of ids (newest first after unshift)
  }

  create(txn) {
    const id = `TXN-${randomUUID().slice(0, 8).toUpperCase()}`;
    const record = { id, ...txn };
    this.byId.set(id, record);
    this.byOrderId.set(txn.orderId, record);
    this.order.unshift(id);
    return record;
  }

  getById(id) {
    return this.byId.get(id) || null;
  }

  getByOrderId(orderId) {
    return this.byOrderId.get(orderId) || null;
  }

  list({ status, page = 1, pageSize = 10, search } = {}) {
    let items = this.order.map((id) => this.byId.get(id));
    if (status) items = items.filter((t) => t.status === status);
    if (search) {
      const needle = search.toLowerCase();
      items = items.filter(
        (t) =>
          t.id.toLowerCase().includes(needle) ||
          t.orderId.toLowerCase().includes(needle)
      );
    }
    const total = items.length;
    const start = (page - 1) * pageSize;
    const paged = items.slice(start, start + pageSize);
    return { items: paged, total, page, pageSize };
  }

  summary() {
    const counts = { SUCCESS: 0, FAILED: 0, PENDING: 0 };
    const amounts = { SUCCESS: 0, FAILED: 0, PENDING: 0 };
    let total = 0;
    for (const id of this.order) {
      const t = this.byId.get(id);
      counts[t.status] += 1;
      amounts[t.status] += t.amount;
      total += 1;
    }
    return { total, counts, amounts };
  }

  countsByStatus() {
    return this.summary().counts;
  }

  size() {
    return this.byId.size;
  }
}

module.exports = { TransactionStore };

import { useState } from 'react';
import { createPayment } from '../api.js';
import { CURRENCIES, METHODS } from './StatsCards.jsx';
import StatusBadge from './StatusBadge.jsx';

const INITIAL = { orderId: '', amount: '', currency: 'INR', method: 'card' };

export default function PaymentForm({ onCreated }) {
  const [form, setForm] = useState(INITIAL);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setError(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setResult(null);
    try {
      const payload = {
        orderId: form.orderId.trim(),
        amount: form.amount === '' ? undefined : Number(form.amount),
        currency: form.currency,
        method: form.method
      };
      const txn = await createPayment(payload);
      setResult(txn);
      setForm((f) => ({ ...f, orderId: '' }));
      onCreated?.(txn);
    } catch (err) {
      const detail = err.details?.[0];
      setError(detail ? `${err.message} (${detail.field}: ${detail.issue})` : err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2>New payment</h2>
        <span className="hint">Simulated — no real money moves</span>
      </div>

      <form className="payment-form" onSubmit={handleSubmit}>
        <label className="field field-wide">
          <span>Order ID</span>
          <input
            type="text"
            placeholder="ORD-2024-001"
            value={form.orderId}
            onChange={(e) => update('orderId', e.target.value)}
            maxLength={40}
            required
          />
        </label>

        <label className="field">
          <span>Amount</span>
          <input
            type="number"
            min="0.01"
            max="1000000"
            step="0.01"
            placeholder="999.00"
            value={form.amount}
            onChange={(e) => update('amount', e.target.value)}
            required
          />
        </label>

        <label className="field">
          <span>Currency</span>
          <select value={form.currency} onChange={(e) => update('currency', e.target.value)}>
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Method</span>
          <select value={form.method} onChange={(e) => update('method', e.target.value)}>
            {METHODS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </label>

        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Processing…' : 'Create payment'}
        </button>
      </form>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}
        </div>
      )}

      {result && (
        <div className="alert alert-ok" role="status">
          Created <strong>{result.id}</strong> for <strong>{result.orderId}</strong>{' '}
          — <StatusBadge status={result.status} />
          <span className="muted"> (deterministic simulation)</span>
        </div>
      )}
    </section>
  );
}

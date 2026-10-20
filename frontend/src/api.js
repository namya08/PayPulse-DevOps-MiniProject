// Thin API client. All calls go through relative paths so the Vite dev
// proxy (dev) and nginx (Docker) can route them to the backend.

async function request(path, options = {}) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options
  });
  let body = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = body?.error?.code || 'UNKNOWN';
    err.details = body?.error?.details;
    throw err;
  }
  return body;
}

export function listPayments({ page = 1, pageSize = 10, status = '' } = {}) {
  const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (status) params.set('status', status);
  return request(`/api/payments?${params.toString()}`);
}

export function createPayment(payload) {
  return request('/api/payments', { method: 'POST', body: JSON.stringify(payload) });
}

export function getPayment(id) {
  return request(`/api/payments/${encodeURIComponent(id)}`);
}

export function getSummary() {
  return request('/api/payments/summary');
}

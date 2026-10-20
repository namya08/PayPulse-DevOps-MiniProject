import { useCallback, useEffect, useRef, useState } from 'react';
import { listPayments, getSummary } from './api.js';
import StatsCards from './components/StatsCards.jsx';
import PaymentForm from './components/PaymentForm.jsx';
import TransactionTable from './components/TransactionTable.jsx';

const PAGE_SIZE = 10;
const REFRESH_MS = 8000;

export default function App() {
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [summary, setSummary] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [apiUp, setApiUp] = useState(null);
  const mounted = useRef(true);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const data = await listPayments({ page, pageSize: PAGE_SIZE, status: statusFilter });
      if (!mounted.current) return;
      setItems(data.items);
      setPagination(data.pagination);
      setSummary(data.summary);
      setError(null);
      setApiUp(true);
    } catch (err) {
      if (!mounted.current) return;
      setError(err.message);
      setApiUp(false);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    mounted.current = true;
    load();
    const timer = setInterval(() => load({ silent: true }), REFRESH_MS);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [load]);

  function handleStatusFilterChange(value) {
    setStatusFilter(value);
    setPage(1);
  }

  function handleCreated() {
    setPage(1);
    load({ silent: true });
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">₹</span>
          <div>
            <h1>PayPulse</h1>
            <p>Simulated digital payments · DevOps demo</p>
          </div>
        </div>
        <span className={`api-pill ${apiUp === false ? 'pill-down' : 'pill-up'}`}>
          API {apiUp === false ? 'unreachable' : apiUp ? 'connected' : 'checking…'}
        </span>
      </header>

      <main className="content">
        <StatsCards summary={summary} loading={loading} />
        <PaymentForm onCreated={handleCreated} />
        <TransactionTable
          items={items}
          loading={loading}
          error={error}
          onRetry={() => load()}
          statusFilter={statusFilter}
          onStatusFilterChange={handleStatusFilterChange}
          pagination={pagination}
          onPageChange={setPage}
        />
      </main>

      <footer className="footer">
        Educational simulation — in-memory store, no real payment gateway. Metrics on{' '}
        <code>/metrics</code> · Health on <code>/healthz</code>
      </footer>
    </div>
  );
}

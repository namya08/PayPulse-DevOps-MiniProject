import StatusBadge from './StatusBadge.jsx';
import { formatAmount } from './StatsCards.jsx';

const STATUSES = ['', 'SUCCESS', 'FAILED', 'PENDING'];

export default function TransactionTable({
  items,
  loading,
  error,
  onRetry,
  statusFilter,
  onStatusFilterChange,
  pagination,
  onPageChange
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h2>Transaction history</h2>
        <label className="filter">
          <span>Status</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
          >
            {STATUSES.map((s) => (
              <option key={s || 'all'} value={s}>
                {s || 'All'}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div className="alert alert-error" role="alert">
          {error}{' '}
          <button className="btn btn-link" onClick={onRetry} type="button">
            Retry
          </button>
        </div>
      )}

      {loading && !items.length && (
        <div className="state-block" aria-busy="true">
          <div className="spinner" />
          <p>Loading transactions…</p>
        </div>
      )}

      {!loading && !error && !items.length && (
        <div className="state-block">
          <p className="empty-title">No transactions yet</p>
          <p className="muted">
            {statusFilter
              ? `No ${statusFilter} transactions found.`
              : 'Create your first payment using the form above.'}
          </p>
        </div>
      )}

      {!!items.length && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Transaction ID</th>
                <th>Order ID</th>
                <th className="num">Amount</th>
                <th>Method</th>
                <th>Timestamp</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.id}>
                  <td className="mono">{t.id}</td>
                  <td className="mono">{t.orderId}</td>
                  <td className="num">
                    {formatAmount(t.amount)} {t.currency}
                  </td>
                  <td>{t.method}</td>
                  <td>{new Date(t.createdAt).toLocaleString()}</td>
                  <td>
                    <StatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="pager">
        <button
          type="button"
          className="btn"
          disabled={!pagination || !pagination.hasPrev || loading}
          onClick={() => onPageChange(pagination.page - 1)}
        >
          ← Prev
        </button>
        <span className="muted">
          Page {pagination?.page ?? 1} of {pagination?.totalPages ?? 1} ·{' '}
          {pagination?.total ?? 0} total
        </span>
        <button
          type="button"
          className="btn"
          disabled={!pagination || !pagination.hasNext || loading}
          onClick={() => onPageChange(pagination.page + 1)}
        >
          Next →
        </button>
      </div>
    </section>
  );
}

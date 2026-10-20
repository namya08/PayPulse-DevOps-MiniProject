const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];
const METHODS = ['card', 'upi', 'netbanking', 'wallet'];

function formatAmount(amount) {
  return amount.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

export default function StatsCards({ summary, loading }) {
  const counts = summary?.counts || { SUCCESS: 0, FAILED: 0, PENDING: 0 };
  const amounts = summary?.amounts || { SUCCESS: 0, FAILED: 0, PENDING: 0 };
  const total = summary?.total ?? 0;
  const successShare = total > 0 ? Math.round((counts.SUCCESS / total) * 100) : 0;

  if (loading && !summary) {
    return (
      <div className="stats-grid">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="stat-card skeleton" />
        ))}
      </div>
    );
  }

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <span className="stat-label">Total transactions</span>
        <span className="stat-value">{total}</span>
        <span className="stat-sub">{successShare}% successful</span>
      </div>
      <div className="stat-card stat-success">
        <span className="stat-label">Success</span>
        <span className="stat-value">{counts.SUCCESS}</span>
        <span className="stat-sub">Pooled amount {formatAmount(amounts.SUCCESS)}</span>
      </div>
      <div className="stat-card stat-failed">
        <span className="stat-label">Failed</span>
        <span className="stat-value">{counts.FAILED}</span>
        <span className="stat-sub">Simulated declines</span>
      </div>
      <div className="stat-card stat-pending">
        <span className="stat-label">Pending</span>
        <span className="stat-value">{counts.PENDING}</span>
        <span className="stat-sub">Awaiting settlement</span>
      </div>
    </div>
  );
}

export { METHODS, CURRENCIES, formatAmount };

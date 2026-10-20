export default function StatusBadge({ status }) {
  const cls =
    status === 'SUCCESS' ? 'badge badge-success' :
    status === 'FAILED' ? 'badge badge-failed' :
    'badge badge-pending';
  return <span className={cls}>{status}</span>;
}

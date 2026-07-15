function StatusCard({ title, status }) {
  const statusConfig = {
    ready: {
      icon: "🟢",
      text: "Ready",
    },
    loading: {
      icon: "🟡",
      text: "Loading...",
    },
    pending: {
      icon: "⚪",
      text: "Pending",
    },
    error: {
      icon: "🔴",
      text: "Error",
    },
  };

  const current = statusConfig[status] || statusConfig.pending;

  return (
    <div className="status-card">
      <strong>{title}</strong>
      <div>
        {current.icon} {current.text}
      </div>
    </div>
  );
}

export default StatusCard;


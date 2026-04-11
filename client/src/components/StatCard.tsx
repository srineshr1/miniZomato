interface StatCardProps {
  icon: string;
  value: string | number;
  label: string;
  color: 'amber' | 'green' | 'blue' | 'red';
  delta?: string;
  deltaType?: 'up' | 'down';
}

export default function StatCard({ icon, value, label, color, delta, deltaType = 'up' }: StatCardProps) {
  return (
    <div className={`stat-card ${color}`}>
      <div className="stat-icon">{icon}</div>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
      {delta && <div className={`stat-delta ${deltaType}`}>{delta}</div>}
    </div>
  );
}
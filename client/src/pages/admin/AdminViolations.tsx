import { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import StatCard from '../../components/StatCard';
import Panel from '../../components/Panel';
import { safetyService } from '../../services/adminService';
import { Violation } from '../../types';

export default function AdminViolations() {
  const [violations, setViolations] = useState<Violation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadViolations(); }, []);

  const loadViolations = async () => {
    try {
      const data = await safetyService.listViolations();
      setViolations(data);
    } catch {
      setViolations([]);
    } finally {
      setLoading(false);
    }
  };

  const typeIcon = (type: string) => {
    switch (type) {
      case 'speed': return '🚀';
      case 'helmet': return '⛑️';
      case 'camera': return '📷';
      default: return '⚠️';
    }
  };

  const resolveViolation = async (id: number) => {
    try {
      await safetyService.resolveViolation(id);
      setViolations((prev) => prev.map((v) => v.id === id ? { ...v, resolved: true } : v));
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      <TopBar title="Violations Center" subtitle="Speed · Helmet · Camera violations">
        <span className="chip danger">{violations.filter((v) => !v.resolved).length} Today</span>
      </TopBar>
      <div className="content">
        <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <StatCard icon="🚀" value={violations.filter((v) => v.type === 'speed').length} label="Speed Violations" color="red" />
          <StatCard icon="⛑️" value={violations.filter((v) => v.type === 'helmet').length} label="Helmet Violations" color="amber" />
          <StatCard icon="📷" value={violations.filter((v) => v.type === 'camera').length} label="Camera Violations" color="blue" />
        </div>

        <Panel title="All Violations">
          <table className="table">
            <thead>
              <tr><th>Partner</th><th>Type</th><th>Detail</th><th>Time</th><th>Offense #</th><th>Action</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>Loading...</td></tr>
              ) : violations.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text3)', padding: 20 }}>No violations found</td></tr>
              ) : (
                violations.map((v) => (
                  <tr key={v.id}>
                    <td><strong>{v.partner_name || `Partner #${v.partner_id}`}</strong></td>
                    <td>{typeIcon(v.type)} {v.type.charAt(0).toUpperCase() + v.type.slice(1)}</td>
                    <td>{v.detail || '—'}</td>
                    <td className="text-mono">{new Date(v.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td><span className={`chip ${v.offense_count >= 2 ? 'danger' : 'transit'}`}>{v.offense_count}{v.offense_count === 1 ? 'st' : v.offense_count === 2 ? 'nd' : 'rd'}</span></td>
                    <td>
                      {v.resolved ? (
                        <span style={{ color: 'var(--green)', fontSize: 12 }}>Resolved</span>
                      ) : v.severity === 'penalty' ? (
                        <button className="btn btn-danger" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => resolveViolation(v.id)}>Penalize</button>
                      ) : (
                        <button className="btn btn-ghost" style={{ fontSize: 10, padding: '4px 10px' }} onClick={() => resolveViolation(v.id)}>Warn</button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Panel>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import StatCard from '../../components/StatCard';
import Panel from '../../components/Panel';
import Chip from '../../components/Chip';
import { adminService } from '../../services/adminService';
import { DashboardStats, Order } from '../../types';
import { statusLabel } from '../../utils/status';

export default function AdminOverview() {
  const [stats, setStats] = useState<DashboardStats>({
    total_orders: 0, active_orders: 0, active_partners: 0,
    avg_delivery_minutes: 0, violations_today: 0, revenue_today: 0, delivered_today: 0,
  });
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [s, o] = await Promise.all([adminService.getStats(), adminService.getRecentOrders()]);
      setStats(s);
      setRecentOrders(o);
    } catch {
      setStats({
        total_orders: 0,
        active_orders: 0,
        active_partners: 0,
        avg_delivery_minutes: 0,
        violations_today: 0,
        revenue_today: 0,
        delivered_today: 0,
      });
      setRecentOrders([]);
    } finally {
      setLoading(false);
    }
  };

  const statusChip = (status: string) => {
    switch (status) {
      case 'delivered': return <Chip type="delivered">Delivered</Chip>;
      case 'in_transit': return <Chip type="transit">In Transit</Chip>;
      case 'picked_up': return <Chip type="transit">Picked Up</Chip>;
      default: return <Chip type="pending">Pending</Chip>;
    }
  };

  return (
    <>
      <TopBar title="Admin Overview" subtitle="Smart Route Control Center">
        <div className="status-pill online"><div className="dot" /> {loading ? 'Loading' : 'Live'}</div>
      </TopBar>
      <div className="content">
        <div className="stats-grid">
          <StatCard icon="📦" value={stats.total_orders} label="Total Orders" color="amber" />
          <StatCard icon="🛵" value={stats.active_partners} label="Active Partners" color="green" />
          <StatCard icon="⏱️" value={stats.avg_delivery_minutes} label="Avg Delivery (min)" color="blue" />
          <StatCard icon="⚠️" value={stats.violations_today} label="Open Violations" color="red" />
        </div>

        <div className="two-col">
          <Panel title="Recent Orders" action={<span className="chip transit">{recentOrders.length} Loaded</span>}>
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Partner</th>
                  <th>Status</th>
                  <th>ETA</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={5} style={{ color: 'var(--text3)', textAlign: 'center', padding: 20 }}>Loading...</td></tr>
                ) : recentOrders.length > 0 ? recentOrders.slice(0, 5).map((o) => (
                  <tr key={o.id}>
                    <td><span className="text-mono text-amber">#{o.order_number}</span></td>
                    <td>Customer #{o.customer_id}</td>
                    <td>{o.partner_id ? 'Partner #' + o.partner_id : '—'}</td>
                    <td>{statusChip(o.status)}</td>
                    <td><span className="text-mono">{o.eta_minutes} min</span></td>
                  </tr>
                )) : (
                  <tr><td colSpan={5} style={{ color: 'var(--text3)', textAlign: 'center', padding: 20 }}>No recent orders</td></tr>
                )}
              </tbody>
            </table>
          </Panel>

          <Panel title="Operational Snapshot">
            <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>Active Orders</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{stats.active_orders}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>Delivered Today</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>{stats.delivered_today}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>Revenue Today</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>₹{stats.revenue_today.toFixed(2)}</span>
              </div>
              {recentOrders[0] && (
                <div className="alert-box" style={{ marginBottom: 0 }}>
                  Latest order #{recentOrders[0].order_number} is {statusLabel(recentOrders[0].status)}.
                </div>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import Chip from '../../components/Chip';
import { orderService } from '../../services/orderService';
import { Order } from '../../types';

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [search, setSearch] = useState('');

  useEffect(() => { loadOrders(); }, []);

  const loadOrders = async () => {
    try {
      const data = await orderService.list();
      setOrders(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const statusChip = (s: string) => {
    switch (s) {
      case 'delivered': return <Chip type="delivered">Delivered</Chip>;
      case 'in_transit': return <Chip type="transit">In Transit</Chip>;
      case 'picked_up': return <Chip type="transit">Picked Up</Chip>;
      case 'pending': return <Chip type="pending">Pending</Chip>;
      case 'confirmed': return <Chip type="transit">Confirmed</Chip>;
      case 'preparing': return <Chip type="transit">Preparing</Chip>;
      case 'ready': return <Chip type="transit">Ready</Chip>;
      default: return <Chip type="pending">{s}</Chip>;
    }
  };

  const filtered = orders.filter((o) => {
    if (filter && o.status !== filter) return false;
    if (!search.trim()) return true;

    const haystack = [
      o.order_number,
      `customer ${o.customer_id}`,
      ...(o.items?.map((i) => i.food_item_name || `item ${i.food_item_id}`) || []),
    ].join(' ').toLowerCase();

    return haystack.includes(search.toLowerCase());
  });

  return (
    <>
      <TopBar title="Orders Management" subtitle="All orders · Live view">
        <div className="search-bar">
          <span style={{ color: 'var(--text3)' }}>🔍</span>
          <input placeholder="Search orders..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <button className="btn btn-primary" onClick={loadOrders} disabled={loading}>{loading ? 'Refreshing...' : 'Refresh'}</button>
      </TopBar>
      <div className="content">
        <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
          <button className={`category-chip ${!filter ? 'active' : ''}`} onClick={() => setFilter('')}>All ({orders.length})</button>
          <button className={`category-chip ${filter === 'in_transit' ? 'active' : ''}`} onClick={() => setFilter('in_transit')}>In Transit</button>
          <button className={`category-chip ${filter === 'pending' ? 'active' : ''}`} onClick={() => setFilter('pending')}>Pending</button>
          <button className={`category-chip ${filter === 'delivered' ? 'active' : ''}`} onClick={() => setFilter('delivered')}>Delivered</button>
        </div>
        <Panel title={`All Orders${filter ? ` · ${filter}` : ''}`}>
          <table className="table">
            <thead>
              <tr><th>Order ID</th><th>Customer</th><th>Items</th><th>Amount</th><th>Status</th><th>ETA</th></tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>No orders found</td></tr>
              ) : (
                filtered.map((o) => (
                  <tr key={o.id}>
                    <td><span className="text-mono text-amber">#{o.order_number}</span></td>
                    <td>Customer #{o.customer_id}</td>
                    <td>{o.items?.map((i) => i.food_item_name || `Item`).join(', ') || '—'}</td>
                    <td>₹{o.total_amount}</td>
                    <td>{statusChip(o.status)}</td>
                    <td><span className="text-mono">{o.status === 'delivered' ? '—' : `${o.eta_minutes} min`}</span></td>
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

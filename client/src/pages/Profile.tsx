import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopBar from '../components/TopBar';
import { useAuth } from '../contexts/AuthContext';
import { deliveryService } from '../services/deliveryService';
import { orderService } from '../services/orderService';
import { adminService } from '../services/adminService';
import { DeliveryPartner, Order, DashboardStats } from '../types';

export default function Profile() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [partnerData, setPartnerData] = useState<DeliveryPartner | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [adminStats, setAdminStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        if (user?.role === 'delivery') {
          const [p, o] = await Promise.all([deliveryService.me(), orderService.list()]);
          setPartnerData(p);
          setOrders(o);
        } else if (user?.role === 'customer') {
          const o = await orderService.list();
          setOrders(o);
        } else if (user?.role === 'admin') {
          const s = await adminService.getStats();
          setAdminStats(s);
        }
      } catch {}
      setLoading(false);
    };
    void load();
  }, [user]);

  const handleSignOut = () => { logout(); navigate('/login'); };

  const deliveredOrders = orders.filter((o) => o.status === 'delivered');
  const totalSpent = deliveredOrders.reduce((s, o) => s + o.total_amount, 0);
  const activeOrders = orders.filter((o) => !['delivered', 'cancelled'].includes(o.status));

  const renderStars = (rating: number) => {
    const full = Math.floor(rating);
    const half = rating % 1 >= 0.5;
    const empty = 5 - full - (half ? 1 : 0);
    return '★'.repeat(full) + (half ? '⯨' : '') + '☆'.repeat(empty);
  };

  return (
    <>
      <TopBar title="My Profile" />
      <div className="content profile-page">

        <div className="profile-hero">
          <div className="profile-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
          <div className="profile-hero-info">
            <div className="profile-name">{user?.name}</div>
            <div className="profile-email">{user?.email}</div>
            {user?.phone && <div className="profile-phone">📞 {user.phone}</div>}
            <div className={`profile-role-badge profile-role-${user?.role}`}>
              {user?.role === 'delivery' ? '🛵 Delivery Partner' : user?.role === 'admin' ? '⚙️ Administrator' : '🍱 Customer'}
            </div>
          </div>
        </div>

        {loading && <div style={{ textAlign: 'center', color: 'var(--text3)', padding: 40 }}>Loading...</div>}

        {/* ── DELIVERY ── */}
        {user?.role === 'delivery' && partnerData && !loading && (
          <>
            <div className="profile-stats-grid">
              <div className="profile-stat">
                <div className="profile-stat-value">{partnerData.total_deliveries}</div>
                <div className="profile-stat-label">Delivered</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-amber">{partnerData.rating.toFixed(1)}</div>
                <div className="profile-stat-label">Rating</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-green">{partnerData.safety_score}%</div>
                <div className="profile-stat-label">Safety</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value">{activeOrders.length}</div>
                <div className="profile-stat-label">Active</div>
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-title">Rider Rating</div>
              <div className="profile-stars">{renderStars(partnerData.rating)}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6 }}>
                {partnerData.rating.toFixed(2)} / 5.00 · {partnerData.total_deliveries} deliveries completed
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-title">Safety Score</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 28, fontFamily: 'var(--font-display)', fontWeight: 800, color: partnerData.safety_score >= 80 ? 'var(--green)' : partnerData.safety_score >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                  {partnerData.safety_score}%
                </span>
                <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                  {partnerData.safety_score >= 80 ? 'EXCELLENT' : partnerData.safety_score >= 60 ? 'FAIR' : 'POOR'}
                </span>
              </div>
              <div className="profile-safety-bar">
                <div className="profile-safety-fill" style={{ width: `${partnerData.safety_score}%`, background: partnerData.safety_score >= 80 ? 'var(--green)' : partnerData.safety_score >= 60 ? 'var(--amber)' : 'var(--red)' }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 8 }}>
                {partnerData.safety_score >= 80 ? '✅ No violations · Keep it up' : partnerData.safety_score >= 60 ? '⚠️ Minor violations logged' : '🚨 Multiple violations — review required'}
              </div>
            </div>

            <div className="profile-card">
              <div className="profile-card-title">Equipment & Status</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                <div className={`status-pill ${partnerData.status === 'online' ? 'online' : 'warning'}`}>
                  <div className="dot" /> {partnerData.status.toUpperCase()}
                </div>
                {partnerData.vehicle_number && (
                  <div className="profile-meta-chip">🏍️ {partnerData.vehicle_number}</div>
                )}
                <div className={`profile-meta-chip${partnerData.helmet_detected ? '' : ' danger'}`}>
                  {partnerData.helmet_detected ? '⛑️ Helmet detected' : '⚠️ No helmet'}
                </div>
                <div className={`profile-meta-chip${partnerData.camera_active ? '' : ' danger'}`}>
                  {partnerData.camera_active ? '📷 Camera active' : '📷 Camera off'}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ── CUSTOMER ── */}
        {user?.role === 'customer' && !loading && (
          <>
            <div className="profile-stats-grid">
              <div className="profile-stat">
                <div className="profile-stat-value">{deliveredOrders.length}</div>
                <div className="profile-stat-label">Delivered</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-amber">₹{totalSpent.toFixed(0)}</div>
                <div className="profile-stat-label">Spent</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-green">{activeOrders.length}</div>
                <div className="profile-stat-label">Active</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value">{orders.length}</div>
                <div className="profile-stat-label">Total</div>
              </div>
            </div>

            {deliveredOrders.length > 0 ? (
              <div className="profile-card">
                <div className="profile-card-title">Recent Orders</div>
                {deliveredOrders.slice(0, 5).map((order) => (
                  <div key={order.id} className="profile-order-row">
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      <span style={{ fontSize: 20 }}>{order.items?.[0]?.food_item_emoji || '🍱'}</span>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 600 }}>#{order.order_number}</div>
                        <div style={{ fontSize: 11, color: 'var(--text2)' }}>
                          {order.items?.[0]?.food_item_name || 'Order'}
                          {order.items.length > 1 ? ` +${order.items.length - 1} more` : ''}
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 13, color: 'var(--amber)', fontFamily: 'var(--font-mono)' }}>₹{order.total_amount}</div>
                      <div style={{ fontSize: 10, color: 'var(--text3)' }}>{new Date(order.created_at).toLocaleDateString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="profile-card" style={{ textAlign: 'center', color: 'var(--text3)', padding: 32 }}>
                No completed orders yet. Time to order something! 🍱
              </div>
            )}
          </>
        )}

        {/* ── ADMIN ── */}
        {user?.role === 'admin' && adminStats && !loading && (
          <>
            <div className="profile-stats-grid">
              <div className="profile-stat">
                <div className="profile-stat-value">{adminStats.total_orders}</div>
                <div className="profile-stat-label">Orders</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-green">{adminStats.active_partners}</div>
                <div className="profile-stat-label">Partners</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-amber">{adminStats.avg_delivery_minutes}m</div>
                <div className="profile-stat-label">Avg ETA</div>
              </div>
              <div className="profile-stat">
                <div className="profile-stat-value profile-stat-red">{adminStats.violations_today}</div>
                <div className="profile-stat-label">Violations</div>
              </div>
            </div>
            <div className="profile-card">
              <div className="profile-card-title">Today's Summary</div>
              <div className="profile-order-row">
                <span style={{ color: 'var(--text2)', fontSize: 13 }}>Revenue today</span>
                <span style={{ color: 'var(--amber)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>₹{adminStats.revenue_today?.toFixed(0) ?? '—'}</span>
              </div>
              <div className="profile-order-row">
                <span style={{ color: 'var(--text2)', fontSize: 13 }}>Delivered today</span>
                <span style={{ color: 'var(--green)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>{adminStats.delivered_today}</span>
              </div>
              <div className="profile-order-row">
                <span style={{ color: 'var(--text2)', fontSize: 13 }}>Active orders</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>{adminStats.active_orders}</span>
              </div>
            </div>
          </>
        )}

        <button className="btn btn-ghost profile-signout" onClick={handleSignOut}>
          Sign Out
        </button>

      </div>
    </>
  );
}

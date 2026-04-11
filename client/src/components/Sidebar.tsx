import { useAuth } from '../contexts/AuthContext';
import { NavLink, useNavigate } from 'react-router-dom';

const CUSTOMER_NAV_ITEMS = [
  { icon: '🍱', label: 'Order Food', path: '/customer/order' },
  { icon: '🛵', label: 'Track Order', path: '/customer/track' },
];

const DELIVERY_NAV_ITEMS = [
  { icon: '📦', label: 'Dashboard', path: '/delivery' },
  { icon: '🗺️', label: 'Navigation', path: '/delivery/nav' },
  { icon: '📷', label: 'QR Scanner', path: '/delivery/qr' },
  { icon: '⛑️', label: 'Safety', path: '/delivery/safety' },
];

const ADMIN_NAV_ITEMS = [
  { icon: '📊', label: 'Overview', path: '/admin' },
  { icon: '📋', label: 'Orders', path: '/admin/orders' },
  { icon: '🛵', label: 'Partners', path: '/admin/partners' },
  { icon: '🏪', label: 'Restaurants', path: '/admin/restaurants' },
  { icon: '⚠️', label: 'Violations', path: '/admin/violations' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || 'customer';
  const navItems = role === 'admin'
    ? ADMIN_NAV_ITEMS
    : role === 'delivery'
      ? DELIVERY_NAV_ITEMS
      : CUSTOMER_NAV_ITEMS;

  const navSection = role === 'admin' ? 'Admin' : role === 'delivery' ? 'Delivery' : 'Customer';

  return (
    <div className="sidebar">
      <div className="logo">
        <div className="logo-mark">Smart Route</div>
        <div className="logo-sub">v2.4.1 · Live</div>
      </div>

      <div className="nav-section">{navSection}</div>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          to={item.path}
        >
          <span className="nav-icon">{item.icon}</span> {item.label}
        </NavLink>
      ))}

      <div className="role-switcher">
        <div className="role-label">Signed In</div>
        <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 10 }}>
          {user?.name || 'User'}
        </div>
        <button
          className="btn btn-ghost"
          style={{ width: '100%', marginTop: 12, justifyContent: 'center', fontSize: 12 }}
          onClick={() => { logout(); navigate('/login'); }}
        >
          Sign Out
        </button>
      </div>
    </div>
  );
}

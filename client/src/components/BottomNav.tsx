import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CUSTOMER_NAV_ITEMS = [
  { icon: '🍱', label: 'Order', path: '/customer/order' },
  { icon: '🛵', label: 'Track', path: '/customer/track' },
];

const DELIVERY_NAV_ITEMS = [
  { icon: '📦', label: 'Dashboard', path: '/delivery' },
  { icon: '🗺️', label: 'Navigate', path: '/delivery/nav' },
  { icon: '📷', label: 'QR Scan', path: '/delivery/qr' },
  { icon: '⛑️', label: 'Safety', path: '/delivery/safety' },
];

const ADMIN_NAV_ITEMS = [
  { icon: '📊', label: 'Overview', path: '/admin' },
  { icon: '📋', label: 'Orders', path: '/admin/orders' },
  { icon: '🛵', label: 'Partners', path: '/admin/partners' },
  { icon: '🏪', label: 'Restaurants', path: '/admin/restaurants' },
  { icon: '⚠️', label: 'Violations', path: '/admin/violations' },
];

export default function BottomNav() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const role = user?.role || 'customer';
  const navItems =
    role === 'admin' ? ADMIN_NAV_ITEMS :
    role === 'delivery' ? DELIVERY_NAV_ITEMS :
    CUSTOMER_NAV_ITEMS;

  return (
    <nav className="bottom-nav">
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          end={item.path === '/delivery' || item.path === '/admin'}
        >
          <span className="bottom-nav-icon">{item.icon}</span>
          <span className="bottom-nav-label">{item.label}</span>
        </NavLink>
      ))}
      <button
        className="bottom-nav-item bottom-nav-signout"
        onClick={() => navigate('/profile')}
      >
        <span className="bottom-nav-icon">👤</span>
        <span className="bottom-nav-label">{user?.name?.split(' ')[0] || 'Me'}</span>
      </button>
    </nav>
  );
}

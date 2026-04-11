import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { SocketProvider } from './contexts/SocketContext';
import { CartProvider } from './contexts/CartContext';
import Sidebar from './components/Sidebar';
import Toast from './components/Toast';
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';
import OrderFood from './pages/customer/OrderFood';
import TrackOrder from './pages/customer/TrackOrder';
import DeliveryDashboard from './pages/delivery/DeliveryDashboard';
import Navigation from './pages/delivery/Navigation';
import QRScanner from './pages/delivery/QRScanner';
import Safety from './pages/delivery/Safety';
import AdminOverview from './pages/admin/AdminOverview';
import AdminOrders from './pages/admin/AdminOrders';
import AdminPartners from './pages/admin/AdminPartners';
import AdminViolations from './pages/admin/AdminViolations';
import AdminRestaurants from './pages/admin/AdminRestaurants';

const ROLE_HOME: Record<string, string> = {
  customer: '/customer/order',
  delivery: '/delivery',
  admin: '/admin',
};

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoggedIn } = useAuth();
  if (!isLoggedIn) return <Navigate to="/login" />;
  if (!roles.includes(user?.role || '')) return <Navigate to="/login" />;
  return <>{children}</>;
}

function AppLayout() {
  const { user, isLoggedIn } = useAuth();
  if (!isLoggedIn || !user) return <Navigate to="/login" />;

  const fallbackRoute = ROLE_HOME[user.role] || ROLE_HOME.customer;

  return (
    <div className="app" style={{ display: 'flex', height: '100vh' }}>
      <Sidebar />
      <div className="main">
        <Routes>
          <Route path="/customer" element={<Navigate to="/customer/order" replace />} />
          <Route path="/customer/order" element={<ProtectedRoute roles={['customer']}><OrderFood /></ProtectedRoute>} />
          <Route path="/customer/track" element={<ProtectedRoute roles={['customer']}><TrackOrder /></ProtectedRoute>} />

          <Route path="/delivery" element={<ProtectedRoute roles={['delivery']}><DeliveryDashboard /></ProtectedRoute>} />
          <Route path="/delivery/nav" element={<ProtectedRoute roles={['delivery']}><Navigation /></ProtectedRoute>} />
          <Route path="/delivery/qr" element={<ProtectedRoute roles={['delivery']}><QRScanner /></ProtectedRoute>} />
          <Route path="/delivery/safety" element={<ProtectedRoute roles={['delivery']}><Safety /></ProtectedRoute>} />

          <Route path="/admin" element={<ProtectedRoute roles={['admin']}><AdminOverview /></ProtectedRoute>} />
          <Route path="/admin/orders" element={<ProtectedRoute roles={['admin']}><AdminOrders /></ProtectedRoute>} />
          <Route path="/admin/partners" element={<ProtectedRoute roles={['admin']}><AdminPartners /></ProtectedRoute>} />
          <Route path="/admin/violations" element={<ProtectedRoute roles={['admin']}><AdminViolations /></ProtectedRoute>} />
          <Route path="/admin/restaurants" element={<ProtectedRoute roles={['admin']}><AdminRestaurants /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to={fallbackRoute} replace />} />
        </Routes>
      </div>
      <Toast />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <CartProvider>
          <SocketProvider>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route path="/*" element={<AppLayout />} />
            </Routes>
          </SocketProvider>
        </CartProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface TopBarProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function TopBar({ title, subtitle, children }: TopBarProps) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const handleSignOut = () => {
    setMenuOpen(false);
    logout();
    navigate('/login');
  };

  return (
    <div className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      <div className="topbar-right">
        {children}
        <div className="avatar-wrap">
          <div className="avatar" onClick={() => setMenuOpen((o) => !o)} style={{ cursor: 'pointer' }}>
            {user?.name?.[0] || 'U'}
          </div>
          {menuOpen && (
            <>
              <div className="avatar-backdrop" onClick={() => setMenuOpen(false)} />
              <div className="avatar-menu">
                <div className="avatar-menu-name">{user?.name || 'User'}</div>
                <div className="avatar-menu-role">{user?.role || ''}</div>
                <button className="btn btn-ghost avatar-menu-signout" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

import { useAuth } from '../contexts/AuthContext';

interface TopBarProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export default function TopBar({ title, subtitle, children }: TopBarProps) {
  const { user } = useAuth();

  return (
    <div className="topbar">
      <div>
        <div className="page-title">{title}</div>
        {subtitle && <div className="page-subtitle">{subtitle}</div>}
      </div>
      <div className="topbar-right">
        {children}
        <div className="avatar">{user?.name?.[0] || 'U'}</div>
      </div>
    </div>
  );
}
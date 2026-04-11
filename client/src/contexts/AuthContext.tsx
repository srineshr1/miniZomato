/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, ReactNode } from 'react';
import { authService } from '../services/authService';
import { TokenResponse, UserRole } from '../types';

interface AuthContextType {
  user: TokenResponse | null;
  isLoggedIn: boolean;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  register: (email: string, name: string, password: string, role: UserRole, phone?: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<TokenResponse | null>(() => authService.getCurrentUser());

  const login = async (email: string, password: string, role: UserRole) => {
    const data = await authService.login(email, password, role);
    setUser(data);
  };

  const register = async (email: string, name: string, password: string, role: UserRole, phone?: string) => {
    const data = await authService.register(email, name, password, role, phone);
    setUser(data);
  };

  const logout = () => {
    authService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoggedIn: !!user, login, logout, register }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
};

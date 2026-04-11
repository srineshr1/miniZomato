import api from './api';
import { TokenResponse, UserRole } from '../types';

export const authService = {
  async login(email: string, password: string, role: UserRole): Promise<TokenResponse> {
    const { data } = await api.post('/auth/login', { email, password, role });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },

  async register(email: string, name: string, password: string, role: UserRole, phone?: string): Promise<TokenResponse> {
    const { data } = await api.post('/auth/register', { email, name, password, role, phone });
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data));
    return data;
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser() {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  },

  isLoggedIn() {
    return !!localStorage.getItem('token');
  },
};

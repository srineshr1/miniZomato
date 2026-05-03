import axios from 'axios';
import { UserProfile } from '../types';

const resolveBase = () => {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  const { hostname } = window.location;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') return `http://${hostname}:8000`;
  return 'http://localhost:8000';
};
const API_BASE = resolveBase();

const api = axios.create({
  baseURL: API_BASE,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      const method = error.config?.method?.toLowerCase();
      if (method === 'get' || method === 'delete') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

export const userService = {
  async me(): Promise<UserProfile> {
    const { data } = await api.get('/users/me/profile');
    return data;
  },

  async getById(userId: number): Promise<UserProfile> {
    const { data } = await api.get(`/users/${userId}`);
    return data;
  },
};

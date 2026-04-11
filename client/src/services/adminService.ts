import api from './api';
import { Violation, DashboardStats } from '../types';

export const safetyService = {
  async getSpeed(partnerId: number) {
    const { data } = await api.get(`/safety/speed/${partnerId}`);
    return data;
  },

  async checkHelmet(partnerId: number) {
    const { data } = await api.get(`/safety/helmet/${partnerId}`);
    return data;
  },

  async createViolation(violation: Partial<Violation>) {
    const { data } = await api.post('/safety/violations', violation);
    return data;
  },

  async listViolations(params?: { partner_id?: number; type?: string; resolved?: boolean }) {
    const { data } = await api.get('/safety/violations', { params });
    return data;
  },

  async resolveViolation(id: number) {
    const { data } = await api.patch(`/safety/violations/${id}`, { resolved: true });
    return data;
  },
};

export const adminService = {
  async getStats(): Promise<DashboardStats> {
    const { data } = await api.get('/admin/stats');
    return data;
  },

  async getRecentOrders(limit: number = 10) {
    const { data } = await api.get('/admin/orders/recent', { params: { limit } });
    return data;
  },

  async getPartnerSafetyScores() {
    const { data } = await api.get('/admin/partners/safety-scores');
    return data;
  },
};
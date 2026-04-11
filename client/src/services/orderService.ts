import api from './api';
import { Order, OrderStatus } from '../types';

export const orderService = {
  async create(orderData: {
    items: { food_item_id: number; quantity: number }[];
    customer_address: string;
    customer_landmark?: string;
    customer_lat?: number;
    customer_lng?: number;
  }): Promise<Order> {
    const { data } = await api.post('/orders/', orderData);
    return data;
  },

  async list(status?: OrderStatus): Promise<Order[]> {
    const params: Record<string, string> = {};
    if (status) params.status = status;
    const { data } = await api.get('/orders/', { params });
    return data;
  },

  async getById(id: number): Promise<Order> {
    const { data } = await api.get(`/orders/${id}`);
    return data;
  },

  async updateStatus(orderId: number, status: OrderStatus): Promise<Order> {
    const { data } = await api.patch(`/orders/${orderId}/status`, { status });
    return data;
  },

  async getAvailable(): Promise<Order[]> {
    const { data } = await api.get('/orders/available/list');
    return data;
  },

  async getAllOrders(status?: OrderStatus): Promise<Order[]> {
    const params: Record<string, string | number> = {};
    if (status) params.status = status;
    const { data } = await api.get('/orders/', { params });
    return data;
  },

  async accept(orderId: number): Promise<Order> {
    const { data } = await api.post(`/orders/${orderId}/accept`);
    return data;
  },
};

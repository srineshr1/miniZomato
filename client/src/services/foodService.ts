import api from './api';
import { FoodItem } from '../types';

export const foodService = {
  async getAll(params?: {
    category?: string;
    search?: string;
    restaurant_id?: number;
    available_only?: boolean;
  }): Promise<FoodItem[]> {
    const q: Record<string, string | number | boolean> = {};
    if (params?.category) q.category = params.category;
    if (params?.search) q.search = params.search;
    if (params?.restaurant_id !== undefined) q.restaurant_id = params.restaurant_id;
    if (params?.available_only !== undefined) q.available_only = params.available_only;
    const { data } = await api.get('/food-items/', { params: q });
    return data;
  },

  async getById(id: number): Promise<FoodItem> {
    const { data } = await api.get(`/food-items/${id}`);
    return data;
  },

  async create(item: Partial<FoodItem>): Promise<FoodItem> {
    const { data } = await api.post('/food-items/', item);
    return data;
  },

  async update(id: number, item: Partial<FoodItem>): Promise<FoodItem> {
    const { data } = await api.put(`/food-items/${id}`, item);
    return data;
  },

  async delete(id: number): Promise<void> {
    await api.delete(`/food-items/${id}`);
  },
};
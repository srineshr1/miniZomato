import api from './api';
import { FoodItem } from '../types';

export interface Restaurant {
  id: number;
  name: string;
  lat: number;
  lng: number;
  address: string | null;
  area: string | null;
  cuisine: string | null;
  rating: string | null;
  source: string | null;
  menu_scraped: boolean;
}

export interface RestaurantWithMenu extends Restaurant {
  food_items: FoodItem[];
  _dist_m?: number;
}

export const restaurantService = {
  async getNearby(params: {
    lat: number;
    lng: number;
    radius_km?: number;
    cuisine?: string;
    skip?: number;
    limit?: number;
  }): Promise<RestaurantWithMenu[]> {
    const q: Record<string, string | number> = {
      lat: params.lat,
      lng: params.lng,
    };
    if (params.radius_km !== undefined) q.radius_km = params.radius_km;
    if (params.cuisine) q.cuisine = params.cuisine;
    if (params.skip !== undefined) q.skip = params.skip;
    if (params.limit !== undefined) q.limit = params.limit;
    const { data } = await api.get('/restaurants/nearby', { params: q });
    return data;
  },

  async list(params?: {
    lat?: number;
    lng?: number;
    radius_km?: number;
    cuisine?: string;
    search?: string;
    skip?: number;
    limit?: number;
  }): Promise<Restaurant[]> {
    const q: Record<string, string | number> = {};
    if (params?.lat !== undefined) q.lat = params.lat;
    if (params?.lng !== undefined) q.lng = params.lng;
    if (params?.radius_km !== undefined) q.radius_km = params.radius_km;
    if (params?.cuisine) q.cuisine = params.cuisine;
    if (params?.search) q.search = params.search;
    if (params?.skip !== undefined) q.skip = params.skip;
    if (params?.limit !== undefined) q.limit = params.limit;
    const { data } = await api.get('/restaurants/', { params: q });
    return data;
  },

  async getMenu(restaurantId: number): Promise<FoodItem[]> {
    const { data } = await api.get(`/restaurants/${restaurantId}/menu`);
    return data;
  },

  async getZone(params?: {
    radius_km?: number;
    skip?: number;
    limit?: number;
  }): Promise<RestaurantWithMenu[]> {
    const q: Record<string, string | number> = {};
    if (params?.radius_km !== undefined) q.radius_km = params.radius_km;
    if (params?.skip !== undefined) q.skip = params.skip;
    if (params?.limit !== undefined) q.limit = params.limit;
    const { data } = await api.get('/restaurants/zone', { params: q });
    return data;
  },
};

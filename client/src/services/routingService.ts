import api from './api';
import { OptimizedRoute } from '../types';

export const routingService = {
  async optimizeRoute(orderIds: number[]): Promise<OptimizedRoute> {
    const { data } = await api.post('/routing/optimize', orderIds);
    return data;
  },

  async geocodeAddress(address: string): Promise<{ lat: number; lng: number; displayName: string } | null> {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch map coordinates');
    }

    const rows = (await response.json()) as Array<{ lat: string; lon: string; display_name: string }>;
    if (!rows.length) return null;

    return {
      lat: Number(rows[0].lat),
      lng: Number(rows[0].lon),
      displayName: rows[0].display_name,
    };
  },
};

import api from './api';
import { QRScanResult, QRSessionOut } from '../types';

export const qrService = {
  async generate(orderId: number): Promise<QRSessionOut> {
    const { data } = await api.post(`/qr/generate/${orderId}`);
    return data;
  },

  async scan(token: string): Promise<QRScanResult> {
    const { data } = await api.post('/qr/scan', { token });
    return data;
  },
};

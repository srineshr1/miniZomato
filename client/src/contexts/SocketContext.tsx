/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useEffect, ReactNode, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { Order } from '../types';

const SOCKET_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface Notification {
  id: string;
  icon: string;
  title: string;
  body: string;
}

interface SocketContextType {
  partnerLocation: { partner_id: number; lat: number; lng: number; speed_kmh: number } | null;
  orderUpdate: { order_id: number; status: string; partner_id?: number } | null;
  speedAlert: { partner_id: number; speed_kmh: number; limit: number } | null;
  isConnected: boolean;
  notifications: Notification[];
  addNotification: (n: Omit<Notification, 'id'>) => void;
  removeNotification: (id: string) => void;
  joinTracking: (orderId: number) => void;
  joinPartnerRoom: (partnerId: number) => void;
  emitLocationUpdate: (payload: { partner_id: number; lat: number; lng: number; speed_kmh: number }) => void;
  newOrderRequest: Order | null;
  clearNewOrderRequest: () => void;
}

type SocketContextValue = Omit<SocketContextType, 'isConnected'>;

const SocketContext = createContext<SocketContextType | null>(null);

function playNotificationSound() {
  try {
    const win = window as typeof window & { webkitAudioContext?: typeof AudioContext };
    const AudioCtx = window.AudioContext || win.webkitAudioContext;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(800, ctx.currentTime);
    oscillator.frequency.setValueAtTime(600, ctx.currentTime + 0.15);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.4);
  } catch {
    // Audio not available
  }
}

function requestBrowserNotification(title: string, body: string) {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '🛵' });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          new Notification(title, { body, icon: '🛵' });
        }
      });
    }
  }
}

export function SocketProvider({ children }: { children: ReactNode }) {
  const [partnerLocation, setPartnerLocation] = useState<SocketContextType['partnerLocation']>(null);
  const [orderUpdate, setOrderUpdate] = useState<SocketContextType['orderUpdate']>(null);
  const [speedAlert, setSpeedAlert] = useState<SocketContextType['speedAlert']>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [newOrderRequest, setNewOrderRequest] = useState<Order | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const addNotification = useCallback((n: Omit<Notification, 'id'>) => {
    const id = Date.now().toString();
    setNotifications((prev) => [...prev, { ...n, id }]);
    setTimeout(() => removeNotification(id), 4000);
  }, [removeNotification]);

  const clearNewOrderRequest = useCallback(() => {
    setNewOrderRequest(null);
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const s = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    s.on('connect', () => setIsConnected(true));
    s.on('disconnect', () => setIsConnected(false));

    s.on('partner_location', (data) => setPartnerLocation(data));

    s.on('order_update', (data: { order_id: number; status: string; partner_id?: number }) => {
      setOrderUpdate(data);
    });

    s.on('speed_alert', (data: { partner_id: number; speed_kmh: number; limit: number }) => {
      setSpeedAlert(data);
      addNotification({ icon: '🚨', title: 'Speed Alert!', body: `${data.speed_kmh} km/h exceeds ${data.limit} km/h limit` });
    });

    s.on('new_order', (data: Order) => {
      setNewOrderRequest(data);
      addNotification({ icon: '🔔', title: 'New Delivery Request!', body: `Order #${data.order_number} - ₹${data.delivery_fee}` });
      playNotificationSound();
      requestBrowserNotification('New Delivery Request!', `Order #${data.order_number} - ₹${data.delivery_fee}`);
    });

    socketRef.current = s;
    return () => {
      socketRef.current = null;
      s.disconnect();
      setIsConnected(false);
    };
  }, [addNotification]);

  const joinTracking = useCallback((orderId: number) => {
    socketRef.current?.emit('join_tracking', { order_id: orderId });
  }, []);

  const joinPartnerRoom = useCallback((partnerId: number) => {
    socketRef.current?.emit('join_partner_room', { partner_id: partnerId });
  }, []);

  const emitLocationUpdate = useCallback((payload: { partner_id: number; lat: number; lng: number; speed_kmh: number }) => {
    socketRef.current?.emit('location_update', payload);
  }, []);

  const value: SocketContextValue = {
    partnerLocation,
    orderUpdate,
    speedAlert,
    notifications,
    addNotification,
    removeNotification,
    joinTracking,
    joinPartnerRoom,
    emitLocationUpdate,
    newOrderRequest,
    clearNewOrderRequest,
  };

  return (
    <SocketContext.Provider
      value={{
        ...value,
        isConnected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
}

export const useSocket = () => {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be inside SocketProvider');
  return ctx;
};

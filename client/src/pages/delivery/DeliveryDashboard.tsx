import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '../../components/TopBar';
import StatCard from '../../components/StatCard';
import DeliveryLocationPicker from '../../components/DeliveryLocationPicker';
import { orderService } from '../../services/orderService';
import { Order } from '../../types';
import { useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import { deliveryService } from '../../services/deliveryService';
import { useSocket } from '../../contexts/SocketContext';
import { DELIVERY_ACTIVE_STATUSES, statusLabel } from '../../utils/status';
import { FAR_PICKUP_DISTANCE_KM, randomPointInDeliveryZone } from '../../utils/deliveryZone';
import { haversineMeters } from '../../utils/fleetSimulation';

type GPoint = { lat: number; lng: number };

const PICKUP_PENDING_STATUSES: Order['status'][] = ['confirmed', 'preparing', 'ready'];

function isPickupPending(status: Order['status']) {
  return PICKUP_PENDING_STATUSES.includes(status);
}

export default function DeliveryDashboard() {
  const navigate = useNavigate();
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [partnerPoint, setPartnerPoint] = useState<GPoint | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [locationSet, setLocationSet] = useState<boolean>(() => !!localStorage.getItem('partnerLocation'));
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const { newOrderRequest, clearNewOrderRequest, addNotification, isConnected } = useSocket();
  const seedingLocationRef = useRef(false);

  usePolling(
    () => deliveryService.me(),
    15000,
    (partner) => {
      if (partner.current_lat != null && partner.current_lng != null) {
        setPartnerPoint({ lat: partner.current_lat, lng: partner.current_lng });
        if (!locationSet) {
          setLocationSet(true);
          localStorage.setItem('partnerLocation', JSON.stringify({ lat: partner.current_lat, lng: partner.current_lng }));
        }
        return;
      }

      if (seedingLocationRef.current || locationSet) return;
      seedingLocationRef.current = true;

      const fallback = randomPointInDeliveryZone();
      void deliveryService.updateLocation(fallback.lat, fallback.lng, 0)
        .then(() => {
          setPartnerPoint(fallback);
          setLocationSet(true);
          localStorage.setItem('partnerLocation', JSON.stringify(fallback));
        })
        .catch(() => null)
        .finally(() => { seedingLocationRef.current = false; });
    },
  );

  usePolling(
    async () => {
      const [avail, mine] = await Promise.all([
        orderService.getAvailable(),
        orderService.list(),
      ]);
      return { avail, mine };
    },
    5000,
    ({ avail, mine }) => {
      setAvailableOrders(avail);
      setAcceptedOrders(mine.filter((o) => DELIVERY_ACTIVE_STATUSES.includes(o.status)));
      setLoading(false);
      setLastSync(new Date());
    },
    () => setLoading(false),
  );

  useEffect(() => {
    if (!locationSet) {
      setShowLocationPicker(true);
    }
  }, [locationSet]);

  useEffect(() => {
    if (newOrderRequest) {
      setAvailableOrders((prev) => {
        if (prev.some((o) => o.id === newOrderRequest.id)) return prev;
        return [newOrderRequest, ...prev];
      });
    }
  }, [newOrderRequest]);

  const handleLocationSet = useCallback(async (point: GPoint) => {
    try {
      await deliveryService.updateLocation(point.lat, point.lng, 0);
    } catch { /* ignore */ }
    setPartnerPoint(point);
    localStorage.setItem('partnerLocation', JSON.stringify(point));
    setLocationSet(true);
    setShowLocationPicker(false);
  }, []);

  const handleAccept = useCallback(async (orderId: number) => {
    if (acceptedOrders.length > 0) {
      addNotification({ icon: '⚠️', title: 'Already busy', body: 'Complete your current delivery first.' });
      return;
    }
    if (!locationSet) {
      setShowLocationPicker(true);
      return;
    }
    setAccepting(orderId);
    try {
      await orderService.accept(orderId);
      const mine = await orderService.list();
      setAcceptedOrders(mine.filter((o) => DELIVERY_ACTIVE_STATUSES.includes(o.status)));
      clearNewOrderRequest();
      navigate(`/delivery/nav?order=${orderId}`);
    } catch (e: unknown) {
      if ((e as { response?: { status?: number } })?.response?.status === 409) {
        const avail = await orderService.getAvailable();
        setAvailableOrders(avail);
        addNotification({ icon: 'ℹ️', title: 'Already taken', body: 'This order was accepted by another partner.' });
      }
    } finally {
      setAccepting(null);
    }
  }, [acceptedOrders, locationSet, addNotification, clearNewOrderRequest, navigate]);

  const getPickupDistanceKm = useCallback((order: Order) => {
    if (!partnerPoint || order.restaurant_lat == null || order.restaurant_lng == null) return null;
    return haversineMeters(partnerPoint, {
      lat: order.restaurant_lat,
      lng: order.restaurant_lng,
    }) / 1000;
  }, [partnerPoint]);

  const totalRemainingKm = useMemo(
    () => acceptedOrders.reduce((sum, o) => sum + o.distance_km, 0).toFixed(1),
    [acceptedOrders],
  );

  const totalEtaMinutes = useMemo(
    () => acceptedOrders.reduce((sum, o) => sum + o.eta_minutes, 0),
    [acceptedOrders],
  );

  const priorityLabel = (order: Order) => {
    if (order.priority === 1) return { text: '🧊 DELIVER FIRST', cls: 'priority-high' };
    if (order.priority === 2) return { text: '🔥 MEDIUM', cls: 'priority-med' };
    return { text: 'NORMAL', cls: 'priority-low' };
  };

  return (
    <>
      <TopBar title="Delivery Dashboard" subtitle={`${availableOrders.length} open · ${acceptedOrders.length} assigned`}>
        <div className={`status-pill ${isConnected ? 'online' : 'warning'}`}>
          <div className="dot" /> {isConnected ? 'Connected' : 'Reconnecting'}
        </div>
      </TopBar>

      {showLocationPicker && (
        <DeliveryLocationPicker onLocationSet={handleLocationSet} />
      )}

      {newOrderRequest && (
        <div className="incoming-order-modal-overlay">
          <div className="incoming-order-modal">
            <div className="incoming-order-header">
              <span className="incoming-order-icon">🔔</span>
              <span>New Delivery Request</span>
            </div>
            <div className="incoming-order-body">
              <div className="incoming-order-num">Order #{newOrderRequest.order_number}</div>
              <div className="incoming-order-items">
                {(newOrderRequest.items || []).slice(0, 2).map((item) => (
                  <span key={item.id}>{item.food_item_name || 'Item'}{item.quantity > 1 ? ` x${item.quantity}` : ''}</span>
                ))}
                {(newOrderRequest.items || []).length > 2 && <span>+{(newOrderRequest.items || []).length - 2} more</span>}
              </div>
              <div className="incoming-order-details">
                <div>Total: <strong>₹{newOrderRequest.total_amount}</strong></div>
                <div>Delivery: <strong>{newOrderRequest.distance_km} km</strong></div>
                <div>You earn: <strong>₹{newOrderRequest.delivery_fee}</strong></div>
              </div>
              {newOrderRequest.priority === 1 && (
                <div className="incoming-order-priority">🧊 PRIORITY — Deliver First</div>
              )}
            </div>
            <div className="incoming-order-actions">
              <button
                className="btn btn-ghost"
                onClick={() => {
                  clearNewOrderRequest();
                  setAvailableOrders((prev) => prev.filter((o) => o.id !== newOrderRequest.id));
                }}
              >
                Dismiss
              </button>
              <button
                className="btn btn-primary"
                onClick={() => handleAccept(newOrderRequest.id)}
                disabled={accepting === newOrderRequest.id}
              >
                {accepting === newOrderRequest.id ? 'Accepting...' : '✓ Accept Order'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="content">
        <div className="stats-grid">
          <StatCard icon="📦" value={availableOrders.length} label="Available Orders" color="amber" />
          <StatCard icon="🛵" value={acceptedOrders.length} label="Assigned Orders" color="green" />
          <StatCard icon="🧭" value={totalRemainingKm} label="Remaining KM" color="blue" />
          <StatCard icon="⏱" value={totalEtaMinutes} label="Total ETA (min)" color="red" />
        </div>

        {acceptedOrders.length > 0 && (
          <>
            <div style={{ marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
                My Active Orders
              </div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                Last sync: {lastSync ? lastSync.toLocaleTimeString() : '—'}
              </div>
            </div>
            <div className="orders-grid">
              {acceptedOrders.map((order) => {
                const pickupPending = isPickupPending(order.status);
                const destinationLabel = order.customer_address || 'Customer address unlocks after pickup QR';

                return (
                  <div key={order.id} className="order-card selected">
                    <div className="order-num">ORDER #{order.order_number}</div>
                    <div className="order-name">{order.items?.[0]?.food_item_name || `Order #${order.order_number}`}</div>
                    <div className="order-meta">{pickupPending ? 'Next stop: Restaurant pickup' : 'Next stop: Customer drop'}</div>
                    <div className="order-meta">{destinationLabel}</div>
                    <div className="order-footer">
                      <div className="order-distance">{order.distance_km} km</div>
                      <div className="order-eta">Status: <span style={{ color: 'var(--green)' }}>{statusLabel(order.status)}</span></div>
                    </div>
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                      onClick={() => navigate(`/delivery/nav?order=${order.id}`)}
                    >
                      Open Navigation
                    </button>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div style={{ marginBottom: 16, marginTop: acceptedOrders.length > 0 ? 24 : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
            Available Orders
          </div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {partnerPoint
              ? `${partnerPoint.lat.toFixed(4)}, ${partnerPoint.lng.toFixed(4)}`
              : 'Initializing location...'}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text3)' }}>Loading orders...</div>
        ) : availableOrders.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text2)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div>No available orders right now. New orders will appear automatically.</div>
          </div>
        ) : (
          <div className="orders-grid">
            {availableOrders.map((order) => {
              const p = priorityLabel(order);
              const isAccepting = accepting === order.id;
              const pickupDistanceKm = getPickupDistanceKm(order);
              const isFarPickup = pickupDistanceKm != null && pickupDistanceKm > FAR_PICKUP_DISTANCE_KM;
              const pickupPointLabel =
                order.restaurant_lat != null && order.restaurant_lng != null
                  ? `${order.restaurant_lat.toFixed(4)}, ${order.restaurant_lng.toFixed(4)}`
                  : 'Restaurant location unavailable';

              return (
                <div key={order.id} className="order-card">
                  <div className="order-num">ORDER #{order.order_number}</div>
                  <div className="order-name">{order.items?.[0]?.food_item_name || `Order #${order.order_number}`}</div>
                  <div className="order-meta">Pickup point: {pickupPointLabel}</div>
                  <div className="order-meta">
                    {pickupDistanceKm == null
                      ? 'Distance available after location sync'
                      : `${pickupDistanceKm.toFixed(1)} km from your location`}
                  </div>
                  {isFarPickup && (
                    <div style={{ marginTop: 8 }}>
                      <span className="chip danger">FAR ({pickupDistanceKm.toFixed(1)} km)</span>
                    </div>
                  )}
                  <div className={`order-priority ${p.cls}`}>{p.text}</div>
                  <div className="order-footer">
                    <div className="order-distance">{order.distance_km} km delivery</div>
                    <div className="order-eta">Pickup first · ₹{order.delivery_fee}</div>
                  </div>
                  <button
                    className="btn btn-primary"
                    style={{ width: '100%', marginTop: 12, justifyContent: 'center', opacity: isAccepting ? 0.6 : 1 }}
                    disabled={isAccepting || acceptedOrders.length > 0}
                    onClick={(e) => { e.stopPropagation(); handleAccept(order.id); }}
                  >
                    {isAccepting ? 'Accepting...' : '✓ Accept Order'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

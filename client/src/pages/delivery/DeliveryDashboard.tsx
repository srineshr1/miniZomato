import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import TopBar from '../../components/TopBar';
import StatCard from '../../components/StatCard';
import { orderService } from '../../services/orderService';
import { Order } from '../../types';
import { useNavigate } from 'react-router-dom';
import { usePolling } from '../../hooks/usePolling';
import { deliveryService } from '../../services/deliveryService';
import { useSocket } from '../../contexts/SocketContext';
import { DELIVERY_ACTIVE_STATUSES, statusLabel } from '../../utils/status';
import { FAR_PICKUP_DISTANCE_KM, randomPointInDeliveryZone } from '../../utils/deliveryZone';
import { haversineMeters } from '../../utils/fleetSimulation';

type GeoPoint = { lat: number; lng: number };

const PICKUP_PENDING_STATUSES: Order['status'][] = ['confirmed', 'preparing', 'ready'];

function isPickupPending(status: Order['status']) {
  return PICKUP_PENDING_STATUSES.includes(status);
}

export default function DeliveryDashboard() {
  const [availableOrders, setAvailableOrders] = useState<Order[]>([]);
  const [acceptedOrders, setAcceptedOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState<number | null>(null);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [partnerPoint, setPartnerPoint] = useState<GeoPoint | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const navigate = useNavigate();
  const { emitLocationUpdate, partnerLocation, isConnected } = useSocket();
  const seedingLocationRef = useRef(false);

  const bootstrapPartnerLocation = useCallback(async (id: number) => {
    const fallback = randomPointInDeliveryZone();
    await deliveryService.updateLocation(fallback.lat, fallback.lng, 0);
    emitLocationUpdate({
      partner_id: id,
      lat: fallback.lat,
      lng: fallback.lng,
      speed_kmh: 0,
    });
    setPartnerPoint(fallback);
  }, [emitLocationUpdate]);

  usePolling(
    () => deliveryService.me(),
    15000,
    (partner) => {
      setPartnerId(partner.id);

      if (partner.current_lat != null && partner.current_lng != null) {
        setPartnerPoint({ lat: partner.current_lat, lng: partner.current_lng });
        return;
      }

      if (seedingLocationRef.current) return;

      seedingLocationRef.current = true;
      void bootstrapPartnerLocation(partner.id)
        .catch(() => null)
        .finally(() => {
          seedingLocationRef.current = false;
        });
    },
  );

  useEffect(() => {
    if (!partnerId || !partnerLocation || partnerLocation.partner_id !== partnerId) return;

    setPartnerPoint({ lat: partnerLocation.lat, lng: partnerLocation.lng });
  }, [partnerId, partnerLocation]);

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

  const handleAccept = async (orderId: number) => {
    setAccepting(orderId);
    try {
      await orderService.accept(orderId);
      const avail = await orderService.getAvailable();
      setAvailableOrders(avail);
      const mine = await orderService.list();
      setAcceptedOrders(mine.filter((o) => DELIVERY_ACTIVE_STATUSES.includes(o.status)));
    } catch (e) {
      console.error(e);
    } finally {
      setAccepting(null);
    }
  };

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
        <div className={`status-pill ${isConnected ? 'online' : 'warning'}`}><div className="dot" /> {isConnected ? 'Connected' : 'Reconnecting'}</div>
      </TopBar>
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
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>My Active Orders</div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>Last sync: {lastSync ? lastSync.toLocaleTimeString() : '—'}</div>
              </div>
              <div className="orders-grid">
                {acceptedOrders.map((order) => {
                  const p = priorityLabel(order);
                  const pickupPending = isPickupPending(order.status);
                  const pickupLabel = order.restaurant_lat != null && order.restaurant_lng != null
                    ? `${order.restaurant_lat.toFixed(4)}, ${order.restaurant_lng.toFixed(4)}`
                    : 'Restaurant location unavailable';
                  const destinationLabel = order.customer_address || 'Customer address unlocks after pickup QR';

                  return (
                    <div key={order.id} className="order-card selected">
                      <div className="order-num">ORDER #{order.order_number}</div>
                      <div className="order-name">{order.items?.[0]?.food_item_name || `Order #${order.order_number}`}</div>
                      <div className="order-meta">{pickupPending ? 'Next stop: Restaurant pickup' : 'Next stop: Customer drop'}</div>
                      <div className="order-meta">{pickupPending ? `Pickup point: ${pickupLabel}` : destinationLabel}</div>
                      <div className={`order-priority ${p.cls}`}>{p.text}</div>
                      <div className="order-footer">
                        <div className="order-distance">{order.distance_km} km</div>
                        <div className="order-eta">Status: <span style={{ color: 'var(--green)' }}>{statusLabel(order.status)}</span></div>
                      </div>
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                        onClick={() => navigate(`/delivery/nav?order=${order.id}`)}
                      >
                        {pickupPending ? 'Open Pickup Navigation' : 'Open Delivery Navigation'}
                      </button>
                      <button
                        className="btn btn-ghost"
                        style={{ width: '100%', justifyContent: 'center', marginTop: 10 }}
                        onClick={() => navigate('/delivery/qr')}
                        disabled={order.status !== 'ready'}
                      >
                        {order.status === 'ready' ? 'Scan Pickup QR' : 'Waiting for READY status'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ marginTop: 12 }}>
                <button className="btn btn-primary" onClick={() => navigate('/delivery/nav')} disabled={acceptedOrders.length === 0}>
                  Open Navigation
                </button>
              </div>
            </>
          )}

        <div style={{ marginBottom: 16, marginTop: acceptedOrders.length > 0 ? 24 : 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Available Orders</div>
          <div style={{ fontSize: 12, color: 'var(--text2)' }}>
            {partnerPoint
              ? `Partner location: ${partnerPoint.lat.toFixed(4)}, ${partnerPoint.lng.toFixed(4)}`
              : 'Initializing partner location...'}
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
              const pickupPointLabel = order.restaurant_lat != null && order.restaurant_lng != null
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
                    disabled={isAccepting}
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

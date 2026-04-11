import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import { usePolling } from '../../hooks/usePolling';
import { orderService } from '../../services/orderService';
import { deliveryService } from '../../services/deliveryService';
import { routingService } from '../../services/routingService';
import { useSocket } from '../../contexts/SocketContext';
import { Order, RouteStop } from '../../types';
import { DELIVERY_ACTIVE_STATUSES, statusLabel } from '../../utils/status';
import { extractErrorMessage } from '../../utils/errors';
import { randomPointInDeliveryZone } from '../../utils/deliveryZone';

type GeoPoint = { lat: number; lng: number };

export default function Navigation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { emitLocationUpdate, isConnected } = useSocket();

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [partnerPoint, setPartnerPoint] = useState<GeoPoint | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeMeta, setRouteMeta] = useState<{ totalDistance: number; eta: number; algorithm: string } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [statusLoadingOrderId, setStatusLoadingOrderId] = useState<number | null>(null);
  const [seedingLocation, setSeedingLocation] = useState(false);

  const activeOrders = useMemo(
    () => orders.filter((o) => DELIVERY_ACTIVE_STATUSES.includes(o.status)),
    [orders],
  );

  usePolling(
    () => orderService.list(),
    6000,
    (data) => setOrders(data),
  );

  useEffect(() => {
    setStatusLoadingOrderId((current) => {
      if (!current) return current;
      return activeOrders.some((order) => order.id === current) ? current : null;
    });
  }, [activeOrders]);

  usePolling(
    () => deliveryService.me(),
    15000,
    (partner) => {
      setPartnerId(partner.id);
      if (partner.current_lat != null && partner.current_lng != null) {
        setPartnerPoint({ lat: partner.current_lat, lng: partner.current_lng });
      } else if (!seedingLocation) {
        setSeedingLocation(true);
        const fallback = randomPointInDeliveryZone();
        void deliveryService.updateLocation(fallback.lat, fallback.lng, 0)
          .then(() => {
            setPartnerPoint(fallback);
            emitLocationUpdate({
              partner_id: partner.id,
              lat: fallback.lat,
              lng: fallback.lng,
              speed_kmh: 0,
            });
          })
          .finally(() => setSeedingLocation(false));
      }
    },
  );

  useEffect(() => {
    if (activeOrders.length === 0) {
      setSelectedOrderIds([]);
      return;
    }

    const queryOrder = Number(searchParams.get('order'));
    const validQueryOrder = queryOrder && activeOrders.some((o) => o.id === queryOrder) ? [queryOrder] : [];

    setSelectedOrderIds((prev) => {
      const validPrevious = prev.filter((id) => activeOrders.some((o) => o.id === id)).slice(0, 4);
      if (validPrevious.length > 0) return validPrevious;
      if (validQueryOrder.length > 0) return validQueryOrder;
      return activeOrders.slice(0, Math.min(4, activeOrders.length)).map((o) => o.id);
    });
  }, [activeOrders, searchParams]);

  const syncCurrentLocation = useCallback(async () => {
    if (!navigator.geolocation) {
      setRouteError('Location permission is unavailable in this browser.');
      return null;
    }

    const coords = await new Promise<GeolocationCoordinates>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => resolve(position.coords),
        (error) => reject(error),
        { enableHighAccuracy: true, timeout: 10000 },
      );
    }).catch(() => null);

    if (!coords) {
      setRouteError('Could not read your live location. Please allow location access and retry.');
      return null;
    }

    const speedKmh = Math.max(0, (coords.speed || 0) * 3.6);

    await deliveryService.updateLocation(coords.latitude, coords.longitude, speedKmh);
    if (partnerId) {
      emitLocationUpdate({
        partner_id: partnerId,
        lat: coords.latitude,
        lng: coords.longitude,
        speed_kmh: speedKmh,
      });
    }

    const point = { lat: coords.latitude, lng: coords.longitude };
    setPartnerPoint(point);
    return point;
  }, [emitLocationUpdate, partnerId]);

  const buildRoute = useCallback(async () => {
    if (!selectedOrderIds.length) {
      setRouteError('Select at least one order to optimize route.');
      return;
    }

    setLoadingRoute(true);
    setRouteError('');

    try {
      let point = partnerPoint;
      if (!point) point = await syncCurrentLocation();
      if (!point) return;

      const route = await routingService.optimizeRoute(selectedOrderIds);

      const withCoords = await Promise.all(
        route.stops.map(async (stop) => {
          if (stop.lat != null && stop.lng != null) return stop;

          if (stop.stop_type === 'pickup') return stop;

          const order = activeOrders.find((o) => o.id === stop.order_id);
          if (!order?.customer_address) return stop;

          try {
            const result = await routingService.geocodeAddress(order.customer_address);
            if (!result) return stop;
            return { ...stop, lat: result.lat, lng: result.lng };
          } catch {
            return stop;
          }
        }),
      );

      setRouteStops(withCoords);
      setRouteMeta({
        totalDistance: route.total_distance_km,
        eta: route.estimated_minutes,
        algorithm: route.algorithm,
      });
    } catch (err) {
      setRouteError(extractErrorMessage(err, 'Failed to optimize route.'));
      setRouteStops([]);
      setRouteMeta(null);
    } finally {
      setLoadingRoute(false);
    }
  }, [activeOrders, partnerPoint, selectedOrderIds, syncCurrentLocation]);

  useEffect(() => {
    if (selectedOrderIds.length === 0) {
      setRouteStops([]);
      setRouteMeta(null);
      return;
    }

    buildRoute();
  }, [selectedOrderIds, buildRoute]);

  const toggleOrder = (orderId: number) => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev.filter((id) => id !== orderId);
      if (prev.length >= 4) return prev;
      return [...prev, orderId];
    });
  };

  const mapPoints: GeoPoint[] = [
    ...(partnerPoint ? [partnerPoint] : []),
    ...routeStops
      .filter((stop) => stop.lat != null && stop.lng != null)
      .map((stop) => ({ lat: stop.lat as number, lng: stop.lng as number })),
  ];

  const routeLine = mapPoints.map((p) => [p.lat, p.lng] as [number, number]);

  const runStatusAction = async (order: Order) => {
    setStatusLoadingOrderId(order.id);
    try {
      if (order.status === 'picked_up') {
        await orderService.updateStatus(order.id, 'in_transit');
      } else if (order.status === 'in_transit') {
        await orderService.updateStatus(order.id, 'delivered');
      } else if (order.status === 'ready') {
        navigate(`/delivery/qr?order=${order.id}`);
        return;
      }

      const mine = await orderService.list();
      setOrders(mine);
    } finally {
      setStatusLoadingOrderId(null);
    }
  };

  const actionLabel = (status: Order['status']) => {
    if (status === 'ready') return 'Scan pickup QR';
    if (status === 'picked_up') return 'Mark in transit';
    if (status === 'in_transit') return 'Mark delivered';
    return 'Waiting for update';
  };

  const actionEnabled = (status: Order['status']) => ['ready', 'picked_up', 'in_transit'].includes(status);

  return (
    <>
      <TopBar title="Navigation" subtitle={`${selectedOrderIds.length} selected stop${selectedOrderIds.length === 1 ? '' : 's'} · max 4`}>
        <div className={`status-pill ${isConnected ? 'online' : 'warning'}`}><div className="dot" /> {isConnected ? 'Connected' : 'Reconnecting'}</div>
      </TopBar>
      <div className="content">
        <div className="three-col">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <div className="map-container" style={{ height: 320 }}>
              <MapContainer
                center={partnerPoint ? [partnerPoint.lat, partnerPoint.lng] : [17.4369, 78.4001]}
                zoom={13}
                className="map-real"
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {partnerPoint && (
                  <CircleMarker center={[partnerPoint.lat, partnerPoint.lng]} radius={8} pathOptions={{ color: '#f5a623', fillOpacity: 0.95, weight: 2 }}>
                    <Popup>You are here</Popup>
                  </CircleMarker>
                )}

                {routeStops.map((stop) =>
                  stop.lat != null && stop.lng != null ? (
                    <CircleMarker
                      key={stop.order_id}
                      center={[stop.lat, stop.lng]}
                      radius={7}
                      pathOptions={{ color: stop.priority === 1 ? '#ef4444' : '#22c55e', fillOpacity: 0.9, weight: 2 }}
                    >
                      <Popup>
                        #{stop.order_number} - {stop.food_name}
                      </Popup>
                    </CircleMarker>
                  ) : null,
                )}

                {routeLine.length >= 2 && (
                  <Polyline positions={routeLine} pathOptions={{ color: '#22c55e', weight: 3 }} />
                )}
              </MapContainer>
            </div>

            <Panel title="Route Builder" action={<div style={{ fontSize: 11, color: 'var(--text3)' }}>Up to 4 orders</div>}>
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {activeOrders.length === 0 ? (
                  <div style={{ color: 'var(--text2)', fontSize: 13 }}>No active orders assigned.</div>
                ) : (
                  activeOrders.map((order) => {
                    const checked = selectedOrderIds.includes(order.id);
                    const disabled = !checked && selectedOrderIds.length >= 4;
                    const pickupPending = ['confirmed', 'preparing', 'ready'].includes(order.status);
                    return (
                      <label key={order.id} className={`turn-item ${checked ? 'active' : 'normal'}`} style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          disabled={disabled}
                          onChange={() => toggleOrder(order.id)}
                        />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>#{order.order_number} · {order.items?.[0]?.food_item_name || 'Order'}</div>
                          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                            {pickupPending ? 'Pickup pending' : 'Delivering'} · {statusLabel(order.status)}
                          </div>
                        </div>
                      </label>
                    );
                  })
                )}

                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <button className="btn btn-ghost" onClick={syncCurrentLocation}>Sync Location</button>
                  <button className="btn btn-primary" onClick={buildRoute} disabled={loadingRoute || selectedOrderIds.length === 0}>
                    {loadingRoute ? 'Optimizing...' : 'Optimize Route'}
                  </button>
                </div>
                {routeError && <div style={{ color: 'var(--red)', fontSize: 12 }}>{routeError}</div>}
              </div>
            </Panel>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <Panel title="Delivery Sequence" action={<div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>{routeMeta?.algorithm || 'NO ROUTE'}</div>}>
              <div className="route-sequence">
                {routeStops.length === 0 ? (
                  <div style={{ color: 'var(--text2)', fontSize: 13 }}>Optimize route to view sequence.</div>
                ) : (
                  routeStops.map((stop, index) => {
                    const order = activeOrders.find((o) => o.id === stop.order_id);
                    return (
                      <div key={stop.order_id} className={`route-step ${stop.priority === 1 ? 'priority-1' : stop.priority === 2 ? 'priority-2' : 'priority-3'}`}>
                        <div className={`route-num ${index === 0 ? 'n1' : index === 1 ? 'n2' : index === 2 ? 'n3' : 'n4'}`}>{index + 1}</div>
                        <div className="route-food-emoji">{stop.stop_type === 'pickup' ? '🏪' : stop.food_emoji}</div>
                        <div className="route-info">
                          <div className="route-customer">#{stop.order_number} · {stop.food_name}</div>
                          <div className="route-reason">
                            {stop.stop_type === 'pickup'
                              ? `Pickup at restaurant · ${stop.distance_km} km from previous stop`
                              : stop.priority_reason || `${stop.distance_km} km from previous stop`}
                          </div>
                          {order && (
                            <button
                              className="btn btn-ghost"
                              style={{ marginTop: 8, padding: '6px 10px', fontSize: 11 }}
                              disabled={!actionEnabled(order.status) || statusLoadingOrderId === order.id}
                              onClick={() => runStatusAction(order)}
                            >
                              {statusLoadingOrderId === order.id ? 'Updating...' : actionLabel(order.status)}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Panel>

            <Panel title="Route Stats">
              <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>Total Distance</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>{routeMeta ? `${routeMeta.totalDistance.toFixed(1)} km` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>Estimated Duration</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>{routeMeta ? `${routeMeta.eta} min` : '—'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                  <span style={{ color: 'var(--text2)' }}>Algorithm</span>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text3)' }}>{routeMeta?.algorithm || '—'}</span>
                </div>
              </div>
            </Panel>
          </div>
        </div>
      </div>
    </>
  );
}

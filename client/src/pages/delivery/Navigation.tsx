import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, Marker, Polyline, Popup, TileLayer } from 'react-leaflet';
import { createCurrentLocationIcon, createTravellingIcon, createRestaurantIcon, createCustomerIcon } from '../../utils/mapIcons';
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
import {
  GeoPoint,
  fetchRoadRoute,
  buildFallbackRoadRoute,
} from '../../utils/fleetSimulation';

const AREA_CENTER: GeoPoint = { lat: 17.4369, lng: 78.4001 };

function createTempRng() {
  return {
    next: () => Math.random(),
    range: (a: number, b: number) => a + Math.random() * (b - a),
    int: (a: number, b: number) => Math.floor(a + Math.random() * (b - a + 1)),
    seed: Date.now(),
  };
}

export default function Navigation() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { emitLocationUpdate, isConnected, orderUpdate, joinTracking } = useSocket();

  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [partnerId, setPartnerId] = useState<number | null>(null);
  const [partnerPoint, setPartnerPoint] = useState<GeoPoint | null>(null);
  const [routeStops, setRouteStops] = useState<RouteStop[]>([]);
  const [routeMeta, setRouteMeta] = useState<{ totalDistance: number; eta: number; algorithm: string } | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState('');
  const [statusLoadingOrderId, setStatusLoadingOrderId] = useState<number | null>(null);

  const [travelSpeed, setTravelSpeed] = useState(30);
  const [isTravelling, setIsTravelling] = useState(false);
  const [currentLegIndex, setCurrentLegIndex] = useState(0);
  const [arrivedAtStop, setArrivedAtStop] = useState<'restaurant' | 'customer' | null>(null);
  const [showDeliverButton, setShowDeliverButton] = useState(false);
  const [travelPoints, setTravelPoints] = useState<GeoPoint[]>([]);
  const [loadingTravel, setLoadingTravel] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [mobileSheetTab, setMobileSheetTab] = useState<'route' | 'sequence' | 'stats'>('route');

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const legProgressRef = useRef(0);
  const emitIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
    if (!orderUpdate) return;
    setOrders((prev) =>
      prev
        .map((o) =>
          o.id === orderUpdate.order_id
            ? { ...o, status: orderUpdate.status as Order['status'], partner_id: orderUpdate.partner_id ?? o.partner_id }
            : o
        )
        .filter((o) => o.status !== 'cancelled')
    );
  }, [orderUpdate]);

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
      }
    },
  );

  useEffect(() => {
    selectedOrderIds.forEach((id) => joinTracking(id));
  }, [selectedOrderIds, joinTracking]);

  useEffect(() => {
    if (activeOrders.length === 0) {
      setSelectedOrderIds([]);
      return;
    }

    const queryOrder = Number(searchParams.get('order'));
    const validQueryOrder =
      queryOrder && activeOrders.some((o) => o.id === queryOrder) ? [queryOrder] : [];

    setSelectedOrderIds((prev) => {
      const validPrevious = prev.filter((id) => activeOrders.some((o) => o.id === id)).slice(0, 4);
      if (validPrevious.length > 0) return validPrevious;
      if (validQueryOrder.length > 0) return validQueryOrder;
      return activeOrders.slice(0, Math.min(4, activeOrders.length)).map((o) => o.id);
    });
  }, [activeOrders, searchParams]);

  const currentOrder = useMemo<Order | null>(() => {
    const id = Number(searchParams.get('order'));
    if (id) return orders.find((o) => o.id === id) || null;
    return activeOrders[0] || null;
  }, [orders, activeOrders, searchParams]);

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
      emitLocationUpdate({ partner_id: partnerId, lat: coords.latitude, lng: coords.longitude, speed_kmh: speedKmh });
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

          const ord = activeOrders.find((o) => o.id === stop.order_id);
          if (!ord?.customer_address) return stop;

          try {
            const result = await routingService.geocodeAddress(ord.customer_address);
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

    void buildRoute();
  }, [selectedOrderIds, buildRoute]);

  const buildTravelPolyline = useCallback(async (): Promise<GeoPoint[]> => {
    if (!partnerPoint || !routeStops.length) return [];
    const waypoints: GeoPoint[] = [partnerPoint];
    for (const stop of routeStops) {
      if (stop.lat != null && stop.lng != null) {
        waypoints.push({ lat: stop.lat, lng: stop.lng });
      }
    }
    if (waypoints.length < 2) return waypoints;

    const result: GeoPoint[] = [waypoints[0]];
    for (let i = 0; i < waypoints.length - 1; i++) {
      const leg = await fetchRoadRoute(waypoints[i], waypoints[i + 1]);
      if (leg && leg.points.length > 0) {
        result.push(...leg.points.slice(1));
      } else {
        const fallback = buildFallbackRoadRoute(waypoints[i], waypoints[i + 1], AREA_CENTER, 5, createTempRng());
        result.push(...fallback.points.slice(1));
      }
    }
    return result;
  }, [partnerPoint, routeStops]);

  const legSegmentMeters = useCallback(
    (legIdx: number): number => {
      if (legIdx >= routeStops.length) return 1000;
      return Math.max(1, (routeStops[legIdx].distance_km || 1) * 1000);
    },
    [routeStops],
  );

  const totalLegsCount = routeStops.length;

  const startTravel = useCallback(async () => {
    setLoadingTravel(true);
    const points = await buildTravelPolyline();
    setTravelPoints(points);
    setLoadingTravel(false);

    if (!points.length) return;

    setIsTravelling(true);
    setCurrentLegIndex(0);
    legProgressRef.current = 0;
    setArrivedAtStop(null);
    setShowDeliverButton(false);
    lastTimeRef.current = performance.now();

    let currentLeg = 0;
    let progress = 0;

    const tick = (now: number) => {
      const deltaMs = Math.min(now - lastTimeRef.current, 100);
      lastTimeRef.current = now;

      const speedMps = (travelSpeed * 1000) / 3600;
      const distM = speedMps * (deltaMs / 1000);

      progress += distM / legSegmentMeters(currentLeg);

      if (progress >= 1) {
        if (currentLeg < totalLegsCount - 1) {
          currentLeg++;
          progress = 0;
          setCurrentLegIndex(currentLeg);
          // travelProgress state removed
          legProgressRef.current = 0;

          const stop = routeStops[currentLeg];
          if (stop?.stop_type === 'pickup') {
            setArrivedAtStop('restaurant');
          } else {
            setArrivedAtStop('customer');
          }
        } else {
          setIsTravelling(false);
          return;
        }
      } else {
        legProgressRef.current = progress;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [buildTravelPolyline, travelSpeed, legSegmentMeters, routeStops, totalLegsCount]);

  useEffect(() => {
    if (arrivedAtStop !== 'restaurant' || !currentOrder) return;
    const timer = setTimeout(() => setShowDeliverButton(true), 5000);
    return () => clearTimeout(timer);
  }, [arrivedAtStop, currentOrder]);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const stopTravel = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setIsTravelling(false);
    legProgressRef.current = 0;
    setArrivedAtStop(null);
    setShowDeliverButton(false);
    setCurrentLegIndex(0);
  };

  const travellingMarkerPos = useMemo<GeoPoint | null>(() => {
    if (!isTravelling || !travelPoints.length) return partnerPoint;
    if (arrivedAtStop) return partnerPoint;

    let pointIndex = 0;
    for (let i = 0; i < currentLegIndex; i++) {
      pointIndex += Math.max(1, Math.round((routeStops[i].distance_km || 1) * 50));
    }

    const segLen = Math.max(1, Math.round((routeStops[currentLegIndex]?.distance_km || 1) * 50));
    const localProgress = legProgressRef.current;
    const targetIdx = Math.min(pointIndex + Math.round(localProgress * segLen), travelPoints.length - 1);

    return travelPoints[targetIdx] || partnerPoint;
  }, [isTravelling, travelPoints, partnerPoint, currentLegIndex, routeStops, arrivedAtStop]);

  useEffect(() => {
    if (!isTravelling || !partnerId) return;

    const emitInterval = setInterval(() => {
      const pos = travellingMarkerPos;
      if (pos) {
        emitLocationUpdate({ partner_id: partnerId, lat: pos.lat, lng: pos.lng, speed_kmh: travelSpeed });
        void deliveryService.updateLocation(pos.lat, pos.lng, travelSpeed);
      }
    }, 2000);

    emitIntervalRef.current = emitInterval;
    return () => clearInterval(emitInterval);
  }, [isTravelling, partnerId, travellingMarkerPos, travelSpeed, emitLocationUpdate]);

  useEffect(() => {
    if (!partnerId || isTravelling) return;
    if (!('geolocation' in navigator)) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, speed } = position.coords;
        const speedKmh = Math.max(0, (speed || 0) * 3.6);
        setPartnerPoint({ lat: latitude, lng: longitude });
        emitLocationUpdate({ partner_id: partnerId, lat: latitude, lng: longitude, speed_kmh: speedKmh });
        void deliveryService.updateLocation(latitude, longitude, speedKmh).catch(() => {});
      },
      (err) => {
        console.warn('[GPS] watchPosition error', err);
      },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 20000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [partnerId, isTravelling, emitLocationUpdate]);

  const routeLine = useMemo<[number, number][]>(() => {
    if (!travelPoints.length || !partnerPoint) return [];
    if (arrivedAtStop) return [[partnerPoint.lat, partnerPoint.lng]];
    return [
      [partnerPoint.lat, partnerPoint.lng],
      ...travelPoints.map((p) => [p.lat, p.lng] as [number, number]),
    ];
  }, [travelPoints, partnerPoint, arrivedAtStop]);

  const toggleOrder = (orderId: number) => {
    if (isTravelling) return;
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) return prev.filter((id) => id !== orderId);
      if (prev.length >= 4) return prev;
      return [...prev, orderId];
    });
  };

  const runStatusAction = async (order: Order) => {
    setStatusLoadingOrderId(order.id);
    try {
      if (order.status === 'picked_up') {
        await orderService.updateStatus(order.id, 'in_transit');
      } else if (order.status === 'in_transit') {
        await orderService.updateStatus(order.id, 'delivered');
        stopTravel();
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

  const handleTakeOrder = async () => {
    if (!currentOrder) return;
    setArrivedAtStop(null);
    setShowDeliverButton(false);
    legProgressRef.current = 0;
    if (currentLegIndex < totalLegsCount - 1) {
      setCurrentLegIndex(currentLegIndex + 1);
    }
    await orderService.updateStatus(currentOrder.id, 'picked_up');
    const mine = await orderService.list();
    setOrders(mine);
  };

  const handleDeliverIt = async () => {
    if (!currentOrder) return;
    setArrivedAtStop(null);
    setShowDeliverButton(false);
    await orderService.updateStatus(currentOrder.id, 'in_transit');
    const mine = await orderService.list();
    setOrders(mine);
  };

  const handleMarkDelivered = async () => {
    if (!currentOrder) return;
    setArrivedAtStop(null);
    setIsTravelling(false);
    await orderService.updateStatus(currentOrder.id, 'delivered');
    const mine = await orderService.list();
    setOrders(mine);
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
      {/* Full-screen map */}
      <div className="map-container nav-fullscreen">
        <MapContainer
          center={partnerPoint ? [partnerPoint.lat, partnerPoint.lng] : [17.4369, 78.4001]}
          zoom={13}
          className="map-real"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          {partnerPoint && !isTravelling && (
            <Marker
              position={[partnerPoint.lat, partnerPoint.lng]}
              icon={createCurrentLocationIcon()}
            >
              <Popup>You are here</Popup>
            </Marker>
          )}

          {travellingMarkerPos && isTravelling && (
            <Marker
              position={[travellingMarkerPos.lat, travellingMarkerPos.lng]}
              icon={createTravellingIcon()}
            >
              <Popup>🛵 Traveling at {travelSpeed} km/h</Popup>
            </Marker>
          )}

          {routeStops.map((stop) =>
            stop.lat != null && stop.lng != null ? (
              <Marker
                key={stop.order_id}
                position={[stop.lat, stop.lng]}
                icon={stop.stop_type === 'pickup' ? createRestaurantIcon() : createCustomerIcon()}
              >
                <Popup>
                  #{stop.order_number} - {stop.food_name}
                </Popup>
              </Marker>
            ) : null,
          )}

          {routeLine.length >= 2 && (
            <Polyline
              positions={routeLine}
              pathOptions={{ color: isTravelling ? '#3b82f6' : '#22c55e', weight: 3 }}
            />
          )}
        </MapContainer>
      </div>

      {/* TopBar overlay */}
      <div className="nav-overlay nav-overlay-topbar">
        <TopBar
          title="Navigation"
          subtitle={`${selectedOrderIds.length} stop${selectedOrderIds.length === 1 ? '' : 's'} · max 4 · click map to select`}
        >
          <div className={`status-pill ${isConnected ? 'online' : 'warning'}`}>
            <div className="dot" /> {isConnected ? 'Connected' : 'Reconnecting'}
          </div>
        </TopBar>
      </div>

      {/* Route Builder - bottom left */}
      <div className="nav-overlay nav-overlay-left">
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>ROUTE BUILDER · UP TO 4 ORDERS</div>
          {activeOrders.length === 0 ? (
            <div style={{ color: 'var(--text2)', fontSize: 12 }}>No active orders assigned.</div>
          ) : (
            activeOrders.map((order) => {
              const checked = selectedOrderIds.includes(order.id);
              const disabled = !checked && selectedOrderIds.length >= 4;
              const pickupPending = ['confirmed', 'preparing', 'ready'].includes(order.status);
              return (
                <label
                  key={order.id}
                  className={`turn-item ${checked ? 'active' : 'normal'}`}
                  style={{ cursor: disabled || isTravelling ? 'not-allowed' : 'pointer', opacity: disabled || isTravelling ? 0.5 : 1 }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={disabled || isTravelling}
                    onChange={() => toggleOrder(order.id)}
                  />
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 12 }}>
                      #{order.order_number} · {order.items?.[0]?.food_item_name || 'Order'}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                      {pickupPending ? 'Pickup pending' : 'Delivering'} · {statusLabel(order.status)}
                    </div>
                  </div>
                </label>
              );
            })
          )}

          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => void syncCurrentLocation()} disabled={isTravelling}>
              📍 Sync
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 11, padding: '6px 10px', flex: 1 }}
              onClick={() => void buildRoute()}
              disabled={loadingRoute || selectedOrderIds.length === 0 || isTravelling}
            >
              {loadingRoute ? 'Optimizing...' : '🗺️ Optimize Route'}
            </button>
          </div>
          {routeError && <div style={{ color: 'var(--red)', fontSize: 11 }}>{routeError}</div>}
        </div>
      </div>

      {/* Delivery Sequence - top right */}
      <div className="nav-overlay nav-overlay-right-top">
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>DELIVERY SEQUENCE · {routeMeta?.algorithm || 'NO ROUTE'}</div>
          {routeStops.length === 0 ? (
            <div style={{ color: 'var(--text2)', fontSize: 12 }}>Optimize route to view stops.</div>
          ) : (
            routeStops.map((stop, index) => {
              const order = activeOrders.find((o) => o.id === stop.order_id);
              return (
                <div
                  key={stop.order_id}
                  className={`route-step ${stop.priority === 1 ? 'priority-1' : stop.priority === 2 ? 'priority-2' : 'priority-3'}`}
                >
                  <div className={`route-num ${index === 0 ? 'n1' : index === 1 ? 'n2' : index === 2 ? 'n3' : 'n4'}`}>
                    {index + 1}
                  </div>
                  <div className="route-food-emoji">{stop.stop_type === 'pickup' ? '🏪' : stop.food_emoji}</div>
                  <div className="route-info">
                    <div className="route-customer">#{stop.order_number} · {stop.food_name}</div>
                    <div className="route-reason">
                      {stop.stop_type === 'pickup'
                        ? `Pickup · ${stop.distance_km} km`
                        : stop.priority_reason || `${stop.distance_km} km`}
                    </div>
                    {order && (
                      <button
                        className="btn btn-ghost"
                        style={{ marginTop: 6, padding: '4px 8px', fontSize: 10 }}
                        disabled={!actionEnabled(order.status) || statusLoadingOrderId === order.id}
                        onClick={() => void runStatusAction(order)}
                      >
                        {statusLoadingOrderId === order.id ? '...' : actionLabel(order.status)}
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Route Stats - bottom right */}
      <div className="nav-overlay nav-overlay-right-bottom">
        <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>ROUTE STATS</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text2)' }}>Distance</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
              {routeMeta ? `${routeMeta.totalDistance.toFixed(1)} km` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text2)' }}>Duration</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{routeMeta ? `${routeMeta.eta} min` : '—'}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text2)' }}>Speed</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: isTravelling ? '#3b82f6' : 'var(--text3)' }}>
              {isTravelling ? `${travelSpeed} km/h` : '—'}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
            <span style={{ color: 'var(--text2)' }}>Stops</span>
            <span style={{ fontFamily: 'var(--font-mono)' }}>{routeStops.length}</span>
          </div>
        </div>
      </div>

      {/* Bottom bar: speed + start/stop */}
      <div className="nav-overlay nav-overlay-bottombar">
        <div className="travel-speed-control">
          <label>Speed <strong>{travelSpeed} km/h</strong></label>
          <input
            type="range"
            min="10"
            max="80"
            value={travelSpeed}
            onChange={(e) => setTravelSpeed(Number(e.target.value))}
            disabled={isTravelling}
          />
        </div>
        <div className="travel-actions">
          {!isTravelling ? (
            <button
              className="btn btn-primary"
              onClick={() => void startTravel()}
              disabled={loadingTravel || !routeStops.length}
            >
              {loadingTravel ? 'Loading...' : '▶ Start Delivery'}
            </button>
          ) : (
            <button className="btn btn-ghost" onClick={stopTravel}>
              ⏹ Stop
            </button>
          )}
        </div>
      </div>

      {/* Mobile FAB — only visible at ≤768px via CSS */}
      <button
        className="nav-mobile-fab"
        onClick={() => setMobileSheetOpen((o) => !o)}
        aria-label="Route builder"
      >
        {mobileSheetOpen ? '✕' : '🗺️'}
      </button>

      {/* Mobile sheet — Route/Sequence/Stats tabs (replaces hidden overlays on mobile) */}
      <div className={`nav-mobile-sheet${mobileSheetOpen ? ' open' : ''}`}>
        <div className="nav-mobile-sheet-tabs">
          {(['route', 'sequence', 'stats'] as const).map((tab) => (
            <button
              key={tab}
              className={`nav-mobile-sheet-tab${mobileSheetTab === tab ? ' active' : ''}`}
              onClick={() => setMobileSheetTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {mobileSheetTab === 'route' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>ROUTE BUILDER · UP TO 4 ORDERS</div>
            {activeOrders.length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: 12 }}>No active orders assigned.</div>
            ) : (
              activeOrders.map((order) => {
                const checked = selectedOrderIds.includes(order.id);
                const disabled = !checked && selectedOrderIds.length >= 4;
                const pickupPending = ['confirmed', 'preparing', 'ready'].includes(order.status);
                return (
                  <label
                    key={order.id}
                    className={`turn-item ${checked ? 'active' : 'normal'}`}
                    style={{ cursor: disabled || isTravelling ? 'not-allowed' : 'pointer', opacity: disabled || isTravelling ? 0.5 : 1 }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={disabled || isTravelling}
                      onChange={() => toggleOrder(order.id)}
                    />
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 12 }}>
                        #{order.order_number} · {order.items?.[0]?.food_item_name || 'Order'}
                      </div>
                      <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: 'var(--font-mono)' }}>
                        {pickupPending ? 'Pickup pending' : 'Delivering'} · {statusLabel(order.status)}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '6px 10px' }} onClick={() => void syncCurrentLocation()} disabled={isTravelling}>
                📍 Sync
              </button>
              <button
                className="btn btn-primary"
                style={{ fontSize: 11, padding: '6px 10px', flex: 1 }}
                onClick={() => void buildRoute()}
                disabled={loadingRoute || selectedOrderIds.length === 0 || isTravelling}
              >
                {loadingRoute ? 'Optimizing...' : '🗺️ Optimize Route'}
              </button>
            </div>
            {routeError && <div style={{ color: 'var(--red)', fontSize: 11 }}>{routeError}</div>}
          </div>
        )}

        {mobileSheetTab === 'sequence' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 4 }}>DELIVERY SEQUENCE · {routeMeta?.algorithm || 'NO ROUTE'}</div>
            {routeStops.length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: 12 }}>Optimize route to view stops.</div>
            ) : (
              routeStops.map((stop, index) => {
                const order = activeOrders.find((o) => o.id === stop.order_id);
                return (
                  <div
                    key={stop.order_id}
                    className={`route-step ${stop.priority === 1 ? 'priority-1' : stop.priority === 2 ? 'priority-2' : 'priority-3'}`}
                  >
                    <div className={`route-num ${index === 0 ? 'n1' : index === 1 ? 'n2' : index === 2 ? 'n3' : 'n4'}`}>
                      {index + 1}
                    </div>
                    <div className="route-food-emoji">{stop.stop_type === 'pickup' ? '🏪' : stop.food_emoji}</div>
                    <div className="route-info">
                      <div className="route-customer">#{stop.order_number} · {stop.food_name}</div>
                      <div className="route-reason">
                        {stop.stop_type === 'pickup'
                          ? `Pickup · ${stop.distance_km} km`
                          : stop.priority_reason || `${stop.distance_km} km`}
                      </div>
                      {order && (
                        <button
                          className="btn btn-ghost"
                          style={{ marginTop: 6, padding: '4px 8px', fontSize: 10 }}
                          disabled={!actionEnabled(order.status) || statusLoadingOrderId === order.id}
                          onClick={() => void runStatusAction(order)}
                        >
                          {statusLoadingOrderId === order.id ? '...' : actionLabel(order.status)}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {mobileSheetTab === 'stats' && (
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 2 }}>ROUTE STATS</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>Distance</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--amber)' }}>
                {routeMeta ? `${routeMeta.totalDistance.toFixed(1)} km` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>Duration</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{routeMeta ? `${routeMeta.eta} min` : '—'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>Speed</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: isTravelling ? '#3b82f6' : 'var(--text3)' }}>
                {isTravelling ? `${travelSpeed} km/h` : '—'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
              <span style={{ color: 'var(--text2)' }}>Stops</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{routeStops.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Arrival banner - centered over map */}
      {arrivedAtStop && currentOrder && (
        <div className="nav-arrival">
          <div className="nav-arrival-icon">
            {arrivedAtStop === 'restaurant' ? '🏪' : '🏠'}
          </div>
          <div className="nav-arrival-text">
            <strong>{arrivedAtStop === 'restaurant' ? 'Arrived at Restaurant' : 'Arrived at Customer'}</strong>
            <span>{currentOrder.items?.[0]?.food_item_name || `Order #${currentOrder.order_number}`}</span>
          </div>
          <div className="nav-arrival-buttons">
            {arrivedAtStop === 'restaurant' && (
              <>
                <button className="btn btn-primary" onClick={handleTakeOrder}>
                  🚶 Take
                </button>
                {showDeliverButton && (
                  <button className="btn btn-green" onClick={handleDeliverIt}>
                    🚚 Deliver
                  </button>
                )}
              </>
            )}
            {arrivedAtStop === 'customer' && (
              <button className="btn btn-green" onClick={handleMarkDelivered}>
                ✓ Done
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

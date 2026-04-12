import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Marker, MapContainer, Polyline, Popup, TileLayer } from 'react-leaflet';
import { createPartnerIcon, createRestaurantIcon } from '../../utils/mapIcons';
import TopBar from '../../components/TopBar';
import Panel from '../../components/Panel';
import { restaurants } from '../../data/restaurants';
import {
  buildFallbackRoadRoute,
  buildRadiusRing,
  GeoPoint,
  bearingDegrees,
  createSeededRng,
  fetchRoadRoute,
  haversineMeters,
  interpolatePoint,
  isRouteWithinRadius,
  randomPointInRadius,
  remainingRouteDistanceMeters,
} from '../../utils/fleetSimulation';

type SimStatus = 'online' | 'busy' | 'offline';

interface SimPartner {
  id: number;
  name: string;
  avatar: string;
  status: SimStatus;
  safetyScore: number;
  rating: number;
  totalDeliveries: number;
  current: GeoPoint | null;
  destination: GeoPoint | null;
  route: GeoPoint[];
  routeIndex: number;
  segmentProgressM: number;
  speedKmh: number;
  targetSpeedKmh: number;
  nextSpeedChangeAt: number;
  bearingDeg: number;
  distanceRemainingKm: number;
  etaMin: number;
  routeDistanceKm: number;
  routeRequesting: boolean;
  pauseUntil: number;
  failureCount: number;
}

const AREA_CENTER: GeoPoint = { lat: 17.4369, lng: 78.4001 };
const AREA_SIZE_KM = 10;
const AREA_RADIUS_KM = AREA_SIZE_KM / 2;
const AREA_RADIUS_M = AREA_RADIUS_KM * 1000;
const PARTNER_COUNT = 10;
const PARTNER_NAMES = [
  'Arjun Kumar',
  'Rahul Desai',
  'Kiran Patel',
  'Ravi Teja',
  'Manish Verma',
  'Sahil Reddy',
  'Vikram Singh',
  'Ajay Nair',
  'Nikhil Das',
  'Tarun Mehta',
];
const PARTNER_AVATARS = ['🧑', '👨', '🧔', '👱', '🧑', '👨', '🧔', '👱', '🧑', '👨'];

const SPEED_MIN = 14;
const SPEED_MAX = 58;
const TARGET_SPEED_MIN = 20;
const TARGET_SPEED_MAX = 52;

function createBasePartner(index: number, now: number, seed: ReturnType<typeof createSeededRng>, startPoint: GeoPoint): SimPartner {
  return {
    id: index + 1,
    name: PARTNER_NAMES[index] || `Partner #${index + 1}`,
    avatar: PARTNER_AVATARS[index] || '🧑',
    status: 'busy',
    safetyScore: Math.round(seed.range(72, 99)),
    rating: Number(seed.range(3.9, 4.95).toFixed(1)),
    totalDeliveries: Math.round(seed.range(180, 2200)),
    current: startPoint,
    destination: null,
    route: [],
    routeIndex: 0,
    segmentProgressM: 0,
    speedKmh: 0,
    targetSpeedKmh: seed.range(TARGET_SPEED_MIN, TARGET_SPEED_MAX),
    nextSpeedChangeAt: now + seed.range(4000, 12000),
    bearingDeg: 0,
    distanceRemainingKm: 0,
    etaMin: 0,
    routeDistanceKm: 0,
    routeRequesting: true,
    pauseUntil: 0,
    failureCount: 0,
  };
}

export default function AdminPartners() {
  const [partners, setPartners] = useState<SimPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [seed, setSeed] = useState(() => Date.now());
  const [showRestaurants, setShowRestaurants] = useState(false);

  const partnersRef = useRef<SimPartner[]>([]);
  const rngRef = useRef(createSeededRng(seed));
  const lastTickRef = useRef(Date.now());
  const activeSeedRef = useRef(seed);
  const routeControllersRef = useRef(new Map<number, AbortController>());
  const pendingTimersRef = useRef<number[]>([]);
  const mountedRef = useRef(true);

  const commitPartners = useCallback((next: SimPartner[]) => {
    partnersRef.current = next;
    setPartners(next);
  }, []);

  const updatePartners = useCallback((updater: (current: SimPartner[]) => SimPartner[]) => {
    commitPartners(updater(partnersRef.current));
  }, [commitPartners]);

  const clearPendingRouteOps = useCallback(() => {
    routeControllersRef.current.forEach((controller) => controller.abort());
    routeControllersRef.current.clear();
    pendingTimersRef.current.forEach((timer) => window.clearTimeout(timer));
    pendingTimersRef.current = [];
  }, []);

  const requestRoute = useCallback(async (partnerId: number, fromPoint: GeoPoint) => {
    const callSeed = activeSeedRef.current;
    let routeFound = false;
    let failCount = 0;

    for (let attempt = 0; attempt < 3; attempt += 1) {
      const destination = randomPointInRadius(rngRef.current, AREA_CENTER, AREA_RADIUS_KM);
      if (haversineMeters(fromPoint, destination) < 1200) {
        continue;
      }

      const previousController = routeControllersRef.current.get(partnerId);
      if (previousController) {
        previousController.abort();
      }

      const controller = new AbortController();
      routeControllersRef.current.set(partnerId, controller);

      try {
        const roadRoute = await fetchRoadRoute(fromPoint, destination, controller.signal, 3000);
        if (!mountedRef.current || callSeed !== activeSeedRef.current) return;

        const routeToUse =
          roadRoute && roadRoute.points.length > 1 && isRouteWithinRadius(roadRoute.points, AREA_CENTER, AREA_RADIUS_M)
            ? roadRoute
            : buildFallbackRoadRoute(fromPoint, destination, AREA_CENTER, AREA_RADIUS_KM, rngRef.current);

        if (routeToUse && routeToUse.points.length > 1 && isRouteWithinRadius(routeToUse.points, AREA_CENTER, AREA_RADIUS_M)) {
          const start = routeToUse.points[0];
          const second = routeToUse.points[1];

          updatePartners((current) => current.map((partner) => {
            if (partner.id !== partnerId) return partner;

            return {
              ...partner,
              status: 'online',
              current: start,
              destination,
              route: routeToUse.points,
              routeIndex: 0,
              segmentProgressM: 0,
              speedKmh: Math.max(SPEED_MIN, partner.speedKmh),
              targetSpeedKmh: rngRef.current.range(TARGET_SPEED_MIN, TARGET_SPEED_MAX),
              nextSpeedChangeAt: Date.now() + rngRef.current.range(5000, 14000),
              bearingDeg: bearingDegrees(start, second),
              distanceRemainingKm: routeToUse.distanceKm,
              etaMin: Math.max(1, Math.round(routeToUse.durationMin)),
              routeDistanceKm: routeToUse.distanceKm,
              routeRequesting: false,
              pauseUntil: Date.now() + rngRef.current.range(800, 2200),
              failureCount: 0,
            };
          }));

          routeFound = true;
          break;
        }
      } catch {
        failCount += 1;
      } finally {
        const activeController = routeControllersRef.current.get(partnerId);
        if (activeController === controller) {
          routeControllersRef.current.delete(partnerId);
        }
      }
    }

    if (routeFound || !mountedRef.current || callSeed !== activeSeedRef.current) return;

    updatePartners((current) => current.map((partner) => {
      if (partner.id !== partnerId) return partner;
      return {
        ...partner,
        status: 'offline',
        current: fromPoint,
        route: [],
        routeIndex: 0,
        segmentProgressM: 0,
        speedKmh: 0,
        targetSpeedKmh: 0,
        distanceRemainingKm: 0,
        etaMin: 0,
        routeRequesting: false,
        pauseUntil: Date.now() + rngRef.current.range(8000, 16000),
        failureCount: partner.failureCount + failCount + 1,
      };
    }));
  }, [updatePartners]);

  const queueRouteRequest = useCallback((partnerId: number, from: GeoPoint, waitMs: number = 0) => {
    const delay = Math.max(0, waitMs);
    const timer = window.setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((id) => id !== timer);
      void requestRoute(partnerId, from);
    }, delay);

    pendingTimersRef.current.push(timer);
  }, [requestRoute]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearPendingRouteOps();
    };
  }, [clearPendingRouteOps]);

  useEffect(() => {
    clearPendingRouteOps();

    rngRef.current = createSeededRng(seed);
    activeSeedRef.current = seed;

    const now = Date.now();
    const initialPartners = Array.from({ length: PARTNER_COUNT }, (_, index) => {
      const startPoint = randomPointInRadius(rngRef.current, AREA_CENTER, AREA_RADIUS_KM);
      return createBasePartner(index, now, rngRef.current, startPoint);
    });

    commitPartners(initialPartners);
    lastTickRef.current = now;
    setLoading(false);

    initialPartners.forEach((partner) => {
      if (!partner.current) return;
      queueRouteRequest(partner.id, partner.current, rngRef.current.range(80, 500));
    });
  }, [seed, clearPendingRouteOps, commitPartners, queueRouteRequest]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      const now = Date.now();
      const deltaSeconds = Math.min(2, Math.max(0.4, (now - lastTickRef.current) / 1000));
      lastTickRef.current = now;

      const rerouteQueue: Array<{ partnerId: number; from: GeoPoint; waitMs: number }> = [];

      updatePartners((current) => current.map((partner) => {
        if (!partner.current || partner.routeRequesting) {
          return partner;
        }

        let targetSpeed = partner.targetSpeedKmh;
        let nextSpeedChangeAt = partner.nextSpeedChangeAt;

        if (now >= nextSpeedChangeAt) {
          targetSpeed = rngRef.current.range(TARGET_SPEED_MIN, TARGET_SPEED_MAX);
          nextSpeedChangeAt = now + rngRef.current.range(4000, 14000);
        }

        const acceleration = 8 * deltaSeconds;
        const speedDiff = targetSpeed - partner.speedKmh;
        const speedKmh = Math.min(
          SPEED_MAX,
          Math.max(
            0,
            partner.speedKmh + Math.max(-acceleration, Math.min(acceleration, speedDiff)),
          ),
        );

        if (partner.pauseUntil > now) {
          return {
            ...partner,
            status: partner.status === 'offline' ? 'offline' : 'busy',
            speedKmh: Math.max(0, speedKmh - 10 * deltaSeconds),
            targetSpeedKmh: targetSpeed,
            nextSpeedChangeAt,
            distanceRemainingKm: 0,
            etaMin: 0,
          };
        }

        if (partner.route.length < 2 || partner.routeIndex >= partner.route.length - 1) {
          rerouteQueue.push({ partnerId: partner.id, from: partner.current, waitMs: 0 });
          return {
            ...partner,
            status: 'busy',
            speedKmh: 0,
            routeRequesting: true,
            route: [],
            routeIndex: 0,
            segmentProgressM: 0,
            distanceRemainingKm: 0,
            etaMin: 0,
          };
        }

        let remainingStepM = (speedKmh * 1000 * deltaSeconds) / 3600;
        let routeIndex = partner.routeIndex;
        let segmentProgressM = partner.segmentProgressM;
        let currentPoint = partner.current;
        let bearingDeg = partner.bearingDeg;

        while (remainingStepM > 0 && routeIndex < partner.route.length - 1) {
          const from = partner.route[routeIndex];
          const to = partner.route[routeIndex + 1];
          const segmentLen = Math.max(1, haversineMeters(from, to));
          const segmentRemaining = segmentLen - segmentProgressM;

          if (remainingStepM < segmentRemaining) {
            segmentProgressM += remainingStepM;
            remainingStepM = 0;
            const ratio = segmentProgressM / segmentLen;
            currentPoint = interpolatePoint(from, to, ratio);
            bearingDeg = bearingDegrees(from, to);
          } else {
            remainingStepM -= segmentRemaining;
            routeIndex += 1;
            segmentProgressM = 0;
            currentPoint = to;

            if (routeIndex < partner.route.length - 1) {
              bearingDeg = bearingDegrees(partner.route[routeIndex], partner.route[routeIndex + 1]);
            }
          }
        }

        if (routeIndex >= partner.route.length - 1) {
          const pauseMs = rngRef.current.range(2500, 9000);
          const waitMs = Math.max(0, pauseMs - 80);

          rerouteQueue.push({
            partnerId: partner.id,
            from: currentPoint,
            waitMs,
          });

          return {
            ...partner,
            status: 'busy',
            current: currentPoint,
            routeIndex: partner.route.length - 1,
            segmentProgressM: 0,
            speedKmh: 0,
            targetSpeedKmh: rngRef.current.range(TARGET_SPEED_MIN, TARGET_SPEED_MAX),
            nextSpeedChangeAt: now + rngRef.current.range(5000, 14000),
            bearingDeg,
            distanceRemainingKm: 0,
            etaMin: 0,
            routeRequesting: true,
            pauseUntil: now + pauseMs,
          };
        }

        const remainingM = remainingRouteDistanceMeters(partner.route, routeIndex, segmentProgressM);
        const remainingKm = remainingM / 1000;
        const etaMin = speedKmh > 1
          ? Math.max(1, Math.ceil((remainingM / ((speedKmh * 1000) / 3600)) / 60))
          : partner.etaMin;

        return {
          ...partner,
          status: 'online',
          current: currentPoint,
          routeIndex,
          segmentProgressM,
          speedKmh,
          targetSpeedKmh: targetSpeed,
          nextSpeedChangeAt,
          bearingDeg,
          distanceRemainingKm: remainingKm,
          etaMin,
        };
      }));

      rerouteQueue.forEach((item) => queueRouteRequest(item.partnerId, item.from, item.waitMs));
    }, 2000);

    return () => window.clearInterval(tick);
  }, [queueRouteRequest, updatePartners]);

  const onlineCount = useMemo(() => partners.filter((partner) => partner.status === 'online').length, [partners]);
  const busyCount = useMemo(() => partners.filter((partner) => partner.status === 'busy').length, [partners]);
  const offlineCount = useMemo(() => partners.filter((partner) => partner.status === 'offline').length, [partners]);

  const visiblePartners = useMemo(
    () => partners.filter((partner) => partner.current),
    [partners],
  );

  const radiusRing = useMemo(() => buildRadiusRing(AREA_CENTER, AREA_RADIUS_KM), []);

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'var(--green)';
    if (score >= 70) return 'var(--amber)';
    return 'var(--red)';
  };

  const getStatusChip = (partner: SimPartner) => {
    if (partner.routeRequesting) return <span className="chip pending">REROUTING</span>;
    if (partner.status === 'online') return <span className="chip transit">MOVING</span>;
    if (partner.status === 'busy') return <span className="chip pending">WAITING</span>;
    return <span className="chip danger">OFFLINE</span>;
  };

  const reseed = () => {
    setSeed(Date.now() + Math.floor(Math.random() * 1000));
    setLoading(true);
  };

  return (
    <>
      <TopBar title="Delivery Partners" subtitle={`${onlineCount} moving · ${busyCount} waiting · ${offlineCount} offline · ${AREA_SIZE_KM} x ${AREA_SIZE_KM} km zone${loading ? ' · Initializing...' : ''}`}>
        <button
          className={`btn ${showRestaurants ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setShowRestaurants(!showRestaurants)}
        >
          {showRestaurants ? 'Hide' : 'Show'} Restaurants
        </button>
        <button className="btn btn-ghost" onClick={reseed}>Reseed Simulation</button>
      </TopBar>
      <div className="content">
        <div className="fleet-sim-layout">
          <Panel title="Live Fleet Map" action={<span className="chip transit">Seed {seed}</span>}>
            <div className="fleet-map-wrap">
              <MapContainer center={[AREA_CENTER.lat, AREA_CENTER.lng]} zoom={12} className="map-real" scrollWheelZoom>
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                <Polyline
                  positions={radiusRing.map((point) => [point.lat, point.lng] as [number, number])}
                  pathOptions={{ color: '#f5a623', weight: 2, dashArray: '10 8', opacity: 0.95 }}
                />

                {visiblePartners.map((partner) => {
                  if (!partner.current) return null;

                  return (
                    <Marker
                      key={partner.id}
                      position={[partner.current.lat, partner.current.lng]}
                      icon={createPartnerIcon(partner.status as 'online' | 'busy' | 'offline')}
                    >
                      <Popup>
                        <strong>{partner.name}</strong>
                        <br />
                        {partner.status === 'online' ? `Speed: ${Math.round(partner.speedKmh)} km/h` : 'Stopped / rerouting'}
                        <br />
                        {partner.distanceRemainingKm > 0 ? `${partner.distanceRemainingKm.toFixed(1)} km to next waypoint` : 'Getting next route'}
                      </Popup>
                    </Marker>
                  );
                })}

                {showRestaurants && restaurants.map((restaurant) => (
                  <Marker
                    key={`rest-${restaurant.id}`}
                    position={[restaurant.lat, restaurant.lng]}
                    icon={createRestaurantIcon()}
                  >
                    <Popup>
                      <strong>{restaurant.name}</strong>
                      <br />
                      <span style={{ fontSize: 12, color: '#666' }}>{restaurant.cuisine}</span>
                      <br />
                      <span style={{ fontSize: 11 }}>{restaurant.address}</span>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>

              <div className="fleet-map-legend">
                <div><span className="fleet-dot live" /> Moving</div>
                <div><span className="fleet-dot wait" /> Waiting</div>
                <div><span className="fleet-dot down" /> Offline</div>
                {showRestaurants && <div><span className="fleet-dot" style={{ background: '#6366f1' }} /> Restaurants</div>}
                <div><span className="fleet-dot zone" /> 10 x 10 km zone</div>
              </div>
            </div>
          </Panel>

          <Panel title="Partner Telemetry" action={<span className="chip pending">Road-locked movement</span>}>
            <div className="fleet-partner-list">
              {partners.map((p) => (
                <div key={p.id} className="fleet-partner-row">
                  <div className="partner-avatar">{p.avatar}</div>
                  <div className="fleet-partner-main">
                    <div className="fleet-partner-top">
                      <div className="partner-name">{p.name}</div>
                      {getStatusChip(p)}
                    </div>

                    <div className="fleet-partner-meta">
                      <span>{Math.round(p.speedKmh)} km/h</span>
                      <span>{p.distanceRemainingKm > 0 ? `${p.distanceRemainingKm.toFixed(1)} km left` : 'Awaiting next leg'}</span>
                      <span>{p.etaMin > 0 ? `ETA ${p.etaMin} min` : 'Rerouting'}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 8, marginBottom: 4 }}>
                      <span style={{ color: 'var(--text2)' }}>{p.totalDeliveries} deliveries · {p.rating} rating</span>
                      <span style={{ color: getScoreColor(p.safetyScore), fontFamily: 'var(--font-mono)' }}>{p.safetyScore}% safety</span>
                    </div>

                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${p.safetyScore}%`,
                          background: p.safetyScore >= 90
                            ? 'linear-gradient(90deg, var(--green), #16a34a)'
                            : p.safetyScore >= 70
                              ? undefined
                              : 'linear-gradient(90deg, var(--red), #dc2626)',
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}

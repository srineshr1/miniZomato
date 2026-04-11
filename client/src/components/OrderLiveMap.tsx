import { useEffect } from 'react';
import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';

interface GeoPoint {
  lat: number;
  lng: number;
}

interface OrderLiveMapProps {
  customer: GeoPoint | null;
  restaurant: GeoPoint | null;
  partner: GeoPoint | null;
  height?: number;
}

function FitBounds({ points }: { points: GeoPoint[] }) {
  const map = useMap();

  useEffect(() => {
    if (points.length === 0) return;
    const bounds = points.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15 });
  }, [map, points]);

  return null;
}

export default function OrderLiveMap({ customer, restaurant, partner, height = 320 }: OrderLiveMapProps) {
  if (!customer) {
    return (
      <div className="map-container" style={{ height }}>
        <div style={{ padding: 16, color: 'var(--text2)', fontSize: 13 }}>Customer location is not available for this order yet.</div>
      </div>
    );
  }

  const points = [customer, restaurant, partner].filter((p): p is GeoPoint => !!p);

  return (
    <div className="map-container" style={{ height }}>
      <MapContainer center={[customer.lat, customer.lng]} zoom={13} className="map-real" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitBounds points={points} />

        {restaurant && (
          <CircleMarker center={[restaurant.lat, restaurant.lng]} radius={8} pathOptions={{ color: '#3b82f6', weight: 2, fillOpacity: 0.9 }}>
            <Popup>Restaurant pickup location</Popup>
          </CircleMarker>
        )}

        <CircleMarker center={[customer.lat, customer.lng]} radius={8} pathOptions={{ color: '#22c55e', weight: 2, fillOpacity: 0.9 }}>
          <Popup>Delivery destination</Popup>
        </CircleMarker>

        {partner && (
          <CircleMarker center={[partner.lat, partner.lng]} radius={8} pathOptions={{ color: '#f5a623', weight: 2, fillOpacity: 0.95 }}>
            <Popup>Delivery partner live position</Popup>
          </CircleMarker>
        )}

        {restaurant && partner && (
          <Polyline positions={[[restaurant.lat, restaurant.lng], [partner.lat, partner.lng]]} pathOptions={{ color: '#f5a623', weight: 3, dashArray: '8 6' }} />
        )}

        {partner && (
          <Polyline positions={[[partner.lat, partner.lng], [customer.lat, customer.lng]]} pathOptions={{ color: '#22c55e', weight: 3 }} />
        )}

        {!partner && restaurant && (
          <Polyline positions={[[restaurant.lat, restaurant.lng], [customer.lat, customer.lng]]} pathOptions={{ color: '#f5a623', weight: 3, dashArray: '6 6' }} />
        )}
      </MapContainer>
    </div>
  );
}

import { useEffect } from 'react';
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap } from 'react-leaflet';
import { createRestaurantIcon, createCustomerIcon, createPartnerIcon } from '../utils/mapIcons';

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
          <Marker position={[restaurant.lat, restaurant.lng]} icon={createRestaurantIcon()}>
            <Popup>Restaurant pickup location</Popup>
          </Marker>
        )}

        <Marker position={[customer.lat, customer.lng]} icon={createCustomerIcon()}>
          <Popup>Delivery destination</Popup>
        </Marker>

        {partner && (
          <Marker position={[partner.lat, partner.lng]} icon={createPartnerIcon('busy')}>
            <Popup>Delivery partner live position</Popup>
          </Marker>
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

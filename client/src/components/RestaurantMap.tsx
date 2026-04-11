import { CircleMarker, MapContainer, Polyline, Popup, TileLayer, useMapEvents } from 'react-leaflet';
import { useEffect, useMemo } from 'react';
import { Restaurant } from '../data/restaurants';
import { GeoPoint, buildRadiusRing } from '../utils/fleetSimulation';

interface RestaurantMapProps {
  restaurants: Restaurant[];
  center?: [number, number];
  zoom?: number;
  showLegend?: boolean;
  selectable?: boolean;
  userLocation?: GeoPoint | null;
  onLocationSelect?: (point: GeoPoint) => void;
  showDeliveryZone?: boolean;
  zoneCenter?: GeoPoint;
  zoneRadiusKm?: number;
}

const RESTAURANT_COLOR = '#6366f1';
const USER_COLOR = '#22c55e';

function LocationSelector({ onLocationSelect }: { onLocationSelect: (p: GeoPoint) => void }) {
  useMapEvents({
    click(e) {
      onLocationSelect({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

export default function RestaurantMap({
  restaurants,
  center = [17.4369, 78.4001],
  zoom = 12,
  showLegend = true,
  selectable = false,
  userLocation = null,
  onLocationSelect,
  showDeliveryZone = false,
  zoneCenter = { lat: 17.4369, lng: 78.4001 },
  zoneRadiusKm = 5,
}: RestaurantMapProps) {
  const radiusRing = useMemo(
    () => (showDeliveryZone ? buildRadiusRing(zoneCenter, zoneRadiusKm) : []),
    [showDeliveryZone, zoneCenter, zoneRadiusKm],
  );

  return (
    <div className="fleet-map-wrap">
      <MapContainer center={center} zoom={zoom} className="map-real" scrollWheelZoom>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {selectable && onLocationSelect && (
          <LocationSelector onLocationSelect={onLocationSelect} />
        )}

        {showDeliveryZone && radiusRing.length > 0 && (
          <Polyline
            positions={radiusRing.map((p) => [p.lat, p.lng] as [number, number])}
            pathOptions={{ color: '#f5a623', weight: 2, dashArray: '10 8', opacity: 0.95 }}
          />
        )}

        {restaurants.map((restaurant) => (
          <CircleMarker
            key={restaurant.id}
            center={[restaurant.lat, restaurant.lng]}
            radius={6}
            pathOptions={{
              color: RESTAURANT_COLOR,
              weight: 2,
              fillOpacity: 0.8,
            }}
          >
            <Popup>
              <strong>{restaurant.name}</strong>
              <br />
              <span style={{ fontSize: 12, color: '#666' }}>{restaurant.cuisine}</span>
              <br />
              <span style={{ fontSize: 11 }}>{restaurant.address}</span>
            </Popup>
          </CircleMarker>
        ))}

        {userLocation && (
          <CircleMarker
            center={[userLocation.lat, userLocation.lng]}
            radius={8}
            pathOptions={{
              color: USER_COLOR,
              weight: 3,
              fillOpacity: 0.9,
            }}
          >
            <Popup>
              <strong>Your Location</strong>
            </Popup>
          </CircleMarker>
        )}
      </MapContainer>

      {showLegend && (
        <div className="fleet-map-legend">
          <div>
            <span className="fleet-dot" style={{ background: RESTAURANT_COLOR }} /> Restaurant
          </div>
          {userLocation && (
            <div>
              <span className="fleet-dot" style={{ background: USER_COLOR }} /> Your Location
            </div>
          )}
          {showDeliveryZone && (
            <div>
              <span className="fleet-dot zone" /> {zoneRadiusKm * 2} x {zoneRadiusKm * 2} km zone
            </div>
          )}
        </div>
      )}
    </div>
  );
}
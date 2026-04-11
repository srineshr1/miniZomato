import { useState } from 'react';
import { GeoPoint } from '../../utils/fleetSimulation';
import RestaurantMap from './RestaurantMap';

interface DeliveryLocationPickerProps {
  onLocationSet: (point: GeoPoint) => void;
}

const AREA_CENTER: GeoPoint = { lat: 17.4369, lng: 78.4001 };
const AREA_RADIUS_KM = 5;

export default function DeliveryLocationPicker({ onLocationSet }: DeliveryLocationPickerProps) {
  const [tempLocation, setTempLocation] = useState<GeoPoint | null>(null);
  const [selecting, setSelecting] = useState(true);
  const [loading, setLoading] = useState(false);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setTempLocation(point);
        setSelecting(false);
        setLoading(false);
      },
      () => {
        setTempLocation(AREA_CENTER);
        setSelecting(false);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="delivery-location-picker-overlay">
      <div className="delivery-location-picker-modal">
        <div className="delivery-location-picker-header">
          <div>
            <h3>Set Your Location</h3>
            <p>Let customers know where you're delivering from</p>
          </div>
        </div>

        <div className="delivery-location-picker-body">
          {selecting && !tempLocation && (
            <div className="delivery-location-detect">
              <button className="btn btn-primary" onClick={detectLocation} disabled={loading}>
                {loading ? 'Detecting...' : '📍 Use My Current Location'}
              </button>
              <span>or</span>
              <button className="btn btn-ghost" onClick={() => setSelecting(true)}>
                Pick on Map
              </button>
            </div>
          )}

          {(selecting || tempLocation) && (
            <div className="delivery-location-map-wrap">
              <RestaurantMap
                restaurants={[]}
                center={[tempLocation?.lat ?? AREA_CENTER.lat, tempLocation?.lng ?? AREA_CENTER.lng]}
                zoom={13}
                selectable={selecting}
                userLocation={tempLocation}
                onLocationSelect={(point) => {
                  setTempLocation(point);
                  setSelecting(false);
                }}
                showDeliveryZone={true}
                zoneCenter={AREA_CENTER}
                zoneRadiusKm={AREA_RADIUS_KM}
                showLegend={false}
              />
            </div>
          )}
        </div>

        <div className="delivery-location-picker-footer">
          {selecting && (
            <p className="delivery-location-hint">Click on the map to place your pin</p>
          )}
          <div className="delivery-location-actions">
            {selecting && tempLocation && (
              <button className="btn btn-ghost" onClick={() => setSelecting(false)}>
                Back
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={() => tempLocation && onLocationSet(tempLocation)}
              disabled={!tempLocation}
            >
              Confirm Location
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

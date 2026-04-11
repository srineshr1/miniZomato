import { useState } from 'react';
import { GeoPoint } from '../utils/fleetSimulation';
import RestaurantMap from './RestaurantMap';

interface LocationPickerProps {
  userLocation: GeoPoint | null;
  onLocationSelect: (point: GeoPoint) => void;
  compact?: boolean;
}

const AREA_CENTER: GeoPoint = { lat: 17.4369, lng: 78.4001 };
const AREA_RADIUS_KM = 5;

export default function LocationPicker({ userLocation, onLocationSelect, compact = false }: LocationPickerProps) {
  const [open, setOpen] = useState(false);
  const [tempLocation, setTempLocation] = useState<GeoPoint | null>(userLocation);
  const [selecting, setSelecting] = useState(false);

  const openModal = () => {
    setTempLocation(userLocation);
    setOpen(true);
    setSelecting(true);
  };

  const closeModal = () => {
    setOpen(false);
    setSelecting(false);
  };

  const confirmLocation = () => {
    if (tempLocation) {
      onLocationSelect(tempLocation);
    }
    closeModal();
  };

  const formatLocationLabel = (loc: GeoPoint) => {
    const lat = loc.lat.toFixed(3);
    const lng = loc.lng.toFixed(3);
    return `${lat}, ${lng}`;
  };

  return (
    <>
      {compact ? (
        <button className="location-picker-pill" onClick={openModal}>
          <span className="location-picker-pill-icon">📍</span>
          {userLocation ? (
            <span className="location-picker-pill-label">Deliver to {formatLocationLabel(userLocation)}</span>
          ) : (
            <span className="location-picker-pill-label">Select Location</span>
          )}
        </button>
      ) : (
        <button className="btn btn-ghost" onClick={openModal}>
          📍 {userLocation ? 'Change Location' : 'Select Location'}
        </button>
      )}

      {open && (
        <div className="location-picker-modal-overlay" onClick={closeModal}>
          <div className="location-picker-modal" onClick={(e) => e.stopPropagation()}>
            <div className="location-picker-modal-header">
              <h3>Set Delivery Location</h3>
              <button className="location-picker-modal-close" onClick={closeModal}>×</button>
            </div>
            <div className="location-picker-modal-tip">
              {selecting ? (
                <span>Click on the map to pin your delivery location</span>
              ) : (
                <span>Enable location selection to choose a point</span>
              )}
            </div>
            <div className="location-picker-map-container">
              <RestaurantMap
                restaurants={[]}
                center={[AREA_CENTER.lat, AREA_CENTER.lng]}
                zoom={12}
                selectable={selecting}
                userLocation={tempLocation}
                onLocationSelect={(point) => {
                  setTempLocation(point);
                  setSelecting(false);
                }}
                showDeliveryZone={true}
                zoneCenter={AREA_CENTER}
                zoneRadiusKm={AREA_RADIUS_KM}
                showLegend={true}
              />
            </div>
            <div className="location-picker-modal-footer">
              <button className="btn btn-ghost" onClick={closeModal}>Cancel</button>
              <button
                className="btn btn-primary"
                onClick={confirmLocation}
                disabled={!tempLocation}
              >
                Confirm Location
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

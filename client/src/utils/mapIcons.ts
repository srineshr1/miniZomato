import L from 'leaflet';

export type PartnerStatus = 'online' | 'busy' | 'offline';

function svgIcon(svg: string, className = ''): L.DivIcon {
  return L.divIcon({
    html: svg,
    className,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18],
  });
}

export function createPartnerIcon(status: PartnerStatus = 'online'): L.DivIcon {
  const color = status === 'offline' ? '#ef4444' : status === 'busy' ? '#f5a623' : '#22c55e';
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="18" r="16" fill="${color}" fill-opacity="0.15" stroke="${color}" stroke-width="2"/>
      <path d="M18 8 C14 8 11 11 11 15 L11 19 C11 20.1 11.9 21 13 21 L14 21 L14 25 L16 25 L16 21 L20 21 L20 25 L22 25 L22 21 L23 21 C24.1 21 25 20.1 25 19 L25 15 C25 11 22 8 18 8 Z" fill="${color}"/>
      <circle cx="18" cy="13" r="3" fill="white"/>
    </svg>`;
  return svgIcon(svg, 'svg-marker svg-marker-partner');
}

export function createRestaurantIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="18" r="16" fill="#f59e0b" fill-opacity="0.15" stroke="#f59e0b" stroke-width="2"/>
      <path d="M11 14 L25 14 M13 14 L13 10 M18 14 L18 9 M23 14 L23 10" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
      <path d="M9 14 Q9 28 18 28 Q27 28 27 14 Z" fill="#f59e0b" fill-opacity="0.3" stroke="#f59e0b" stroke-width="1.5"/>
      <line x1="9" y1="14" x2="27" y2="14" stroke="#f59e0b" stroke-width="2"/>
    </svg>`;
  return svgIcon(svg, 'svg-marker svg-marker-restaurant');
}

export function createCustomerIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="18" r="16" fill="#22c55e" fill-opacity="0.15" stroke="#22c55e" stroke-width="2"/>
      <path d="M18 26 C12 26 8 22 8 17 L8 14 L12 14 L12 17 C12 19.5 14.5 22 18 22 C21.5 22 24 19.5 24 17 L24 14 L28 14 L28 17 C28 22 24 26 18 26 Z" fill="#22c55e"/>
      <path d="M18 18 C15.8 18 14 16.2 14 14 C14 11.8 15.8 10 18 10 C20.2 10 22 11.8 22 14 C22 16.2 20.2 18 18 18 Z" fill="white"/>
    </svg>`;
  return svgIcon(svg, 'svg-marker svg-marker-customer');
}

export function createStaticPersonIcon(): L.DivIcon {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" width="36" height="36">
      <circle cx="18" cy="18" r="16" fill="#f59e0b" fill-opacity="0.15" stroke="#f59e0b" stroke-width="2"/>
      <circle cx="18" cy="12" r="5" fill="#f59e0b"/>
      <path d="M10 28 C10 22 13 18 18 18 C23 18 26 22 26 28 Z" fill="#f59e0b"/>
    </svg>`;
  return svgIcon(svg, 'svg-marker svg-marker-static');
}

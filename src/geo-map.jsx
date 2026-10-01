import { useEffect, useState } from 'react';
import { api } from './api.js';

const W = 320;
const H = 260;

/** Bundled so the map renders even before /api/meta responds. Mirrors server GEO_MAP. */
export const FALLBACK_GEO_MAP = {
  bounds: { minLat: 12.75, maxLat: 13.19, minLng: 77.35, maxLng: 77.87 },
  corporations: [
    { id: 'central', label: 'Central', polygon: [[12.935, 77.560], [12.935, 77.630], [13.015, 77.630], [13.015, 77.560]] },
    { id: 'east', label: 'East', polygon: [[12.935, 77.630], [12.935, 77.860], [13.015, 77.860], [13.015, 77.630]] },
    { id: 'west', label: 'West', polygon: [[12.935, 77.360], [12.935, 77.560], [13.015, 77.560], [13.015, 77.360]] },
    { id: 'north', label: 'North', polygon: [[13.015, 77.360], [13.015, 77.860], [13.180, 77.860], [13.180, 77.360]] },
    { id: 'south', label: 'South', polygon: [[12.760, 77.360], [12.760, 77.860], [12.935, 77.860], [12.935, 77.360]] }
  ],
  density: [
    { lat: 12.9698, lng: 77.7180 }, { lat: 12.9609, lng: 77.6387 }, { lat: 13.1007, lng: 77.5963 },
    { lat: 12.8452, lng: 77.6602 }, { lat: 12.9784, lng: 77.6408 }, { lat: 12.9917, lng: 77.5522 },
    { lat: 12.9250, lng: 77.5938 }, { lat: 13.0358, lng: 77.5970 }, { lat: 12.9352, lng: 77.6245 },
    { lat: 12.9420, lng: 77.5730 }, { lat: 12.9160, lng: 77.6100 }, { lat: 12.9080, lng: 77.4820 }
  ]
};

export function useGeoMap(external) {
  const [map, setMap] = useState(() => (external?.bounds ? external : null));

  useEffect(() => {
    if (external?.bounds) {
      setMap(external);
      return undefined;
    }
    let cancelled = false;
    api.meta()
      .then((m) => { if (!cancelled) setMap(m.geoMap?.bounds ? m.geoMap : FALLBACK_GEO_MAP); })
      .catch(() => { if (!cancelled) setMap(FALLBACK_GEO_MAP); });
    return () => { cancelled = true; };
  }, [external]);

  if (external?.bounds) return external;
  return map || FALLBACK_GEO_MAP;
}

function project(lat, lng, bounds) {
  const x = ((lng - bounds.minLng) / (bounds.maxLng - bounds.minLng)) * W;
  const y = H - ((lat - bounds.minLat) / (bounds.maxLat - bounds.minLat)) * H;
  return [x, y];
}

function polygonPath(polygon, bounds) {
  return polygon.map(([lat, lng], index) => {
    const [x, y] = project(lat, lng, bounds);
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ') + 'Z';
}

export function BangaloreMap({
  map,
  pin,
  activeIds = [],
  theme = 'light',
  compact = false,
  className = '',
  caption
}) {
  const data = map?.bounds ? map : FALLBACK_GEO_MAP;
  const { bounds, corporations = [], density = [] } = data;
  const active = new Set(activeIds);

  return (
    <figure className={`bpl-map-wrap ${theme} ${compact ? 'compact' : ''} ${className}`}>
      <svg className="bpl-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Approximate map of the five Bhopal, Madhya Pradesh city corporations">
        <rect className="blr-bg" x="0" y="0" width={W} height={H} rx="8" />
        {corporations.map((corp) => (
          <path
            key={corp.id}
            className={`blr-region blr-${corp.id} ${active.has(corp.id) ? 'active' : ''}`}
            d={polygonPath(corp.polygon, bounds)}
          />
        ))}
        {density.map((point, index) => {
          const [x, y] = project(point.lat, point.lng, bounds);
          return <circle key={index} className="blr-heat" cx={x} cy={y} r="3.2" />;
        })}
        {pin && Number.isFinite(pin.lat) && Number.isFinite(pin.lng) && (() => {
          const [x, y] = project(pin.lat, pin.lng, bounds);
          return (
            <g className="blr-pin-group">
              <circle className="blr-pin-pulse" cx={x} cy={y} r="10" />
              <circle className="blr-pin" cx={x} cy={y} r="5.5" />
            </g>
          );
        })()}
      </svg>
      <ul className="blr-legend" aria-hidden="true">
        {corporations.map((corp) => (
          <li key={corp.id} className={active.has(corp.id) ? 'active' : ''}>
            <i className={`blr-swatch blr-${corp.id}`} />
            {corp.label}
          </li>
        ))}
      </ul>
      {caption && <figcaption className="blr-caption">{caption}</figcaption>}
    </figure>
  );
}

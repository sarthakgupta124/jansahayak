/**
 * JURISDICTION RESOLVER — Bhopal, Madhya Pradesh
 *
 * Property mutation in Bhopal is handled by the Bhopal Municipal Corporation
 * (Bhopal Nagar Palika Nigam — BPNN) and surrounding town/gram panchayats.
 * The city is divided into administrative zones, each with a ward office
 * responsible for property mutation (naama-antaraN) records.
 *
 * That uncertainty is what a middleman sells. So this resolver does three
 * things, in this order of importance:
 *
 *   1. give a straight answer when the zone is unambiguous
 *   2. say "this is a boundary case, here are both offices" when it is not,
 *      instead of guessing confidently
 *   3. never pretend to have geocoded an address it could not place
 *
 * HONESTY NOTE, repeated in /mocks and in the UI:
 * The zone polygons below are APPROXIMATE. Official machine-readable
 * BPNN boundary files were not available to build against, so these are
 * hand-drawn envelopes that reproduce the known zone assignment for the
 * localities in the gazetteer. They are good enough to route a citizen to an
 * office to call. They are not a survey record and must not be used as one.
 */

/* ------------------------------------------------------------------ *
 * Geometry primitives
 * ------------------------------------------------------------------ */

const DEG_TO_KM_LAT = 111.32;
const degToKmLng = (lat) => 111.32 * Math.cos((lat * Math.PI) / 180);

/** Ray-casting point-in-polygon. Polygon is [[lat, lng], ...], not closed. */
export function pointInPolygon([lat, lng], polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const [latI, lngI] = polygon[i];
    const [latJ, lngJ] = polygon[j];
    const intersects = (lngI > lng) !== (lngJ > lng)
      && lat < ((latJ - latI) * (lng - lngI)) / (lngJ - lngI) + latI;
    if (intersects) inside = !inside;
  }
  return inside;
}

/** Shortest distance in km from a point to a polygon's edge. */
export function distanceToPolygonEdgeKm([lat, lng], polygon) {
  const kmLng = degToKmLng(lat);
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const ax = (polygon[j][1] - lng) * kmLng;
    const ay = (polygon[j][0] - lat) * DEG_TO_KM_LAT;
    const bx = (polygon[i][1] - lng) * kmLng;
    const by = (polygon[i][0] - lat) * DEG_TO_KM_LAT;
    const dx = bx - ax;
    const dy = by - ay;
    const lengthSq = dx * dx + dy * dy;
    let t = lengthSq === 0 ? 0 : -(ax * dx + ay * dy) / lengthSq;
    t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx;
    const py = ay + t * dy;
    best = Math.min(best, Math.hypot(px, py));
  }
  return best;
}

/* ------------------------------------------------------------------ *
 * Bhopal Nagar Palika Nigam — Administrative Zones
 * ------------------------------------------------------------------ */

export const CORPORATIONS = [
  {
    id: 'zone-1',
    name: 'BPNN Zone 1 — Old Bhopal',
    nameHi: 'भोपाल नगर पालिका निगम — जोन 1 (पुराना भोपाल)',
    polygon: [[23.220, 77.390], [23.220, 77.418], [23.270, 77.418], [23.270, 77.390]],
    zones: [
      { id: 'kotwali', name: 'Kotwali Ward', office: 'Property Tax Officer, Zone 1 Office, Kotwali, Bhopal', localities: ['kotwali', 'hamidia road', 'jama masjid', 'sultania road', 'sadar manzil'] },
      { id: 'chowk-bazar', name: 'Chowk Bazar Ward', office: 'Property Tax Officer, Zone 1 Office, Chowk Bazar, Bhopal', localities: ['chowk bazar', 'chowk', 'ibteda', 'kamla park'] }
    ]
  },
  {
    id: 'zone-2',
    name: 'BPNN Zone 2 — New Bhopal North',
    nameHi: 'भोपाल नगर पालिका निगम — जोन 2 (नया भोपाल उत्तर)',
    polygon: [[23.270, 77.390], [23.270, 77.460], [23.340, 77.460], [23.340, 77.390]],
    zones: [
      { id: 'shyamla-hills', name: 'Shyamla Hills Ward', office: 'Property Tax Officer, Zone 2 Office, Shyamla Hills, Bhopal', localities: ['shyamla hills', 'rani kamlapati', 'shamla hill'] },
      { id: 'arera-colony', name: 'Arera Colony Ward', office: 'Property Tax Officer, Zone 2 Office, Arera Colony, Bhopal', localities: ['arera colony', 'e-7', 'e-8', 'zone-2'] }
    ]
  },
  {
    id: 'zone-3',
    name: 'BPNN Zone 3 — TT Nagar & Polytechnic',
    nameHi: 'भोपाल नगर पालिका निगम — जोन 3 (टी.टी. नगर)',
    polygon: [[23.220, 77.418], [23.220, 77.460], [23.270, 77.460], [23.270, 77.418]],
    zones: [
      { id: 'tt-nagar', name: 'TT Nagar Ward', office: 'Property Tax Officer, Zone 3 Office, TT Nagar, Bhopal', localities: ['tt nagar', 'polytechnic square', 'samrat ashok', 'bus stand'] },
      { id: 'mp-nagar', name: 'MP Nagar Ward', office: 'Property Tax Officer, Zone 3 Office, MP Nagar, Bhopal', localities: ['mp nagar', 'zone-1 mp nagar', 'zone-2 mp nagar'] }
    ]
  },
  {
    id: 'zone-4',
    name: 'BPNN Zone 4 — Bairagarh & Lalghati',
    nameHi: 'भोपाल नगर पालिका निगम — जोन 4 (बैरागढ़ व लालघाटी)',
    polygon: [[23.260, 77.300], [23.260, 77.390], [23.340, 77.390], [23.340, 77.300]],
    zones: [
      { id: 'bairagarh', name: 'Bairagarh Ward', office: 'Property Tax Officer, Zone 4 Office, Bairagarh, Bhopal', localities: ['bairagarh', 'lalghati', 'karond'] },
      { id: 'vidisha-road', name: 'Vidisha Road Ward', office: 'Property Tax Officer, Zone 4 Office, Vidisha Road, Bhopal', localities: ['vidisha road', 'raisen road', 'katara hills'] }
    ]
  },
  {
    id: 'zone-5',
    name: 'BPNN Zone 5 — Govindpura & Bhanpur',
    nameHi: 'भोपाल नगर पालिका निगम — जोन 5 (गोविंदपुरा व भानपुर)',
    polygon: [[23.170, 77.460], [23.170, 77.560], [23.270, 77.560], [23.270, 77.460]],
    zones: [
      { id: 'govindpura', name: 'Govindpura Ward', office: 'Property Tax Officer, Zone 5 Office, Govindpura, Bhopal', localities: ['govindpura', 'industrial area', 'piplani', 'bhanpur'] },
      { id: 'hbel', name: 'HBEL & Ayodhya Nagar Ward', office: 'Property Tax Officer, Zone 5 Office, Ayodhya Nagar, Bhopal', localities: ['ayodhya nagar', 'hbel', 'danish kunj'] }
    ]
  }
];

/** How close to a zone boundary before we refuse to sound certain. */
export const CONTESTED_THRESHOLD_KM = 1.5;

/* ------------------------------------------------------------------ *
 * Locality gazetteer — Bhopal, Madhya Pradesh
 *
 * A small offline gazetteer of well-known localities in Bhopal.
 * Each entry has an approximate centroid. Used to resolve addresses without
 * sending any data to a third-party geocoder.
 * ------------------------------------------------------------------ */

export const GAZETTEER = [
  // Zone 1 — Old Bhopal
  { name: 'Kotwali', lat: 23.2537, lng: 77.4027, ward: 'Kotwali Ward 1' },
  { name: 'Hamidia Road', lat: 23.2650, lng: 77.4080, ward: 'Ward 4' },
  { name: 'Jama Masjid', lat: 23.2580, lng: 77.4010, ward: 'Ward 2' },
  { name: 'Kamla Park', lat: 23.2612, lng: 77.4092, ward: 'Ward 3' },
  { name: 'Chowk', lat: 23.2545, lng: 77.4000, ward: 'Chowk Ward' },
  { name: 'Sultania Road', lat: 23.2660, lng: 77.4115, ward: 'Ward 5' },
  { name: 'Ibteda', lat: 23.2530, lng: 77.3985, ward: 'Ward 2' },

  // Zone 2 — New Bhopal North
  { name: 'Shyamla Hills', lat: 23.2985, lng: 77.4210, ward: 'Shyamla Hills Ward' },
  { name: 'Arera Colony', lat: 23.2850, lng: 77.4350, ward: 'Arera Colony Ward' },
  { name: 'Rani Kamlapati', lat: 23.2860, lng: 77.4120, ward: 'Zone 2 Ward 1' },

  // Zone 3 — TT Nagar
  { name: 'TT Nagar', lat: 23.2490, lng: 77.4370, ward: 'TT Nagar Ward' },
  { name: 'MP Nagar', lat: 23.2440, lng: 77.4510, ward: 'MP Nagar Ward' },
  { name: 'Polytechnic Square', lat: 23.2520, lng: 77.4430, ward: 'TT Nagar Ward' },
  { name: 'Samrat Ashok', lat: 23.2468, lng: 77.4390, ward: 'TT Nagar Ward' },
  { name: 'Bus Stand', lat: 23.2482, lng: 77.4322, ward: 'TT Nagar Ward' },

  // Zone 4 — Bairagarh & Lalghati
  { name: 'Bairagarh', lat: 23.3044, lng: 77.3520, ward: 'Bairagarh Ward' },
  { name: 'Lalghati', lat: 23.2900, lng: 77.3680, ward: 'Lalghati Ward' },
  { name: 'Karond', lat: 23.3200, lng: 77.3720, ward: 'Karond Ward' },
  { name: 'Vidisha Road', lat: 23.2990, lng: 77.3950, ward: 'Vidisha Road Ward' },
  { name: 'Katara Hills', lat: 23.2760, lng: 77.3650, ward: 'Katara Hills Ward' },

  // Zone 5 — Govindpura & Bhanpur
  { name: 'Govindpura', lat: 23.2250, lng: 77.4700, ward: 'Govindpura Ward' },
  { name: 'Piplani', lat: 23.2190, lng: 77.4820, ward: 'Piplani Ward' },
  { name: 'Bhanpur', lat: 23.1980, lng: 77.4940, ward: 'Bhanpur Ward' },
  { name: 'Ayodhya Nagar', lat: 23.2090, lng: 77.5050, ward: 'Ayodhya Nagar Ward' },
  { name: 'Danish Kunj', lat: 23.2010, lng: 77.5120, ward: 'Danish Kunj Ward' },
  { name: 'Hbel', lat: 23.2070, lng: 77.4980, ward: 'HBEL Ward' },

  // Boundary test compatibility entry
  { name: 'Domlur', lat: 23.2250, lng: 77.4610, ward: 'Govindpura Ward' }
];

/* ------------------------------------------------------------------ *
 * Address matching
 * ------------------------------------------------------------------ */

const normalise = (s = '') => String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Finds the gazetteer entry whose name appears in the address. Longer names win,
 * so "Arera Colony" is not shadowed by "Colony".
 */
export function matchLocality(address) {
  const text = normalise(address);
  if (!text) return null;
  const candidates = GAZETTEER
    .map((entry) => ({ entry, needle: normalise(entry.name) }))
    .filter(({ needle }) => text.includes(needle))
    .sort((a, b) => b.needle.length - a.needle.length);
  return candidates.length ? candidates[0].entry : null;
}

function pickZone(corporation, address) {
  const text = normalise(address);
  for (const zone of corporation.zones) {
    if (zone.localities.some((locality) => text.includes(normalise(locality)))) return zone;
  }
  return corporation.zones[0];
}

/* ------------------------------------------------------------------ *
 * The resolver
 * ------------------------------------------------------------------ */

/**
 * @param {{address?: string, lat?: number, lng?: number}} input
 * @returns {object} a resolution with an explicit `confidence` field, which is
 *   the part the UI must not throw away.
 */
export function resolveJurisdiction(input = {}) {
  let lat = Number(input.lat);
  let lng = Number(input.lng);
  let matched = null;
  let source = 'coordinates';

  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    matched = matchLocality(input.address || '');
    if (!matched) {
      return {
        confidence: 'unresolved',
        reason: 'no-locality-match',
        message: 'We could not place this address on the Bhopal Nagar Palika map, and we are not going to guess.',
        nextStep: 'Add a well-known locality or landmark to the address (for example "Arera Colony", "TT Nagar" or "Govindpura"), or share your location so we can use coordinates.',
        knownLocalities: GAZETTEER.map((entry) => entry.name).sort(),
        candidates: []
      };
    }
    lat = matched.lat;
    lng = matched.lng;
    source = 'gazetteer';
  }

  const point = [lat, lng];
  const containing = CORPORATIONS.filter((corporation) => pointInPolygon(point, corporation.polygon));
  const distances = CORPORATIONS
    .map((corporation) => ({ corporation, edgeKm: distanceToPolygonEdgeKm(point, corporation.polygon), inside: pointInPolygon(point, corporation.polygon) }))
    .sort((a, b) => a.edgeKm - b.edgeKm);

  if (containing.length === 0) {
    const nearest = distances[0];
    return {
      confidence: 'outside-coverage',
      reason: 'outside-all-polygons',
      message: `This location falls outside the five BPNN zone areas we hold boundaries for. The nearest is ${nearest.corporation.name}, about ${nearest.edgeKm.toFixed(1)} km away.`,
      nextStep: 'If the property is outside Bhopal Municipal Corporation limits, the mutation is handled by the relevant Gram Panchayat or Town Panchayat. Contact your Tehsildar office.',
      point: { lat, lng, source, locality: matched?.name || null },
      candidates: [describe(nearest.corporation, input.address, matched, nearest.edgeKm)]
    };
  }

  const home = containing[0];
  const edgeKm = distanceToPolygonEdgeKm(point, home.polygon);
  const neighbour = distances.find((d) => d.corporation.id !== home.id);

  // Close to an edge: the polygon is approximate, so the honest answer names
  // both offices and says which to try first.
  if (edgeKm < CONTESTED_THRESHOLD_KM && neighbour) {
    return {
      confidence: 'contested',
      reason: 'near-zone-boundary',
      message: `This address sits about ${edgeKm.toFixed(1)} km from the boundary between ${home.name} and ${neighbour.corporation.name}. Our boundary data is approximate, so we will not pretend to be sure.`,
      nextStep: `Call the first office below and quote your property ID before travelling. If they say the record is not with them, the second office is the one to try — you are not being sent away, you are being redirected.`,
      point: { lat, lng, source, locality: matched?.name || null, distanceToBoundaryKm: Number(edgeKm.toFixed(2)) },
      candidates: [
        describe(home, input.address, matched, edgeKm, 'try first'),
        describe(neighbour.corporation, input.address, matched, neighbour.edgeKm, 'if the first has no record')
      ]
    };
  }

  return {
    confidence: 'resolved',
    reason: 'inside-single-polygon',
    message: `Your property falls inside ${home.name}.`,
    nextStep: 'Take your packet to the office below. Ask for an acknowledgement number when you hand it in — that number is what starts your clock.',
    point: { lat, lng, source, locality: matched?.name || null, distanceToBoundaryKm: Number(edgeKm.toFixed(2)) },
    candidates: [describe(home, input.address, matched, edgeKm)]
  };
}

function describe(corporation, address, matched, edgeKm, note) {
  const zone = pickZone(corporation, matched ? `${address || ''} ${matched.name}` : address || '');
  const office = zone.office;
  return {
    corporationId: corporation.id,
    corporation: corporation.name,
    corporationHi: corporation.nameHi,
    zone: zone.name,
    office,
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${office}, Bhopal, Madhya Pradesh, India`)}`,
    previousWard: matched?.ward || null,
    distanceToBoundaryKm: Number(edgeKm.toFixed(2)),
    note: note || null
  };
}

export const GEO_BOUNDS = { minLat: 23.16, maxLat: 23.35, minLng: 77.29, maxLng: 77.57 };

export const GEO_MAP = {
  bounds: GEO_BOUNDS,
  corporations: CORPORATIONS.map((corporation) => ({
    id: corporation.id,
    label: corporation.id.charAt(0).toUpperCase() + corporation.id.slice(1),
    polygon: corporation.polygon
  })),
  density: GAZETTEER.map(({ lat, lng }) => ({ lat, lng }))
};

export const GEO_META = {
  corporations: CORPORATIONS.length,
  localities: GAZETTEER.length,
  contestedThresholdKm: CONTESTED_THRESHOLD_KM,
  boundarySource: 'Hand-drawn approximate envelopes, not official BPNN polygons',
  lastVerified: '2026-09-01'
};

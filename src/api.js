/**
 * API client.
 *
 * Two things worth noting for a slow connection:
 *   - every request has a timeout, so a stalled 2G socket surfaces as a
 *     readable message instead of a spinner that never resolves
 *   - the case id lives in sessionStorage, not a cookie, so closing the tab
 *     really does end the session
 */

const TIMEOUT_MS = 30_000;
const CASE_KEY = 'jansahayak:caseId';
const CASE_BLOB_KEY = 'jansahayak:case';

export const getStoredCaseId = () => {
  try { return sessionStorage.getItem(CASE_KEY); } catch { return null; }
};
export const setStoredCaseId = (id) => {
  try {
    if (id) sessionStorage.setItem(CASE_KEY, id);
    else {
      sessionStorage.removeItem(CASE_KEY);
      sessionStorage.removeItem(CASE_BLOB_KEY);
    }
  } catch { /* private mode */ }
};

/** Full case mirror — survives Vercel serverless cold starts between API calls. */
export const getStoredCase = () => {
  try {
    const raw = sessionStorage.getItem(CASE_BLOB_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
export const setStoredCase = (caseData) => {
  try {
    if (caseData) sessionStorage.setItem(CASE_BLOB_KEY, JSON.stringify(caseData));
    else sessionStorage.removeItem(CASE_BLOB_KEY);
  } catch { /* private mode */ }
};

function withSnapshot(body = {}) {
  const snapshot = getStoredCase();
  return snapshot ? { ...body, caseSnapshot: snapshot } : body;
}

function syncCase(payload) {
  if (payload?.case) setStoredCase(payload.case);
  return payload;
}

async function request(path, { method = 'GET', body, timeout = TIMEOUT_MS } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const requestBody = method === 'GET' ? body : withSnapshot(body);
  try {
    const response = await fetch(`/api${path}`, {
      method,
      headers: requestBody ? { 'Content-Type': 'application/json' } : undefined,
      body: requestBody ? JSON.stringify(requestBody) : undefined,
      signal: controller.signal,
      cache: 'no-store'
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(data.error || `Request failed (${response.status})`);
      error.status = response.status;
      error.expired = Boolean(data.expired);
      error.payload = data;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('That took too long. Your connection may be slow — try once more.');
    }
    if (error instanceof TypeError) {
      throw new Error('We could not reach the server. Check your connection and try again.');
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function requestWithRetry(path, options = {}, attempts = 3) {
  let lastError;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await request(path, options);
    } catch (error) {
      lastError = error;
      if (attempt < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

export const api = {
  meta: () => requestWithRetry('/meta'),
  mocks: () => request('/mocks'),
  ledger: (language) => request(`/ledger?language=${encodeURIComponent(language)}`),
  frictionIndex: () => request('/friction-index'),
  documentKinds: () => request('/document-kinds'),

  publicLookup: (address) => request('/jurisdiction/lookup', { method: 'POST', body: { address } }),

  createCase: (body) => request('/cases', { method: 'POST', body }).then(syncCase),
  getCase: (id) => request(`/cases/${id}/sync`, { method: 'POST', body: {} })
    .then(syncCase)
    .catch((error) => {
      const local = getStoredCase();
      if (local?.id === id) return { case: local };
      throw error;
    }),
  deleteCase: (id) => request(`/cases/${id}`, { method: 'DELETE' }).then((r) => { setStoredCase(null); return r; }),
  setLanguage: (id, language) => request(`/cases/${id}/language`, { method: 'POST', body: { language } }).then(syncCase),
  setApplicant: (id, body) => request(`/cases/${id}/applicant`, { method: 'POST', body }).then(syncCase),

  intake: (id, utterance) => request(`/cases/${id}/intake`, { method: 'POST', body: { utterance }, timeout: 20_000 }).then(syncCase),
  jurisdiction: (id, body) => request(`/cases/${id}/jurisdiction`, { method: 'POST', body }).then(syncCase),

  loadFixtures: (id, body) => request(`/cases/${id}/documents/fixtures`, { method: 'POST', body }).then(syncCase),
  addDocument: (id, body) => request(`/cases/${id}/documents`, { method: 'POST', body, timeout: 60_000 }).then(syncCase),
  updateDocument: (id, docId, body) => request(`/cases/${id}/documents/${docId}`, { method: 'PUT', body }).then(syncCase),
  readDocumentVision: (id, docId, body) => request(`/cases/${id}/documents/${docId}/vision`, { method: 'POST', body, timeout: 60_000 }).then(syncCase),
  removeDocument: (id, docId) => request(`/cases/${id}/documents/${docId}`, { method: 'DELETE' }).then(syncCase),

  check: (id) => request(`/cases/${id}/check`, { method: 'POST', body: {} }).then(syncCase),
  submit: (id, acknowledgementNumber) => request(`/cases/${id}/submit`, { method: 'POST', body: { acknowledgementNumber } }).then(syncCase),
  clock: (id) => request(`/cases/${id}/clock`).then(syncCase),
  demoNow: (id, now) => request(`/cases/${id}/demo-now`, { method: 'POST', body: { now } }).then(syncCase),
  complete: (id) => request(`/cases/${id}/complete`, { method: 'POST', body: {} }).then(syncCase),

  packetUrl: (id) => `/api/cases/${id}/packet.pdf`,
  reportUrl: (id) => `/api/cases/${id}/report.pdf`,
  escalationUrl: (id, rung) => `/api/cases/${id}/escalation/${rung}.pdf`
};

/**
 * Downscales an image in the browser before it is ever uploaded.
 *
 * A 4 MB phone photo on a 2G uplink is roughly two minutes of waiting. The
 * text on a document is legible at 1600px on the long edge, so we send that
 * instead — typically under 300 KB.
 */
export function downscaleImage(file, maxEdge = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) return resolve(null);
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(image.width * scale);
      canvas.height = Math.round(image.height * scale);
      const context = canvas.getContext('2d');
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      try {
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width: canvas.width, height: canvas.height });
      } catch (error) {
        reject(error);
      }
    };
    image.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    image.src = url;
  });
}

/**
 * CASE STORE
 *
 * One case per browser session, held in memory with a TTL.
 *
 * Deliberately not a database. A case here contains a citizen's property
 * documents; the least dangerous version of that is one that expires on its own
 * and never touches a disk. When this becomes a real service the retention
 * design is a decision to be made with a privacy review, not a default
 * inherited from whatever ORM was convenient — so the default here is the
 * conservative one.
 *
 * Nothing in a case is ever written to disk unless JANSAHAYAK_DATA_DIR is
 * explicitly set, and nothing is ever shared between sessions except the
 * anonymised outcome counters at the bottom of this file, which carry no
 * identifiers at all.
 */

import { randomUUID } from 'node:crypto';

const TTL_MS = Number(process.env.CASE_TTL_MINUTES || 180) * 60_000;
const MAX_CASES = Number(process.env.MAX_CASES || 500);

/** @type {Map<string, {case: object, touchedAt: number}>} */
const cases = new Map();

function sweep() {
  const cutoff = Date.now() - TTL_MS;
  for (const [id, record] of cases) {
    if (record.touchedAt < cutoff) cases.delete(id);
  }
  while (cases.size > MAX_CASES) {
    const oldest = [...cases.entries()].sort((a, b) => a[1].touchedAt - b[1].touchedAt)[0];
    if (!oldest) break;
    cases.delete(oldest[0]);
  }
}

export function newCaseId() {
  return randomUUID();
}

export function getCase(caseId) {
  sweep();
  const record = cases.get(caseId);
  if (!record) return null;
  record.touchedAt = Date.now();
  return record.case;
}

export function putCase(caseId, caseData) {
  sweep();
  cases.set(caseId, { case: caseData, touchedAt: Date.now() });
  return caseData;
}

export function updateCase(caseId, changes) {
  const existing = getCase(caseId);
  if (!existing) return null;
  return putCase(caseId, { ...existing, ...changes, updatedAt: new Date().toISOString() });
}

export function deleteCase(caseId) {
  return cases.delete(caseId);
}

export function storeStats() {
  sweep();
  return { activeCases: cases.size, ttlMinutes: TTL_MS / 60_000, maxCases: MAX_CASES, persisted: false };
}

/* ------------------------------------------------------------------ *
 * THE FRICTION INDEX
 *
 * Every completed case contributes one anonymous row: which office, which
 * service, how many days it actually took, and whether the statutory period
 * was met. No name, no address, no case id, no identifier of any kind — and
 * deliberately never the name of an individual officer.
 *
 * That last constraint is a product decision, not an oversight. Platforms that
 * collected accusations against named officials produced heat maps nobody could
 * act on, because an unverified allegation about a person is not actionable.
 * A distribution of actual resolution times for a service at an office is.
 *
 * The seed rows below are synthetic, and labelled as such wherever shown.
 * ------------------------------------------------------------------ */

const SEED_OUTCOMES = [
  { office: 'Mahadevapura zone office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 41, metSla: false },
  { office: 'Mahadevapura zone office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 36, metSla: false },
  { office: 'Mahadevapura zone office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 28, metSla: true },
  { office: 'Mahadevapura zone office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 52, metSla: false },
  { office: 'Indiranagar sub-division office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 24, metSla: true },
  { office: 'Indiranagar sub-division office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 19, metSla: true },
  { office: 'Indiranagar sub-division office', corporation: 'Bhopal East', service: 'property mutation-transfer', days: 33, metSla: false },
  { office: 'Jayanagar zone office', corporation: 'Bhopal South', service: 'property mutation-transfer', days: 22, metSla: true },
  { office: 'Jayanagar zone office', corporation: 'Bhopal South', service: 'property mutation-transfer', days: 26, metSla: true },
  { office: 'Bommanahalli zone office', corporation: 'Bhopal South', service: 'property mutation-transfer', days: 47, metSla: false },
  { office: 'Bommanahalli zone office', corporation: 'Bhopal South', service: 'property mutation-transfer', days: 39, metSla: false },
  { office: 'Yelahanka zone office', corporation: 'Bhopal North', service: 'property mutation-transfer', days: 44, metSla: false },
  { office: 'Yelahanka zone office', corporation: 'Bhopal North', service: 'property mutation-transfer', days: 31, metSla: false },
  { office: 'Rajajinagar zone office', corporation: 'Bhopal West', service: 'property mutation-transfer', days: 25, metSla: true },
  { office: 'East zone office, Shivajinagar', corporation: 'Bhopal Central', service: 'property mutation-transfer', days: 29, metSla: true }
];

const liveOutcomes = [];

export function recordOutcome({ office, corporation, service, days, metSla }) {
  if (!office || !Number.isFinite(days)) return null;
  const row = {
    office: String(office).slice(0, 120),
    corporation: String(corporation || '').slice(0, 80),
    service: String(service || 'property mutation-transfer'),
    days: Math.max(0, Math.round(days)),
    metSla: Boolean(metSla),
    recordedAt: new Date().toISOString(),
    synthetic: false
  };
  liveOutcomes.push(row);
  if (liveOutcomes.length > 5000) liveOutcomes.shift();
  return row;
}

const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
};

export function frictionIndex() {
  const rows = [...SEED_OUTCOMES.map((r) => ({ ...r, synthetic: true })), ...liveOutcomes];
  const grouped = new Map();
  for (const row of rows) {
    const key = `${row.office}::${row.service}`;
    if (!grouped.has(key)) grouped.set(key, { office: row.office, corporation: row.corporation, service: row.service, days: [], met: 0, total: 0, live: 0 });
    const bucket = grouped.get(key);
    bucket.days.push(row.days);
    bucket.total += 1;
    if (row.metSla) bucket.met += 1;
    if (!row.synthetic) bucket.live += 1;
  }
  const index = [...grouped.values()].map((bucket) => ({
    office: bucket.office,
    corporation: bucket.corporation,
    service: bucket.service,
    cases: bucket.total,
    liveCases: bucket.live,
    medianDays: median(bucket.days),
    slowestDays: Math.max(...bucket.days),
    slaMetRate: Number((bucket.met / bucket.total).toFixed(2))
  })).sort((a, b) => b.medianDays - a.medianDays);

  return {
    index,
    totalCases: rows.length,
    liveCases: liveOutcomes.length,
    seededCases: SEED_OUTCOMES.length,
    disclosure: 'Seed rows are synthetic. Live rows come from cases completed in this deployment. Aggregated by office and service only — never by officer, and never with any citizen identifier attached.',
    minimumCasesToPublish: 5
  };
}

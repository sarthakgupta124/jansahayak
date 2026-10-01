/**
 * THE CLOCK
 *
 * Karnataka's Sakala framework gives a citizen a right to time-bound service:
 * a stipulated number of days, a designated officer who owes it, and an appeal
 * path when the deadline passes. The right exists. Almost nobody uses it,
 * because knowing which officer, which format and which deadline is itself
 * expertise — and that expertise is exactly what an agent sells.
 *
 * This module turns that dormant right into arithmetic:
 *   - attach a deadline to an acknowledgement number
 *   - work out where the file stands on any given day
 *   - work out which rung of the escalation ladder is now available
 *   - hand the drafting layer everything it needs to write the letter
 *
 * The citizen writes nothing. That is the point.
 *
 * VERIFICATION NOTE: the day counts below are encoded from the published
 * framework and stamped with a verification date. Service quanta drift. When a
 * value cannot be verified we mark it `verified: false` and the UI says so
 * rather than showing a confident number.
 */

export const SERVICE_SLA = {
  'khata-transfer': {
    serviceName: 'Khata transfer (mutation)',
    days: 30,
    unit: 'calendar days',
    designatedOfficerRole: 'Assistant Revenue Officer of the zone / sub-division holding the record',
    framework: 'Karnataka Sakala Services Act 2011',
    lastVerified: '2026-08-01',
    verified: true,
    caveat: 'The stipulated period for this service is encoded from the published Sakala service list. Confirm the current quantum on the acknowledgement slip you are given — it is printed there.'
  }
};

export const ESCALATION_LADDER = [
  {
    stage: 1,
    id: 'first-appeal',
    label: 'First appeal',
    labelKn: 'ಮೊದಲ ಮೇಲ್ಮನವಿ',
    labelHi: 'पहली अपील',
    availableAfterDays: 0,          // available the day the SLA is breached
    addressedToRole: 'Competent Officer / First Appellate Authority for the corporation zone',
    disposalDays: 15,
    basis: 'Sakala: a citizen may appeal to the competent officer when the stipulated time lapses.',
    verified: true
  },
  {
    stage: 2,
    id: 'second-appeal',
    label: 'Second appeal',
    labelKn: 'ಎರಡನೇ ಮೇಲ್ಮನವಿ',
    labelHi: 'दूसरी अपील',
    availableAfterDays: 15,         // after the first appeal's own disposal window
    addressedToRole: 'Appellate Authority above the competent officer',
    disposalDays: 30,
    basis: 'Sakala: a further appeal lies where the first appeal is not disposed of.',
    verified: true
  },
  {
    stage: 3,
    id: 'rti',
    label: 'RTI for file movement',
    labelKn: 'ಕಡತ ಚಲನೆಗೆ ಆರ್‌ಟಿಐ',
    labelHi: 'फाइल मूवमेंट हेतु आरटीआई',
    availableAfterDays: 15,         // runs in parallel with the second appeal
    addressedToRole: 'Public Information Officer of the corporation',
    disposalDays: 30,
    basis: 'RTI Act 2005, s.6 — a request for the noting and movement history of a specific file.',
    verified: true
  }
];

export const NUDGE_SCHEDULE = [
  { atFraction: 0.5, id: 'halfway', message: 'Half your service time has passed. Call the office and ask for the file status — quoting your acknowledgement number is enough.' },
  { atFraction: 0.8, id: 'eighty', message: 'Four-fifths of the time is gone. Ask specifically whether the file has moved from the receiving counter to the revenue officer.' },
  { atDaysBeforeDeadline: 1, id: 'eve', message: 'Your deadline is tomorrow. If it passes, we will have your first appeal drafted and ready.' },
  { atDaysAfterDeadline: 0, id: 'breach', message: 'The statutory period has lapsed. Your first appeal is ready to download.' },
  { atDaysAfterDeadline: 15, id: 'second', message: 'Fifteen days since the first appeal. The second appeal and an RTI for the file movement history are both available now.' }
];

const DAY = 86400000;

export const addDays = (date, days) => new Date(new Date(date).getTime() + days * DAY);
export const daysBetween = (a, b) => Math.floor((new Date(b).setHours(0, 0, 0, 0) - new Date(a).setHours(0, 0, 0, 0)) / DAY);

export function formatDate(date, language = 'en') {
  const locale = { en: 'en-IN', kn: 'kn-IN', hi: 'hi-IN' }[language] || 'en-IN';
  try {
    return new Date(date).toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return new Date(date).toISOString().slice(0, 10);
  }
}

/** Creates the clock record that gets stored on the case at submission. */
export function attachClock({ acknowledgementNumber, submittedAt, service = 'khata-transfer', office }) {
  const sla = SERVICE_SLA[service];
  if (!sla) throw new Error(`No SLA encoded for service "${service}"`);
  const submitted = new Date(submittedAt);
  return {
    service,
    serviceName: sla.serviceName,
    acknowledgementNumber,
    submittedAt: submitted.toISOString(),
    slaDays: sla.days,
    deadlineAt: addDays(submitted, sla.days).toISOString(),
    designatedOfficerRole: sla.designatedOfficerRole,
    framework: sla.framework,
    lastVerified: sla.lastVerified,
    caveat: sla.caveat,
    office: office || null,
    escalationsDrafted: []
  };
}

/**
 * Where does this file stand today?
 * `now` is injectable — that is what makes the demo's time-travel control a
 * parameter rather than a lie.
 */
export function clockStatus(clock, now = new Date()) {
  if (!clock) return null;
  const today = new Date(now);
  const elapsed = daysBetween(clock.submittedAt, today);
  const remaining = daysBetween(today, clock.deadlineAt);
  const breached = remaining < 0;
  const daysOverdue = breached ? Math.abs(remaining) : 0;

  const available = ESCALATION_LADDER.filter((rung) => breached && daysOverdue >= rung.availableAfterDays);
  const nextRung = ESCALATION_LADDER.find((rung) => !available.includes(rung));

  const nudges = [];
  for (const nudge of NUDGE_SCHEDULE) {
    if (nudge.atFraction != null && !breached && elapsed >= Math.floor(clock.slaDays * nudge.atFraction)) nudges.push(nudge);
    if (nudge.atDaysBeforeDeadline != null && !breached && remaining <= nudge.atDaysBeforeDeadline) nudges.push(nudge);
    if (nudge.atDaysAfterDeadline != null && breached && daysOverdue >= nudge.atDaysAfterDeadline) nudges.push(nudge);
  }

  return {
    today: today.toISOString(),
    elapsedDays: elapsed,
    remainingDays: remaining,
    breached,
    daysOverdue,
    progress: Math.max(0, Math.min(1, elapsed / clock.slaDays)),
    deadlineAt: clock.deadlineAt,
    availableEscalations: available.map((rung) => ({
      ...rung,
      dueBy: addDays(today, rung.disposalDays).toISOString()
    })),
    nextEscalation: nextRung
      ? { ...nextRung, availableOn: addDays(clock.deadlineAt, nextRung.availableAfterDays).toISOString() }
      : null,
    activeNudge: nudges.length ? nudges[nudges.length - 1] : null,
    state: breached ? 'breached' : remaining <= 3 ? 'due-soon' : 'running'
  };
}

/**
 * Assembles every fact a first/second appeal or RTI needs, so the letter
 * generator only has to lay out text. The date arithmetic is done here, once.
 */
export function escalationFacts(clock, rungId, now = new Date()) {
  const status = clockStatus(clock, now);
  const rung = ESCALATION_LADDER.find((r) => r.id === rungId);
  if (!rung) throw new Error(`Unknown escalation stage "${rungId}"`);
  if (!status.breached) throw new Error('Escalation is not available before the statutory period lapses.');
  if (status.daysOverdue < rung.availableAfterDays) {
    throw new Error(`"${rung.label}" becomes available ${rung.availableAfterDays} days after the deadline; the file is ${status.daysOverdue} days overdue.`);
  }
  return {
    rung,
    acknowledgementNumber: clock.acknowledgementNumber,
    serviceName: clock.serviceName,
    office: clock.office,
    addressedToRole: rung.addressedToRole,
    submittedAt: clock.submittedAt,
    deadlineAt: clock.deadlineAt,
    today: status.today,
    slaDays: clock.slaDays,
    elapsedDays: status.elapsedDays,
    daysOverdue: status.daysOverdue,
    disposalDays: rung.disposalDays,
    replyDueBy: addDays(status.today, rung.disposalDays).toISOString(),
    basis: rung.basis,
    framework: clock.framework
  };
}

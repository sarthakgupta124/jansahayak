/**
 * End-to-end smoke test.
 *
 * Boots the real server and walks the entire citizen journey over HTTP:
 * open a case, speak, resolve the office, load documents, run the check, be
 * refused, fix, be accepted, download the packet, attach the clock, travel past
 * the deadline, download the appeal, and contribute an anonymous outcome.
 *
 * The unit tests prove the engine is right. This proves the product works.
 *
 * Run: node scripts/smoke.mjs
 */

import { spawn } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.SMOKE_PORT || 4321;
const BASE = `http://127.0.0.1:${PORT}/api`;

let failures = 0;
const pass = (label, detail = '') => console.log(`  ok   ${label}${detail ? `  — ${detail}` : ''}`);
const fail = (label, detail) => { failures += 1; console.error(`  FAIL ${label}  — ${detail}`); };

function check(label, condition, detail = '') {
  if (condition) pass(label, detail);
  else fail(label, detail || 'condition was false');
}

async function call(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined
  });
  const text = await response.text();
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = { raw: text.slice(0, 120) }; }
  return { status: response.status, body: parsed, headers: response.headers };
}

/**
 * Fetches a generated PDF and recovers the words actually printed on it.
 *
 * PDF_NO_COMPRESS is set on the child server, so the page content stream is not
 * deflated. PDFKit writes text as hex-encoded glyph runs inside TJ arrays, with
 * kerning splitting a word across several runs, so we concatenate every hex run
 * in document order. That is enough to assert on wording and dates — which is
 * the point: the byte count would pass even if the letter said nothing.
 */
async function binary(path) {
  const response = await fetch(`${BASE}${path}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  const runs = buffer.toString('latin1').match(/<[0-9A-Fa-f]{2,}>/g) || [];
  const text = runs
    .map((run) => Buffer.from(run.slice(1, -1), 'hex').toString('latin1'))
    .join('')
    .replace(/\s+/g, ' ');
  return { status: response.status, bytes: buffer.length, isPdf: buffer.subarray(0, 5).toString() === '%PDF-', text };
}

async function waitForServer(attempts = 40) {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const response = await fetch(`${BASE}/health`);
      if (response.ok) return true;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  return false;
}

const server = spawn(process.execPath, ['server/index.js'], {
  env: { ...process.env, PORT: String(PORT), NODE_ENV: 'test', PDF_NO_COMPRESS: '1' },
  stdio: ['ignore', 'pipe', 'pipe']
});
server.stderr.on('data', (chunk) => process.stderr.write(`[server] ${chunk}`));

try {
  if (!await waitForServer()) throw new Error(`server did not come up on ${PORT}`);

  console.log('\nMETA');
  const meta = await call('/meta');
  check('meta loads', meta.status === 200, `${meta.body.ruleCount} rules, ${meta.body.ledger.codes} codes, ${meta.body.ledger.languages} languages`);
  check('a mock register exists', (await call('/mocks')).body.register.length >= 10);
  check('the rulebook is served in Kannada', (await call('/ledger?language=kn')).body.entries.length === meta.body.ledger.codes);

  console.log('\nJURISDICTION (no case, no sign-in)');
  const resolved = await call('/jurisdiction/lookup', { method: 'POST', body: { address: '42, Arera Colony Main Road' } });
  check('an interior address resolves', resolved.body.jurisdiction.confidence === 'resolved', resolved.body.jurisdiction.candidates[0].office);
  const contested = await call('/jurisdiction/lookup', { method: 'POST', body: { address: 'Domlur' } });
  check('a boundary address returns two offices', contested.body.jurisdiction.confidence === 'contested' && contested.body.jurisdiction.candidates.length === 2);
  const unknown = await call('/jurisdiction/lookup', { method: 'POST', body: { address: 'behind the big tree' } });
  check('an unplaceable address refuses to guess', unknown.body.jurisdiction.confidence === 'unresolved');

  console.log('\nJOURNEY');
  const created = await call('/cases', { method: 'POST', body: { personaId: 'lakshmi', language: 'en' } });
  const id = created.body.caseId;
  check('case opens', created.status === 200 && Boolean(id));

  const intake = await call(`/cases/${id}/intake`, {
    method: 'POST',
    body: { utterance: 'Sir naanu appa house-na namaantaran transfer maadbeku. Appa theerikondru. Mane maarbeku. Arera Colony alli ide.' }
  });
  check('code-mixed intake parses', intake.body.intake.variant === 'inheritance' && intake.body.intake.locality === 'Arera Colony',
    `urgency=${intake.body.intake.urgency}`);

  const office = await call(`/cases/${id}/jurisdiction`, { method: 'POST', body: {} });
  check('case resolves to an office', office.body.jurisdiction.confidence === 'resolved');

  const first = await call(`/cases/${id}/check`, { method: 'POST' });
  check('the check refuses a defective set', first.body.evaluation.submittable === false,
    `${first.body.evaluation.counts.blocks} blocking, score ${first.body.evaluation.score}`);
  check('every finding carries an evidence trail',
    first.body.evaluation.findings.every((f) => f.ruleId && f.evidence && f.code && f.title && f.fix));
  check('no rule threw', first.body.evaluation.engineErrors.length === 0);

  const blocked = await call(`/cases/${id}/submit`, { method: 'POST', body: { acknowledgementNumber: 'GBAE/MHD/2026/04821' } });
  check('submission is refused while blockers stand', blocked.status === 400);

  const earlyAppeal = await binary(`/cases/${id}/escalation/first-appeal.pdf`);
  check('no appeal exists before there is a clock', earlyAppeal.status === 409);

  await call(`/cases/${id}/documents/fixtures`, { method: 'POST', body: { corrected: true } });
  const second = await call(`/cases/${id}/check`, { method: 'POST' });
  check('the corrected set passes', second.body.evaluation.submittable === true, `score ${second.body.evaluation.score}`);

  const kn = await call(`/cases/${id}/language`, { method: 'POST', body: { language: 'kn' } });
  const knCheck = await call(`/cases/${id}/check`, { method: 'POST' });
  check('findings come back in Kannada', kn.status === 200
    && knCheck.body.evaluation.findings.every((f) => /[ಀ-೿]/.test(f.title)));
  await call(`/cases/${id}/language`, { method: 'POST', body: { language: 'en' } });

  console.log('\nDOCUMENTS');
  const packet = await binary(`/cases/${id}/packet.pdf`);
  check('packet PDF generates', packet.isPdf && packet.bytes > 2000, `${packet.bytes} bytes`);
  check('the packet names the matched office', packet.text.includes('Arera Colony') || packet.text.includes('Zone 2') || packet.text.includes('Mahadevapura'));
  check('the packet lists the enclosures in a fixed order',
    /ENCLOSURES/i.test(packet.text)
    && packet.text.indexOf('Signed transfer application') >= 0
    && packet.text.indexOf('Signed transfer application') < packet.text.indexOf('Sale deed')
    && packet.text.indexOf('Sale deed') < packet.text.indexOf('Death certificate'));
  check('the packet disclaims being a government form', /Not a government form/i.test(packet.text));

  const report = await binary(`/cases/${id}/report.pdf`);
  check('readiness report generates', report.isPdf && report.bytes > 2000, `${report.bytes} bytes`);
  check('the report states the verdict', /ready to file/i.test(report.text));
  check('the report states that no model decided anything', /No language model took part/i.test(report.text));

  console.log('\nTHE CLOCK');
  const submitted = await call(`/cases/${id}/submit`, { method: 'POST', body: { acknowledgementNumber: 'GBAE/MHD/2026/04821' } });
  check('acknowledgement attaches a statutory deadline', submitted.status === 200 && submitted.body.status.remainingDays === 30,
    `deadline ${submitted.body.clock.deadlineAt.slice(0, 10)}`);

  const stillEarly = await binary(`/cases/${id}/escalation/first-appeal.pdf`);
  check('no appeal before the period lapses', stillEarly.status === 409);

  const deadline = new Date(submitted.body.clock.deadlineAt);
  const overdue = new Date(deadline.getTime() + 5 * 86400000).toISOString();
  const travelled = await call(`/cases/${id}/demo-now`, { method: 'POST', body: { now: overdue } });
  check('time travel detects the breach', travelled.body.status.breached === true && travelled.body.status.daysOverdue === 5);
  check('the first appeal becomes available on breach',
    travelled.body.status.availableEscalations.some((r) => r.id === 'first-appeal'));
  check('the second appeal is still withheld',
    !travelled.body.status.availableEscalations.some((r) => r.id === 'second-appeal'));

  const appeal = await binary(`/cases/${id}/escalation/first-appeal.pdf`);
  check('first appeal drafts', appeal.isPdf && appeal.bytes > 1500, `${appeal.bytes} bytes`);
  check('the appeal quotes the acknowledgement number', appeal.text.includes('GBAE/MHD/2026/04821'));
  check('the appeal states the days overdue, computed not typed', appeal.text.includes('5 days beyond'));
  check('the appeal names a role, never an individual officer',
    appeal.text.includes('First Appellate Authority') && !/Shri |Sri |Mr\. /.test(appeal.text));
  check('the appeal says it has not been sent', /NOT been sent/i.test(appeal.text));

  const later = new Date(deadline.getTime() + 25 * 86400000).toISOString();
  await call(`/cases/${id}/demo-now`, { method: 'POST', body: { now: later } });
  const rti = await binary(`/cases/${id}/escalation/rti.pdf`);
  check('RTI drafts once its stage is reached', rti.isPdf && rti.bytes > 1500, `${rti.bytes} bytes`);
  check('the RTI asks for the file movement history', /file movement history/i.test(rti.text));
  check('the RTI asks for a designation, not a person', /not the individual/i.test(rti.text));

  console.log('\nOUTCOME');
  const completed = await call(`/cases/${id}/complete`, { method: 'POST' });
  check('an anonymous outcome row is contributed', completed.status === 200 && completed.body.contributed?.days > 0,
    `${completed.body.contributed.days} days, met SLA: ${completed.body.contributed.metSla}`);
  check('the row carries no identifier',
    !JSON.stringify(completed.body.contributed).match(/Lakshmi|Savita|42, Arera Colony|GBAE/));
  const index = await call('/friction-index');
  check('the friction index aggregates by office', index.body.index.length > 0 && index.body.index.every((row) => row.office && !row.officer));

  console.log('\nPRIVACY');
  const deleted = await call(`/cases/${id}`, { method: 'DELETE' });
  check('a case can be deleted immediately', deleted.status === 200);
  check('and is then gone', (await call(`/cases/${id}`)).status === 404);

  console.log('\nHARD CASE');
  const hard = await call('/cases', { method: 'POST', body: { personaId: 'sarala' } });
  const hardCheck = await call(`/cases/${hard.body.caseId}/check`, { method: 'POST' });
  check('an unfixable case is not talked up', hardCheck.body.evaluation.submittable === false
    && hardCheck.body.evaluation.findings.some((f) => f.code === 'FMT-02'),
  'unregistered deed is reported as unregistered');
} catch (error) {
  fail('smoke run', error.message);
} finally {
  server.kill();
}

console.log(failures === 0 ? '\nAll smoke checks passed.\n' : `\n${failures} smoke check(s) failed.\n`);
process.exit(failures === 0 ? 0 : 1);

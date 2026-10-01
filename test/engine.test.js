/**
 * The CI gate.
 *
 * Three kinds of test, in increasing order of how much they would have saved us:
 *
 *  1. unit tests on the matcher, because the name comparison is where a wrong
 *     answer costs a citizen a trip to a notary they do not need
 *  2. a GOLDEN CORPUS — every persona, as supplied and corrected, pinned to an
 *     exact set of defect codes. If a rule change alters any verdict, this
 *     fails and you have to look at it.
 *  3. an INJECTED-DEFECT CORPUS — start from a document set that passes
 *     cleanly, break exactly one thing, and assert that exactly the expected
 *     code fires and nothing else changes. This is the test that catches a
 *     rule which "works" by accident because two rules overlap.
 *
 * Plus a ledger integrity check, which is the one that stops a defect code from
 * ever reaching a citizen in a language it was never translated into.
 *
 * Run: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  compareNames, phoneticKey, normalizeSurveyNumber, normalizePid,
  normalizeFinancialYear, expectedFinancialYears, splitRelation, transliterate
} from '../server/engine/text.js';
import { isValidAadhaarFormat, RULES, VARIANTS } from '../server/rules/khata-transfer.v1.js';
import { evaluateCase, withPassVerdict } from '../server/engine/compliance.js';
import { DEFECTS, LANGUAGES, explain, ledgerStats } from '../server/engine/ledger.js';
import { buildPersonaCase, PERSONA_IDS } from '../server/fixtures.js';
import { resolveJurisdiction, pointInPolygon, CORPORATIONS, GAZETTEER } from '../server/geo/jurisdiction.js';
import { attachClock, clockStatus, escalationFacts, addDays, SERVICE_SLA, ESCALATION_LADDER } from '../server/engine/clock.js';
import { parseIntakeDeterministic, intakeNeedsModelFallback } from '../server/intake.js';
import { classifyByFileName, coerceFields, fieldTemplate, extractDocument, extractionMode } from '../server/extract.js';

const TODAY = new Date('2026-08-28T09:00:00+05:30');
const codes = (result) => result.findings.map((f) => f.code).sort();
const run = (caseData) => evaluateCase(caseData, { today: TODAY });

/* ================================================================== *
 * 1 · Name matching
 * ================================================================== */

test('name matching: an initial stands for a full name-word when something else matched', () => {
  const result = compareNames('Ramesh Murthy', 'M. Ramesh');
  assert.notEqual(result.verdict, 'mismatch', 'these are the same person and must not be flagged');
  assert.equal(result.verdict, 'probable', 'bridged by an initial, so it is probable rather than exact');
});

test('name matching: an initial alone is NOT evidence of a match', () => {
  // The failure this guards against: "M." matching "Muniyappa" on one letter,
  // silently merging a grandfather with a son.
  assert.equal(compareNames('M. Ramesh', 'Muniyappa').verdict, 'mismatch');
  assert.equal(compareNames('S. Kumar', 'Srinivasappa').verdict, 'mismatch');
});

test('name matching: romanisation variants collapse', () => {
  for (const [a, b] of [['Murthy', 'Moorthy'], ['Krishnappa', 'Krishnapa'], ['Venkatesh', 'Venkatesha']]) {
    assert.equal(compareNames(a, b).verdict, 'match', a + ' vs ' + b);
  }
});

test('name matching: genuinely different people are still mismatches', () => {
  for (const [a, b] of [
    ['Ramesh Murthy', 'Prakash Nayak'],
    ['Savita Ramesh', 'Suresh Kumar'],
    ['Farhan Basha', 'Prakash Nayak']
  ]) {
    assert.equal(compareNames(a, b).verdict, 'mismatch', `${a} vs ${b} must not match`);
  }
});

test('name matching: honorifics and relationship suffixes are stripped', () => {
  assert.equal(compareNames('Sri. Ramesh Murthy S/o Muniyappa', 'Ramesh Murthy').verdict, 'match');
  assert.equal(compareNames('Smt. Savita Ramesh', 'Savita Ramesh').verdict, 'match');
  assert.equal(splitRelation('Ramesh Murthy S/o Muniyappa').relation, 'Muniyappa');
});

test('name matching: works across scripts', () => {
  assert.equal(transliterate('ರಮೇಶ್'), 'ramesh');
  assert.equal(transliterate('ಕೃಷ್ಣಪ್ಪ'), 'krishnappa');
  assert.equal(compareNames('ರಮೇಶ್', 'Ramesh').verdict, 'match');
  assert.equal(compareNames('रमेश', 'Ramesh').verdict, 'match');
});

test('name matching: an empty field is "unknown", never a match', () => {
  assert.equal(compareNames('', 'Ramesh').verdict, 'unknown');
  assert.equal(compareNames('Ramesh', null).verdict, 'unknown');
});

test('a missing field never produces a confident mismatch', () => {
  // String(null) is "null". Comparing that against a real name used to yield a
  // blocking NAME defect invented entirely out of an absent value.
  for (const empty of [null, undefined, '', '   ']) {
    assert.equal(compareNames('Ramesh Murthy', empty).verdict, 'unknown', String(empty));
    assert.equal(compareNames(empty, 'Ramesh Murthy').verdict, 'unknown', String(empty));
  }
  assert.equal(normalizePid(null), '');
  assert.equal(normalizeSurveyNumber(undefined), '');
  assert.equal(normalizeFinancialYear(null), '');
});

test('phonetic key is stable', () => {
  assert.equal(phoneticKey('Moorthy'), phoneticKey('Murthy'));
});

/* ================================================================== *
 * 2 · Identifiers, years, checksums
 * ================================================================== */

test('survey numbers normalise across the ways clerks write them', () => {
  const forms = ['Sy. No. 42/3', 'Survey No 42-3', '42/3', 'SY NO. 042/03', 'Sy.No.42/3'];
  const normalised = forms.map(normalizeSurveyNumber);
  assert.deepEqual([...new Set(normalised)], ['42/3'], `got ${JSON.stringify(normalised)}`);
});

test('survey number normalisation does not eat letters inside the value', () => {
  assert.equal(normalizeSurveyNumber('42/3s'), '42/3s');
});

test('PIDs normalise across separators', () => {
  assert.equal(normalizePid('84-12-345'), normalizePid('84/12/345'));
  assert.equal(normalizePid('84 12 345'), '8412345');
});

test('financial years normalise', () => {
  for (const form of ['2019-20', '2019-2020', 'FY 2019-20', '2019/20']) {
    assert.equal(normalizeFinancialYear(form), '2019-20', form);
  }
  assert.deepEqual(expectedFinancialYears(2025, 3), ['2023-24', '2024-25', '2025-26']);
});

test('Aadhaar format check runs the real Verhoeff algorithm', () => {
  assert.equal(isValidAadhaarFormat('234567890124'), true);
  assert.equal(isValidAadhaarFormat('765432109878'), true);
  assert.equal(isValidAadhaarFormat('234567890123'), false, 'wrong check digit must fail');
  assert.equal(isValidAadhaarFormat('123456789012'), false, 'must not start with 0 or 1');
  assert.equal(isValidAadhaarFormat('23456789012'), false, 'must be twelve digits');
});

/* ================================================================== *
 * 3 · Golden corpus
 * ================================================================== */

const GOLDEN = {
  'Savita/as-supplied': {
    persona: 'savita', corrected: false,
    verdict: 'will-be-refused', submittable: false,
    codes: ['DATE-02', 'DATE-04', 'FMT-07', 'INH-02', 'KYC-02', 'NAME-07', 'TAX-01']
  },
  'Savita/corrected': {
    persona: 'savita', corrected: true,
    verdict: 'ready', submittable: true,
    codes: ['DATE-04', 'INH-02', 'KYC-02', 'NAME-07', 'TAX-04']
  },
  'Farhan/as-supplied': {
    persona: 'farhan', corrected: false,
    verdict: 'will-be-refused', submittable: false,
    codes: ['DOC-09', 'ENC-01', 'FMT-01', 'ID-01', 'TAX-03']
  },
  'Farhan/corrected': {
    persona: 'farhan', corrected: true,
    verdict: 'ready', submittable: true,
    codes: []
  },
  'Ramkali/as-supplied': {
    persona: 'ramkali', corrected: false,
    verdict: 'will-be-refused', submittable: false,
    codes: ['DATE-02', 'DOC-03', 'DOC-05', 'DOC-06', 'DOC-08', 'DOC-10', 'FMT-02', 'FMT-04', 'FMT-05', 'FMT-08', 'ID-04', 'INH-01', 'NAME-05']
  }
};

for (const [name, expected] of Object.entries(GOLDEN)) {
  test(`golden: ${name}`, () => {
    const result = run(buildPersonaCase(expected.persona, { corrected: expected.corrected }));
    assert.deepEqual(result.engineErrors, [], 'no rule may throw');
    assert.deepEqual(codes(result), expected.codes.sort());
    assert.equal(result.verdict, expected.verdict);
    assert.equal(result.submittable, expected.submittable);
  });
}

test('golden: the positive verdict is itself a code with an evidence trail', () => {
  const clean = buildPersonaCase('farhan', { corrected: true });
  const result = withPassVerdict(run(clean));
  assert.equal(result.findings.length, 1);
  assert.equal(result.findings[0].code, 'PASS-01');
  assert.ok(result.findings[0].evidence.comparison.includes('0 failures'));
});

test('golden: the engine is deterministic', () => {
  const caseData = buildPersonaCase('savita');
  const a = run(caseData);
  const b = run(caseData);
  assert.deepEqual(codes(a), codes(b));
  assert.equal(a.score, b.score);
});

test('golden: score bands never let a blocked case look nearly ready', () => {
  for (const id of PERSONA_IDS) {
    for (const corrected of [false, true]) {
      const result = run(buildPersonaCase(id, { corrected }));
      if (result.counts.blocks > 0) {
        assert.ok(result.score <= 55, `${id} scored ${result.score} with ${result.counts.blocks} blockers`);
      } else if (result.counts.delays === 0) {
        assert.ok(result.score >= 90, `${id} scored ${result.score} with nothing outstanding`);
      }
    }
  }
});

/* ================================================================== *
 * 4 · Injected-defect corpus
 *
 * Break exactly one thing in a clean set and assert that exactly the expected
 * code appears, and that nothing else moves.
 * ================================================================== */

const CLEAN = () => buildPersonaCase('farhan', { corrected: true });
const BASELINE = codes(run(CLEAN()));

const findDoc = (caseData, kind) => caseData.documents.find((d) => d.kind === kind);

const INJECTIONS = [
  {
    name: 'missing sale deed', expect: ['DOC-01', 'NAME-05'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'sale_deed'); }
  },
  {
    name: 'missing khata extract', expect: ['DOC-02'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'khata_extract'); }
  },
  {
    name: 'no tax receipts at all', expect: ['DOC-03'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'tax_receipt'); }
  },
  {
    name: 'missing aadhaar', expect: ['DOC-04'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'aadhaar'); }
  },
  {
    name: 'missing electricity bill', expect: ['DOC-05'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'bescom_bill'); }
  },
  {
    name: 'missing encumbrance certificate', expect: ['DOC-06'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'encumbrance_certificate'); }
  },
  {
    name: 'unsigned application form', expect: ['DOC-09'],
    apply: (c) => { findDoc(c, 'application_form').fields.signed = false; }
  },
  {
    name: 'missing photograph', expect: ['DOC-10'],
    apply: (c) => { c.documents = c.documents.filter((d) => d.kind !== 'photo'); }
  },
  {
    name: 'khata stands in a stranger\'s name', expect: ['NAME-01', 'NAME-02', 'NAME-04'],
    apply: (c) => { findDoc(c, 'khata_extract').fields.ownerName = 'Ravi Shankar Gowda'; }
  },
  {
    name: 'aadhaar name is a different person', expect: ['NAME-03'],
    apply: (c) => { findDoc(c, 'aadhaar').fields.name = 'Ravi Shankar Gowda'; }
  },
  {
    name: 'survey number typo in the khata', expect: ['ID-01'],
    apply: (c) => { findDoc(c, 'khata_extract').fields.surveyNumber = '118/8'; }
  },
  {
    name: 'tax receipts carry a different PID', expect: ['ID-02'],
    apply: (c) => { for (const d of c.documents) if (d.kind === 'tax_receipt') d.fields.pid = '999-1-111'; }
  },
  {
    // ID-02 compares the receipts' PID against the khata's. With no khata PID
    // there is nothing to compare, so only the missing-PID rule should fire —
    // an engine that also reported a "mismatch" here would be inventing one.
    name: 'khata has no PID', expect: ['ID-04'],
    apply: (c) => { findDoc(c, 'khata_extract').fields.pid = null; }
  },
  {
    name: 'extent disagrees beyond tolerance', expect: ['ID-05'],
    apply: (c) => { findDoc(c, 'khata_extract').fields.extentSqFt = 1400; }
  },
  {
    name: 'extent disagrees within rounding tolerance', expect: [],
    apply: (c) => { findDoc(c, 'khata_extract').fields.extentSqFt = 920; }
  },
  {
    name: 'a year is missing from the tax run', expect: ['TAX-01'],
    apply: (c) => { c.documents = c.documents.filter((d) => !(d.kind === 'tax_receipt' && d.fields.financialYear === '2024-25')); }
  },
  {
    name: 'newest receipt is two years stale', expect: ['TAX-01', 'TAX-02'],
    apply: (c) => { for (const d of c.documents) if (d.kind === 'tax_receipt') d.fields.financialYear = '2021-22'; }
  },
  {
    name: 'arrears outstanding', expect: ['TAX-03'],
    apply: (c) => { findDoc(c, 'tax_receipt').fields.arrears = 3200; }
  },
  {
    name: 'under-stamped deed', expect: ['FMT-01'],
    apply: (c) => { findDoc(c, 'sale_deed').fields.stampDutyPaid = 90_000; }
  },
  {
    name: 'unregistered deed', expect: ['FMT-02'],
    apply: (c) => { findDoc(c, 'sale_deed').fields.registrationNumber = null; }
  },
  {
    name: 'missing signature', expect: ['FMT-03'],
    apply: (c) => { findDoc(c, 'sale_deed').fields.signaturePresent = false; }
  },
  {
    name: 'pages missing from the deed', expect: ['FMT-04'],
    apply: (c) => { findDoc(c, 'sale_deed').fields.pageCount = 6; }
  },
  {
    name: 'illegible scan', expect: ['FMT-05'],
    apply: (c) => { findDoc(c, 'khata_extract').fields.legibility = 0.31; }
  },
  {
    name: 'photo below specification', expect: ['FMT-06'],
    apply: (c) => { findDoc(c, 'photo').fields.widthPx = 180; }
  },
  {
    name: 'oversized upload', expect: ['FMT-08'],
    apply: (c) => { findDoc(c, 'sale_deed').fileSizeBytes = 6_000_000; }
  },
  {
    name: 'subsisting mortgage on the EC', expect: ['ENC-01'],
    apply: (c) => { findDoc(c, 'encumbrance_certificate').fields.entries[1].status = 'subsisting'; }
  },
  {
    name: 'court attachment on the EC', expect: ['ENC-03'],
    apply: (c) => { findDoc(c, 'encumbrance_certificate').fields.entries.push({ type: 'attachment', date: '2025-02-11', party: 'City Civil Court O.S. 441/2025', status: 'subsisting' }); }
  },
  {
    name: 'EC stops long before today', expect: ['DATE-03'],
    apply: (c) => { findDoc(c, 'encumbrance_certificate').fields.periodTo = '2024-01-31'; }
  },
  {
    name: 'khata extract older than a year', expect: ['DATE-02'],
    apply: (c) => { findDoc(c, 'khata_extract').fields.issuedDate = '2024-11-02'; }
  },
  {
    name: 'stale electricity bill', expect: ['DATE-04'],
    apply: (c) => { findDoc(c, 'bescom_bill').fields.billMonth = '2026-01'; }
  },
  {
    name: 'invalid aadhaar checksum', expect: ['KYC-01'],
    apply: (c) => { findDoc(c, 'aadhaar').fields.number = '765432109879'; }
  },
  {
    name: 'aadhaar address elsewhere', expect: ['KYC-02'],
    apply: (c) => { findDoc(c, 'aadhaar').fields.address = '18, 5th Main, Rajajinagar, Bengaluru 560010'; }
  }
];

for (const injection of INJECTIONS) {
  test(`injected: ${injection.name}`, () => {
    const caseData = CLEAN();
    injection.apply(caseData);
    const result = run(caseData);
    assert.deepEqual(result.engineErrors, [], 'no rule may throw on a broken document');
    const expected = [...new Set([...BASELINE, ...injection.expect])].sort();
    assert.deepEqual(codes(result), expected);
  });
}

test('injected: the clean baseline really is clean', () => {
  assert.deepEqual(BASELINE, [], 'the injection base case must produce no findings at all');
});

/* ================================================================== *
 * 5 · Rule scoping
 * ================================================================== */

test('rules that do not apply are skipped, not silently passed', () => {
  const purchase = run(buildPersonaCase('farhan', { corrected: true }));
  assert.ok(purchase.skippedRuleIds.includes('R-PRESENCE-05'), 'death-certificate rule must not apply to a purchase');
  assert.ok(purchase.skippedRuleIds.includes('R-PRESENCE-06'), 'heirship rule must not apply to a purchase');
  assert.ok(purchase.scoreBasis.rulesSkipped > 0);
  assert.equal(purchase.scoreBasis.rulesApplied + purchase.scoreBasis.rulesSkipped, RULES.length);
});

test('a purchase is not flagged for the khata standing in the seller\'s name', () => {
  // The khata being in the seller's name is the entire reason a buyer is here.
  // Flagging it would put a blocking defect on every honest purchase.
  const result = run(buildPersonaCase('farhan', { corrected: true }));
  assert.ok(!codes(result).includes('NAME-01'));
});

test('an inheritance IS flagged when the deed and khata name different owners', () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  findDoc(caseData, 'khata_extract').fields.ownerName = 'Devaraj Gowda';
  assert.ok(codes(run(caseData)).includes('NAME-01'));
});

/* ================================================================== *
 * 6 · Ledger integrity
 * ================================================================== */

test('every code a rule can emit exists in the ledger', () => {
  for (const rule of RULES) {
    assert.ok(DEFECTS[rule.code], `rule ${rule.id} emits ${rule.code}, which is not in the ledger`);
  }
});

test('every ledger entry is complete in every language', () => {
  for (const [code, entry] of Object.entries(DEFECTS)) {
    for (const { code: lang } of LANGUAGES) {
      const text = entry.text[lang];
      assert.ok(text, `${code} has no ${lang} text`);
      for (const field of ['title', 'why', 'fix', 'owner', 'where']) {
        assert.ok(typeof text[field] === 'string' && text[field].trim().length > 0, `${code}.${lang}.${field} is empty`);
      }
    }
  }
});

test('every ledger entry declares a severity, a source and a verification date', () => {
  for (const [code, entry] of Object.entries(DEFECTS)) {
    assert.ok(['blocks', 'delays', 'advisory'].includes(entry.severity), `${code} severity`);
    assert.ok(entry.citation?.source, `${code} citation`);
    assert.match(entry.citation.lastVerified, /^\d{4}-\d{2}-\d{2}$/, `${code} lastVerified`);
    assert.equal(typeof entry.citation.verified, 'boolean', `${code} must state whether the source was verified`);
    assert.equal(typeof entry.expectedDays, 'number', `${code} expectedDays`);
  }
});

test('non-English explanations are actually translated, not English copies', () => {
  for (const code of Object.keys(DEFECTS)) {
    const en = explain(code, 'en');
    for (const lang of ['kn', 'hi']) {
      assert.notEqual(explain(code, lang).title, en.title, `${code} ${lang} title is still English`);
    }
  }
});

test('an unknown code degrades to a safe, non-reassuring message', () => {
  const unknown = explain('NOT-A-CODE', 'en');
  assert.match(unknown.title, /Unknown check/);
  assert.match(unknown.why, /bug/);
});

test('ledger stats are consistent', () => {
  const stats = ledgerStats();
  assert.equal(stats.totalExplanations, stats.codes * stats.languages);
  assert.equal(stats.verifiedCitations + stats.unverifiedCitations, stats.codes);
});

/* ================================================================== *
 * 7 · Jurisdiction
 * ================================================================== */

test('jurisdiction: an interior address resolves to one corporation', () => {
  const result = resolveJurisdiction({ address: 'E-7, Arera Colony, Bhopal' });
  assert.equal(result.confidence, 'resolved');
  assert.equal(result.candidates.length, 1);
  assert.match(result.candidates[0].corporation, /Zone 2/);
  assert.match(result.candidates[0].zone, /Arera Colony/);
});

test('jurisdiction: an address near a divide returns two offices, not a guess', () => {
  const result = resolveJurisdiction({ address: 'Govindpura Industrial Area' });
  assert.equal(result.confidence, 'contested');
  assert.equal(result.candidates.length, 2);
  assert.equal(result.candidates[0].note, 'try first');
  assert.notEqual(result.candidates[0].corporationId, result.candidates[1].corporationId);
});

test('jurisdiction: an unplaceable address refuses to answer', () => {
  const result = resolveJurisdiction({ address: 'behind the big tree' });
  assert.equal(result.confidence, 'unresolved');
  assert.equal(result.candidates.length, 0);
  assert.ok(result.knownLocalities.length > 20, 'and says what it does know');
});

test('jurisdiction: a point outside the corporations says so', () => {
  const result = resolveJurisdiction({ lat: 12.30, lng: 76.65 });   // Mysuru
  assert.equal(result.confidence, 'outside-coverage');
  assert.match(result.nextStep, /Panchayat/);
});

test('jurisdiction: every gazetteer locality lands inside exactly one corporation', () => {
  for (const entry of GAZETTEER) {
    const hits = CORPORATIONS.filter((c) => pointInPolygon([entry.lat, entry.lng], c.polygon));
    assert.equal(hits.length, 1, `${entry.name} falls in ${hits.length} corporations`);
  }
});

test('jurisdiction: every gazetteer locality resolves to a real office', () => {
  for (const entry of GAZETTEER) {
    const result = resolveJurisdiction({ address: entry.name });
    assert.ok(['resolved', 'contested'].includes(result.confidence), `${entry.name}: ${result.confidence}`);
    assert.ok(result.candidates[0].office, `${entry.name} has no office`);
    assert.ok(result.candidates[0].zone, `${entry.name} has no zone`);
  }
});

test('jurisdiction: the five corporation polygons do not overlap', () => {
  const samples = [];
  for (let lat = 23.16; lat < 23.35; lat += 0.01) {
    for (let lng = 77.30; lng < 77.56; lng += 0.01) samples.push([lat, lng]);
  }
  for (const point of samples) {
    const hits = CORPORATIONS.filter((c) => pointInPolygon(point, c.polygon));
    assert.ok(hits.length <= 1, `point ${point} falls in ${hits.length} corporations`);
  }
});

/* ================================================================== *
 * 8 · The clock
 * ================================================================== */

const makeClock = () => attachClock({
  acknowledgementNumber: 'GBAE/MHD/2026/04821',
  submittedAt: '2026-08-28T05:00:00.000Z',
  office: { office: 'Mahadevapura zone office', corporation: 'Bengaluru East' }
});

test('clock: the deadline is the statutory period after submission', () => {
  const clock = makeClock();
  assert.equal(clock.slaDays, 30);
  assert.equal(clock.deadlineAt.slice(0, 10), '2026-09-27');
});

test('clock: counts down, then counts overdue', () => {
  const clock = makeClock();
  const day1 = clockStatus(clock, new Date('2026-08-29T09:00:00Z'));
  assert.equal(day1.breached, false);
  assert.equal(day1.state, 'running');

  const eve = clockStatus(clock, new Date('2026-09-26T09:00:00Z'));
  assert.equal(eve.state, 'due-soon');

  const after = clockStatus(clock, new Date('2026-10-04T09:00:00Z'));
  assert.equal(after.breached, true);
  assert.equal(after.daysOverdue, 7);
});

test('clock: an appeal cannot be drafted before the period lapses', () => {
  const clock = makeClock();
  assert.throws(
    () => escalationFacts(clock, 'first-appeal', new Date('2026-09-10T09:00:00Z')),
    /not available before the statutory period lapses/
  );
});

test('clock: the second appeal waits for the first appeal\'s own window', () => {
  const clock = makeClock();
  const justBreached = new Date('2026-09-29T09:00:00Z');
  assert.doesNotThrow(() => escalationFacts(clock, 'first-appeal', justBreached));
  assert.throws(() => escalationFacts(clock, 'second-appeal', justBreached), /becomes available/);
  assert.doesNotThrow(() => escalationFacts(clock, 'second-appeal', new Date('2026-10-20T09:00:00Z')));
});

test('clock: escalation facts carry arithmetic, not prose', () => {
  const facts = escalationFacts(makeClock(), 'first-appeal', new Date('2026-10-04T09:00:00Z'));
  assert.equal(facts.daysOverdue, 7);
  assert.equal(facts.slaDays, 30);
  assert.equal(facts.acknowledgementNumber, 'GBAE/MHD/2026/04821');
  assert.equal(facts.replyDueBy.slice(0, 10), addDays('2026-10-04T09:00:00Z', 15).toISOString().slice(0, 10));
});

/* ================================================================== *
 * 9 · Intake and extraction
 * ================================================================== */

test('intake: a code-mixed Kannada-English sentence is parsed offline', () => {
  const result = parseIntakeDeterministic('Sir mujhe appa ki house ka namaantaran karana hai. Appa theerikondru. Mane maarbeku. Arera Colony mein hai.');
  assert.equal(result.service, 'property-mutation');
  assert.equal(result.variant, 'inheritance');
  assert.equal(result.urgency, 'sale-blocked');
  assert.equal(result.locality, 'Arera Colony');
  assert.equal(result.relationship, 'child-of-owner');
});

test('intake: a Hindi-English purchase sentence is parsed offline', () => {
  const result = parseIntakeDeterministic('Bhai maine May mein flat liya hai Govindpura mein. Bank bol raha hai namaantaran ke baad hi loan release hoga.');
  assert.equal(result.variant, 'sale');
  assert.equal(result.urgency, 'loan-blocked');
  assert.equal(result.locality, 'Govindpura');
});

test('intake: an unrelated sentence does not invent a variant', () => {
  const result = parseIntakeDeterministic('what is the weather today');
  assert.equal(result.variant, null);
  assert.equal(result.service, null);
  assert.ok(result.confidence < 0.3);
});

test('intake: model fallback only when cues leave the variant open', () => {
  const clear = parseIntakeDeterministic('Sir mujhe appa ki house ka namaantaran karana hai. Appa theerikondru. Mane maarbeku. Arera Colony mein hai.');
  assert.equal(clear.variant, 'inheritance');
  assert.equal(intakeNeedsModelFallback(clear), false, 'a cue hit must stay offline');

  const blank = parseIntakeDeterministic('what is the weather today');
  assert.equal(intakeNeedsModelFallback(blank), true, 'an unresolved utterance may use the model');
});

test('extraction: upload defaults to the manual path even when a key could exist', async () => {
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test-not-used';
  try {
    const result = await extractDocument({
      fileName: 'sale-deed-2004.jpg',
      mimeType: 'image/jpeg',
      dataUrl: 'data:image/jpeg;base64,AAAA',
      useVision: false
    });
    assert.equal(result.extractionSource, 'manual');
    assert.equal(result.kind, 'sale_deed');
    assert.deepEqual(result.fields, {});
  } finally {
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  }
});

test('extraction: meta reports vision as fallback, not the default mode', () => {
  const prev = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'sk-test';
  try {
    const mode = extractionMode();
    assert.equal(mode.mode, 'manual');
    assert.equal(mode.visionFallback, true);
  } finally {
    if (prev === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prev;
  }
});

test('extraction: file names classify conservatively', () => {
  assert.equal(classifyByFileName('sale-deed-2004.pdf').kind, 'sale_deed');
  assert.equal(classifyByFileName('khata-extract.pdf').kind, 'khata_extract');
  assert.equal(classifyByFileName('IMG_20260828.jpg').kind, null, 'an ambiguous name must not be guessed');
});

test('extraction: every field a rule reads is offerable to a citizen on the manual path', () => {
  // If a rule reads a field the template does not declare, someone on the
  // no-vision-model path can never supply it, and the rule silently never fires.
  const declared = new Set();
  for (const kind of Object.keys(VARIANTS.inheritance.required.concat(VARIANTS.inheritance.recommended).reduce((a, k) => ({ ...a, [k]: 1 }), {}))) {
    for (const field of fieldTemplate(kind)) declared.add(`${kind}.${field.key}`);
  }
  assert.ok(declared.has('sale_deed.surveyNumber'));
  assert.ok(declared.has('khata_extract.pid'));
  assert.ok(declared.has('tax_receipt.financialYear'));
  assert.ok(declared.has('death_certificate.attested'));
});

test('extraction: confirmed values coerce to the types rules expect', () => {
  const fields = coerceFields('tax_receipt', {
    assesseeName: '  Ramesh Murthy ', pid: '84-12-345', financialYear: '2024-25',
    amountPaid: '4,820', arrears: '0'
  });
  assert.equal(fields.assesseeName, 'Ramesh Murthy');
  assert.equal(fields.amountPaid, 4820);
  assert.equal(fields.arrears, 0);
});

test('extraction: a list field accepts newline-separated text', () => {
  const fields = coerceFields('legal_heir_certificate', { deceasedName: 'X', heirs: 'Savita R\nSuresh Murthy', issuedDate: '2026-01-20' });
  assert.deepEqual(fields.heirs, ['Savita R', 'Suresh Murthy']);
});

/* ================================================================== *
 * 10 · Failure behaviour
 * ================================================================== */

test('a throwing rule is reported as an engine error, never as a clean bill of health', () => {
  const caseData = buildPersonaCase('farhan', { corrected: true });
  // Poison a field the EC rules read, in a way that makes them throw.
  findDoc(caseData, 'encumbrance_certificate').fields.entries = { notAnArray: true };
  const result = run(caseData);
  assert.ok(result.engineErrors.length > 0, 'the failure must be surfaced');
  assert.ok(result.engineErrors.every((e) => e.ruleId && e.message));
});

test('an empty case does not claim to be ready', () => {
  const result = run({ variant: 'inheritance', applicant: { name: 'Someone' }, documents: [] });
  assert.equal(result.submittable, false);
  assert.ok(result.counts.blocks >= 4);
});

/* ================================================================== *
 * 11 · The printable packet
 *
 * The packet is the only artifact that leaves the building. Every check above
 * can be right and the citizen still walks into the office with the wrong
 * stack, because the paper told them something the engine never said.
 *
 * These pin the two things the packet used to get wrong: it listed enclosures
 * in case-insertion order under a heading that said "assemble in this order",
 * and it never mentioned the documents that were missing — so a complete-
 * looking list was printed for a case that was three certificates short.
 * ================================================================== */

/**
 * Renders a packet to a buffer and recovers the words printed on it.
 *
 * PDFKit deflates the page content stream by default, which would leave these
 * tests asserting on a byte count — a packet that printed nothing at all would
 * pass. startDoc reads PDF_NO_COMPRESS when the document is constructed, so
 * setting it here is enough to get plain-text glyph runs back.
 */
async function renderPacket(caseData, evaluation) {
  process.env.PDF_NO_COMPRESS = '1';
  const { Writable } = await import('node:stream');
  const { streamPacket } = await import('../server/pdf.js');
  const chunks = [];
  const sink = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } });
  sink.setHeader = () => {};
  const finished = new Promise((resolve) => sink.on('finish', () => resolve(Buffer.concat(chunks))));
  streamPacket(sink, {
    caseData,
    evaluation,
    jurisdiction: { confidence: 'resolved', candidates: [{ corporation: 'Bengaluru East City Corporation', zone: 'Mahadevapura zone', office: 'Assistant Revenue Officer' }] },
    language: 'en'
  });
  return readPdf(await finished);
}

/** Same, for the readiness report. */
async function renderReport(caseData, evaluation) {
  process.env.PDF_NO_COMPRESS = '1';
  const { Writable } = await import('node:stream');
  const { streamReport } = await import('../server/pdf.js');
  const chunks = [];
  const sink = new Writable({ write(chunk, _enc, cb) { chunks.push(chunk); cb(); } });
  sink.setHeader = () => {};
  const finished = new Promise((resolve) => sink.on('finish', () => resolve(Buffer.concat(chunks))));
  streamReport(sink, { caseData, evaluation });
  return readPdf(await finished);
}

/** Recovered words, plus the structure that words alone cannot show. */
function readPdf(buffer) {
  const raw = buffer.toString('latin1');
  const streams = [...raw.matchAll(/stream\r?\n([\s\S]*?)endstream/g)].map((m) => m[1]);
  return {
    text: (raw.match(/<[0-9A-Fa-f]{2,}>/g) || [])
      .map((run) => Buffer.from(run.slice(1, -1), 'hex').toString('latin1'))
      .join('')
      .replace(/\s+/g, ' '),
    pageCount: Number((raw.match(/\/Count\s+(\d+)/) || [])[1] || 0),
    // Text operations per page. A page that got added by accident — which is
    // exactly what writing into the bottom margin does — shows up here as a
    // stream with nothing on it.
    textOpsPerPage: streams
      .filter((s) => /BT|Tf/.test(s))
      .map((s) => (s.match(/TJ|Tj/g) || []).length)
  };
}

test('the packet orders enclosures the way an office reads a file', async () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  const { text } = await renderPacket(caseData, run(caseData));
  const at = (needle) => {
    const i = text.indexOf(needle);
    assert.ok(i >= 0, `"${needle}" is missing from the packet`);
    return i;
  };
  // Identity before title, title before the record, record before tax, tax
  // before the succession chain, succession before merely supporting papers.
  assert.ok(at('Aadhaar (for eKYC)') < at('Sale deed'));
  assert.ok(at('Sale deed') < at('Property Mutation extract'));
  assert.ok(at('Property Mutation extract') < at('Property tax receipts'));
  assert.ok(at('Property tax receipts') < at('Death certificate'));
  assert.ok(at('Death certificate') < at('Legal heir certificate'));
  assert.ok(at('Legal heir certificate') < at('Encumbrance certificate'));
});

test('the packet names what is NOT in the stack', async () => {
  // A real hole rather than a defect: the title and identity are there, the
  // whole succession chain and the tax run are not.
  const caseData = buildPersonaCase('savita', { corrected: true });
  caseData.documents = caseData.documents.filter(
    (d) => !['tax_receipt', 'death_certificate', 'legal_heir_certificate'].includes(d.kind)
  );
  const evaluation = run(caseData);
  assert.deepEqual(
    evaluation.documents.missingRequired.slice().sort(),
    ['death_certificate', 'legal_heir_certificate', 'tax_receipt']
  );

  const { text } = await renderPacket(caseData, evaluation);
  assert.match(text, /NOT IN THIS STACK/, 'a short stack must say so on its face');
  for (const label of ['Property tax receipts (required)', 'Death certificate (required)', 'Legal heir certificate (required)']) {
    // The em-dash separator is one glyph the latin1 recovery above cannot round
    // trip, so match either side of it rather than the whole run.
    const pattern = new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*.?\\s*NOT ENCLOSED');
    assert.match(text, pattern, `${label} must be listed as absent`);
  }
  assert.match(text, /still to obtain/);
});

test('repeated documents collapse into one enclosure, with the years in order', async () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  const years = caseData.documents.filter((d) => d.kind === 'tax_receipt').map((d) => d.fields.financialYear);
  assert.ok(years.length >= 3, 'this fixture is supposed to carry a run of receipts');

  const { text } = await renderPacket(caseData, run(caseData));
  // One line, not one per receipt — and the years ascending, because the thing
  // the counter checks is whether the run is unbroken.
  const sorted = years.slice().sort();
  assert.ok(text.includes(years.length + ' receipts'), 'the receipts are one enclosure carrying a count');
  assert.ok(text.includes(sorted.join(', ')), `expected years in order: ${sorted.join(', ')}`);
});

test('both documents carry page numbers and no accidental blank pages', async () => {
  const caseData = buildPersonaCase('savita', { corrected: false });
  const evaluation = run(caseData);
  for (const [name, rendered] of [
    ['packet', await renderPacket(caseData, evaluation)],
    ['report', await renderReport(caseData, evaluation)]
  ]) {
    assert.ok(rendered.pageCount >= 2, `${name} should run to more than one page`);
    for (let n = 1; n <= rendered.pageCount; n += 1) {
      assert.ok(rendered.text.includes(`Page ${n} of ${rendered.pageCount}`),
        `${name} is missing "Page ${n} of ${rendered.pageCount}"`);
    }
    // Writing a footer into the bottom margin will happily add a blank page per
    // page if the margin is not collapsed first. A page with no text is that.
    assert.equal(rendered.textOpsPerPage.length, rendered.pageCount, `${name}: stream count should match page count`);
    for (const [i, ops] of rendered.textOpsPerPage.entries()) {
      assert.ok(ops > 5, `${name} page ${i + 1} has almost nothing on it (${ops} text ops)`);
    }
  }
});

test('the statutory period is stated, not left as a blank to fill in', async () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  const evaluation = run(caseData);
  const { SERVICE_SLA, ESCALATION_LADDER } = await import('../server/engine/clock.js');
  const sla = SERVICE_SLA['khata-transfer'];

  // In BOTH documents: the packet is surrendered at the counter, so a citizen
  // who had this only there would have handed away the page telling them what
  // the office owes them.
  for (const [name, rendered] of [
    ['packet', await renderPacket(caseData, evaluation)],
    ['report', await renderReport(caseData, evaluation)]
  ]) {
    assert.match(rendered.text, new RegExp(`${sla.days} ${sla.unit}`), `${name} must state the stipulated period`);
    assert.ok(rendered.text.includes(sla.framework), `${name} must name the framework it comes from`);
    assert.ok(rendered.text.includes(sla.designatedOfficerRole), `${name} must name the answerable role`);
    for (const rung of ESCALATION_LADDER) {
      assert.ok(rendered.text.includes(rung.label), `${name} must preview the ${rung.label}`);
    }
  }
});

test('the report counts its own untraced requirements rather than gesturing at them', async () => {
  const caseData = buildPersonaCase('savita', { corrected: false });
  const evaluation = run(caseData);
  const cited = evaluation.findings.filter((f) => f.citation);
  const untraced = cited.filter((f) => !f.citation.verified).length;
  assert.ok(untraced > 0, 'this fixture is supposed to raise at least one untraced requirement');

  const { text } = await renderReport(caseData, evaluation);
  assert.ok(text.includes(`${untraced} of the ${cited.length} findings`),
    `expected the report to count ${untraced} of ${cited.length}`);
});

test('the packet says which originals to carry, and never the ones it is keeping', async () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  const { text } = await renderPacket(caseData, run(caseData));
  const section = text.slice(text.indexOf('CARRY THE ORIGINALS'), text.indexOf('WHAT THE LAW ALLOWS'));
  assert.ok(section.length > 40, 'the originals section must exist');
  for (const label of ['Sale deed', 'Property Mutation extract', 'Death certificate']) {
    assert.ok(section.includes(label), `${label} is issued or registered — its original gets asked for`);
  }
  // The form, the photo and the affidavits ARE the originals being handed over.
  for (const label of ['Signed transfer application', 'Passport photograph', 'No-objection affidavit']) {
    assert.ok(!section.includes(label), `${label} is submitted as the original — do not ask for it twice`);
  }
});

/* ================================================================== *
 * 12 · Measurement
 *
 * FMT-03, FMT-05 and FMT-06 read the physical quality of an upload. Those
 * values used to come from the vision model, which meant a language model's
 * opinion reached a rule and changed a verdict. They are arithmetic over
 * pixels now, and this is the arithmetic.
 *
 * The property that matters most here is not accuracy, it is RETICENCE: a
 * measure that is confident when it should not be sends a citizen to a notary
 * or a photo studio for nothing. Every function must return undefined rather
 * than guess, and the rules must stay silent when it does.
 * ================================================================== */

const { legibilityOf, signatureInkOf, plainBackgroundOf } = (await import('../src/measure.js')).__internals;

/** A grayscale plane built by a function of (x, y). */
const plane = (w, h, fn) => {
  const g = new Float32Array(w * h);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) g[y * w + x] = fn(x, y);
  return g;
};

test('legibility separates a sharp page from a blurred one', () => {
  const W = 260, H = 260;
  // Alternating 2px bars: the highest spatial frequency a document can carry.
  const bars = (x) => (Math.floor(x / 2) % 2 ? 245 : 15);

  /** A real box blur of those bars — the thing a shaky phone camera does. */
  const blurred = (radius) => {
    const src = plane(W, H, bars);
    const out = new Float32Array(W * H);
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        let sum = 0, n = 0;
        for (let k = -radius; k <= radius; k += 1) {
          const xx = x + k;
          if (xx < 0 || xx >= W) continue;
          sum += src[y * W + xx]; n += 1;
        }
        out[y * W + x] = sum / n;
      }
    }
    return out;
  };

  const sharp = legibilityOf(plane(W, H, bars), W, H);
  const soft = legibilityOf(blurred(14), W, H);   // text still there, no longer readable
  const flat = legibilityOf(plane(W, H, () => 250), W, H);   // blank paper

  assert.ok(sharp > 0.6, `sharp text must clear the FMT-05 threshold, got ${sharp}`);
  assert.ok(soft < 0.6, `blurred text must fall below it, got ${soft}`);
  assert.ok(flat < soft, `blank paper carries less detail than blurred text, got ${flat} vs ${soft}`);
  assert.ok(sharp > soft && soft > flat, 'the measure must be monotone in detail');
});

test('legibility is stable in [0,1] and refuses to answer for a thumbnail', () => {
  for (const f of [() => 0, () => 255, (x, y) => (x * y) % 256]) {
    const v = legibilityOf(plane(120, 120, f), 120, 120);
    assert.ok(v >= 0 && v <= 1, `out of range: ${v}`);
  }
  assert.equal(legibilityOf(plane(8, 8, () => 100), 8, 8), undefined,
    'too small to measure means undefined, not a confident zero');
});

test('the signature measure only speaks when the band is unambiguous', () => {
  const W = 400, H = 600;
  const bandStart = Math.floor(H * 0.8);

  // Nothing at all in the lower fifth: that is a signature block left empty.
  assert.equal(signatureInkOf(plane(W, H, () => 250), W, H), false);

  // A solid mark across the band.
  assert.equal(signatureInkOf(plane(W, H, (x, y) => (y > bandStart + 20 && y < bandStart + 70 && x > 40 && x < 300 ? 20 : 250)), W, H), true);

  // A thin printed footer — a page number, an address line. Not distinguishable
  // from a signature, so it must say nothing rather than call the page signed.
  const footer = plane(W, H, (x, y) => (y > H - 6 && x > 150 && x < 250 ? 30 : 250));
  assert.equal(signatureInkOf(footer, W, H), undefined,
    'ambiguous ink must not be reported either way');
});

test('an undefined measurement produces no finding at all', () => {
  // The whole reticence design rests on this: the rules test for `=== false`
  // and `typeof === 'number'`, so silence from the measurement layer is silence
  // in the verdict. If this ever changes, every "cannot tell" becomes a defect.
  const caseData = buildPersonaCase('savita', { corrected: true });
  const before = codes(run(caseData));

  const photo = findDoc(caseData, 'photo');
  photo.fields.faceVisible = undefined;
  photo.fields.plainBackground = undefined;
  findDoc(caseData, 'application_form').fields.signaturePresent = undefined;
  findDoc(caseData, 'sale_deed').fields.legibility = undefined;

  assert.deepEqual(codes(run(caseData)), before,
    'unmeasurable fields must not change the verdict in either direction');
});

test('a measured legibility below the threshold does fire, so silence is not the only outcome', () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  assert.ok(!codes(run(caseData)).includes('FMT-05'), 'clean set should not flag legibility');

  findDoc(caseData, 'sale_deed').fields.legibility = 0.11;   // a 4px-blurred phone photo
  assert.ok(codes(run(caseData)).includes('FMT-05'), 'a real measurement below 0.60 must be caught');
});

test('the background measure reports only clear cases', () => {
  const W = 300, H = 300;
  assert.equal(plainBackgroundOf(plane(W, H, () => 240), W, H), true, 'a uniform backdrop is plain');
  // A hard-edged busy border: alternating black and white blocks.
  assert.equal(plainBackgroundOf(plane(W, H, (x, y) => ((Math.floor(x / 7) + Math.floor(y / 7)) % 2 ? 250 : 5)), W, H), false);
  assert.equal(plainBackgroundOf(plane(20, 20, () => 128), 20, 20), undefined, 'too small to judge');
});

/* ================================================================== *
 * 13 · The assistant
 *
 * The assistant is the most dangerous surface in the product: a conversational
 * box sitting next to a verdict, in the one place where "your papers are fine"
 * would cost someone a wasted trip and the only leverage they had.
 *
 * So what is pinned here is not answer quality. It is that no answer is ever
 * composed — every sentence it returns must be traceable to the ledger, the
 * evaluation, the jurisdiction resolver or the clock — and that it says it does
 * not know rather than guessing.
 * ================================================================== */

const { answer, matchIntent, matchTopic } = await import('../src/assistant.js');

/** The UI scaffolding, stubbed with markers so leakage is visible. */
const STR = {
  whatToDo: 'DO:', whoWhere: 'WHO:', fromRulebook: 'RULEBOOK', fromEngine: 'ENGINE', fromJurisdiction: 'JURIS',
  lastVerified: 'verified', noCheckYet: 'NO_CHECK_YET', noOfficeYet: 'NO_OFFICE_YET', noBlockers: 'NO_BLOCKERS',
  nothingToFix: 'NOTHING_TO_FIX', nothingMissing: 'NOTHING_MISSING', blockersIntro: 'BLOCKERS:',
  askWhichOne: 'ASK_WHICH', missingIntro: 'MISSING:', countsLine: '{blocks}/{delays}/{advisory}',
  howLongAnswer: 'crit={critical} serial={serial} slowest={slowest}',
  deadlineAnswer: 'days={days} unit={unit} role={role} framework={framework}',
  appealIntro: 'APPEALS:', appealDrafted: 'DRAFTED', theDayItLapses: 'DAY_ONE', disposedWithin: 'within',
  days: 'days', contested: 'CONTESTED', feeAnswer: 'FEE_ANSWER', helpAnswer: 'HELP_ANSWER',
  verdictRefused: 'REFUSED', verdictObjected: 'OBJECTED', verdictReady: 'READY'
};

const ctxFor = (caseData) => ({ caseData, evaluation: run(caseData), strings: STR });

test('the assistant answers about a specific defect out of the ledger, verbatim', () => {
  const caseData = buildPersonaCase('savita', { corrected: false });
  const ctx = ctxFor(caseData);
  const tax = ctx.evaluation.findings.find((f) => f.code.startsWith('TAX'));
  assert.ok(tax, 'this fixture is supposed to raise a tax defect');

  const reply = answer('what about the tax receipt', ctx);
  // Every substantive sentence must be the ledger's own words, not a paraphrase.
  assert.ok(reply.text.includes(tax.title), 'must use the ledger title');
  assert.ok(reply.text.includes(tax.why), 'must use the ledger explanation');
  assert.ok(reply.text.includes(tax.fix), 'must use the ledger fix');
  assert.ok(reply.cite.includes(tax.code), 'must cite the defect code');
});

test('it routes a question to the right defect family, in all three languages', () => {
  const caseData = buildPersonaCase('savita', { corrected: false });
  const findings = run(caseData).findings;
  for (const [question, prefix] of [
    ['the tax receipt', 'TAX'],
    ['my name is spelt differently', 'NAME'],
    ['ಕಂದಾಯ ರಸೀದಿ', 'TAX'],
    ['नाम की वर्तनी', 'NAME'],
    ['it needs to be attested', 'FMT']
  ]) {
    const hit = matchTopic(question, findings);
    assert.ok(hit && hit.code.startsWith(prefix), `"${question}" should reach ${prefix}, got ${hit?.code}`);
  }
});

test('it refuses to answer about a case that has not been checked', () => {
  const reply = answer('what is wrong with my documents', { caseData: {}, evaluation: null, strings: STR });
  assert.equal(reply.text, 'NO_CHECK_YET');
  assert.equal(reply.cite, null, 'an admission of ignorance cites nothing');
});

test('an unrecognised question falls back to help, never to a guess', () => {
  const caseData = buildPersonaCase('savita', { corrected: false });
  for (const nonsense of ['qwertyuiop', 'tell me a joke', 'what is the capital of France', '']) {
    const reply = answer(nonsense, ctxFor(caseData));
    assert.equal(reply.text, 'HELP_ANSWER', `"${nonsense}" must not produce a substantive answer`);
    assert.ok(reply.isHelp);
  }
});

test('every answer is traceable — nothing is composed about the case', () => {
  const caseData = buildPersonaCase('savita', { corrected: false });
  const ctx = ctxFor(caseData);
  const corpus = [
    ...ctx.evaluation.findings.flatMap((f) => [f.title, f.why, f.fix, f.owner, f.where, f.code]),
    // Scaffolding strings carry {placeholders}; after substitution only their
    // literal segments survive, so those are what the residue can contain.
    ...Object.values(STR).flatMap((s) => String(s).split(/\{[a-z]+\}/i)),
    ...ctx.evaluation.fixPlan.steps.map((s) => s.title),
    String(ctx.evaluation.counts.blocks), String(ctx.evaluation.counts.delays), String(ctx.evaluation.counts.advisory),
    String(ctx.evaluation.fixPlan.criticalPathDays), String(ctx.evaluation.fixPlan.serialDays),
    ctx.evaluation.rulePack,
    // The statutory facts, taken from the clock module rather than retyped, so
    // this test cannot pass by agreeing with a copy of the data that has drifted.
    ...Object.values(SERVICE_SLA['khata-transfer']).map(String),
    ...ESCALATION_LADDER.flatMap((r) => [r.label, r.addressedToRole, r.basis, String(r.disposalDays), String(r.availableAfterDays)]),
    '•', '\n', ' ', '—', '-', ':', ',', '.'
  ];

  for (const q of ['what is wrong', 'how long', 'am i ready', 'what if they delay', 'what do i need', 'how many days does the office have']) {
    const { text } = answer(q, ctx);
    // Strip every known-provenance fragment; whatever is left is invention.
    let residue = text;
    for (const piece of corpus.sort((a, b) => String(b).length - String(a).length)) {
      residue = residue.split(String(piece)).join('');
    }
    // After every traceable fragment is removed, no WORD may remain. Digits,
    // whitespace and punctuation are formatting the assistant is allowed to
    // add; a letter is a claim about the case that nobody wrote.
    assert.equal(residue.replace(/[\s\d\p{P}\p{S}]/gu, ''), '',
      `"${q}" produced text that is not traceable to the ledger, the engine or the scaffolding: ${JSON.stringify(residue.slice(0, 120))}`);
  }
});

test('a clean case is told it is clean, not sold a problem', () => {
  const caseData = buildPersonaCase('savita', { corrected: true });
  const ctx = ctxFor(caseData);
  assert.equal(ctx.evaluation.counts.blocks, 0, 'the corrected fixture should have no blockers');
  assert.equal(answer('what is wrong', ctx).text, 'NO_BLOCKERS');
  assert.equal(answer('what do i still need', ctx).text, 'NOTHING_MISSING');
});

test('intent matching prefers the longer phrase', () => {
  assert.equal(matchIntent('how long will this take').id, 'howlong');
  assert.equal(matchIntent('where do i go').id, 'office');
  assert.equal(matchIntent('ಎಷ್ಟು ದಿನ ಬೇಕು').id, 'howlong');
  assert.equal(matchIntent('कहाँ जाना है').id, 'office');
  assert.equal(matchIntent(''), null);
  assert.equal(matchIntent('zzzz'), null);
});

test('every suggestion chip answers its own question, in every language', async () => {
  // The chips are the questions people actually click, so a chip whose text
  // does not route to its own intent is a wrong answer served on a plate.
  // Four of eighteen did exactly that: Kannada inflects ತಪ್ಪು into ತಪ್ಪಾಗಿದೆ,
  // Hindi writes ग़लत with a nukta (a different codepoint from गलत), and
  // "how many days does the office have" was being answered by the fix plan
  // because a shorter phrase outscored a longer, more specific one.
  const { SUGGESTION_INTENTS, matchIntent } = await import('../src/assistant.js');
  const fs = await import('node:fs');
  const src = fs.readFileSync('src/i18n.js', 'utf8');

  for (const lang of ['en', 'kn', 'hi']) {
    const start = src.indexOf(`  ${lang}: {`);
    const block = src.slice(start, src.indexOf('\n  },', start));
    for (const id of SUGGESTION_INTENTS) {
      const found = block.match(new RegExp(`'bot\.chip\.${id}': '([^']*)'`));
      assert.ok(found, `${lang} is missing the ${id} chip`);
      assert.equal(matchIntent(found[1])?.id, id,
        `${lang} chip "${found[1]}" routes to the wrong answer`);
    }
  }
});

test('the statutory questions answer without a case, the case questions do not', async () => {
  // The orb sits on the landing page too, where there is no case at all. The
  // period the office gets, the appeal ladder and what you should pay are facts
  // about the service and must answer there — those are the questions someone
  // has BEFORE committing to eight steps. Only questions about a particular
  // case may say "run the check first".
  const { answer } = await import('../src/assistant.js');
  const strings = { ...STR };
  const noCase = { caseData: {}, evaluation: null, strings };

  for (const q of ['how many days does the office have', 'what if they delay it', 'what should i pay', 'what can you do']) {
    assert.notEqual(answer(q, noCase).text, 'NO_CHECK_YET',
      `"${q}" is answerable without a case and must not be deferred`);
  }
  for (const q of ['what is wrong', 'how long will this take', 'am i ready', 'what do i still need']) {
    assert.equal(answer(q, noCase).text, 'NO_CHECK_YET',
      `"${q}" is about a specific case and must not be guessed at`);
  }
});

test('the assistant survives a null case, which is what the landing page passes', async () => {
  // `= {}` in a destructure only fills an UNDEFINED argument. On the landing
  // page there is a real null — no case started — so every read has to be
  // optional. It was not, and "where do I go?" threw a TypeError inside the
  // click handler: no answer appeared and the previous one stayed on screen,
  // which looks exactly like the wrong answer rather than a crash.
  const { answer } = await import('../src/assistant.js');
  for (const caseData of [null, undefined, {}]) {
    for (const q of ['where do i go', 'what should i pay', 'what if they delay it', 'hello']) {
      assert.doesNotThrow(() => answer(q, { caseData, evaluation: null, strings: STR }),
        `caseData=${JSON.stringify(caseData)} question="${q}"`);
    }
  }
  assert.equal(answer('where do i go', { caseData: null, evaluation: null, strings: STR }).text, 'NO_OFFICE_YET');
});

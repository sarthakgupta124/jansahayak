/**
 * DOCUMENT GENERATION
 *
 * Four outputs, all of which the citizen files themselves:
 *   1. the submission packet — cover sheet, enclosure order, counter checklist
 *   2. the readiness report — every check, with its evidence
 *   3. an escalation letter — first appeal, second appeal, or RTI
 *
 * Everything is generated in English. That is deliberate rather than lazy: the
 * office record and the officer's file are in English or Kannada, and a letter
 * the receiving clerk cannot process helps nobody. The app explains every line
 * of these documents in the citizen's own language on screen and aloud; the
 * paper that goes across the counter is in the language the counter uses.
 *
 * Nothing here is submitted anywhere. Every file downloads to the citizen.
 */

import PDFDocument from 'pdfkit';
import { ESCALATION_LADDER, SERVICE_SLA, formatDate } from './engine/clock.js';

const INK = '#12211f';
const MUTED = '#6a7a75';
const ACCENT = '#0f4c43';
const RULE = '#d7d3c7';

function startDoc(res, filename) {
  const doc = new PDFDocument({
    margin: 54,
    size: 'A4',
    // Compression off makes the content stream plain text, so CI can assert on
    // the words and dates that actually appear in a generated appeal rather
    // than only on the byte count. Off in tests, on everywhere else.
    compress: process.env.PDF_NO_COMPRESS !== '1',
    // Buffered so the last page can be counted before any page is written —
    // "Page 3" alone does not tell you a sheet is missing, "Page 3 of 5" does,
    // and these are handed across a counter and passed between desks.
    bufferPages: true,
    info: { Title: filename, Producer: 'JanSahayak (prototype)' }
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.setHeader('Cache-Control', 'no-store');
  doc.pipe(res);
  return doc;
}

function letterhead(doc, title, subtitle) {
  // The wordmark on screen is "JanSahayak". On paper it is romanised, because
  // PDFKit's built-in Helvetica has no Devanagari glyphs and embedding a
  // Unicode face for a letterhead would add ~200 KB to every download on a
  // connection that can least afford it. The letters themselves are English
  // for the same reason the app explains elsewhere: they are read by a counter.
  doc.fillColor(ACCENT).font('Helvetica-Bold').fontSize(9).text('JanSahayak · CITIZEN-PREPARED DOCUMENT · PROTOTYPE', { characterSpacing: 1.2 });
  doc.moveDown(0.8);
  doc.fillColor(INK).font('Helvetica-Bold').fontSize(19).text(title);
  if (subtitle) doc.moveDown(0.2).fillColor(MUTED).font('Helvetica').fontSize(10).text(subtitle);
  doc.moveDown(0.7);
  hr(doc);
  doc.moveDown(0.7);
}

function hr(doc) {
  const y = doc.y;
  doc.save().strokeColor(RULE).lineWidth(1).moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).stroke().restore();
}

function section(doc, heading) {
  if (doc.y > doc.page.height - 140) doc.addPage();
  doc.moveDown(0.9).fillColor(ACCENT).font('Helvetica-Bold').fontSize(11).text(heading.toUpperCase(), { characterSpacing: 0.8 });
  doc.moveDown(0.4).fillColor(INK).font('Helvetica').fontSize(10.5);
}

function kv(doc, label, value) {
  doc.font('Helvetica-Bold').fontSize(9.5).fillColor(MUTED).text(label.toUpperCase(), { continued: false, characterSpacing: 0.5 });
  doc.font('Helvetica').fontSize(11).fillColor(INK).text(value == null || value === '' ? '—' : String(value));
  doc.moveDown(0.45);
}

/**
 * Stamps every page with a running header and "Page n of N", then ends the
 * document. Call instead of doc.end().
 *
 * A packet is a physical object. It gets separated at a counter, carried
 * between desks and handed back in a different order, and until now a loose
 * sheet from page 4 carried nothing saying whose file it belonged to or that
 * anything was missing.
 */
function paginate(doc, { title, subject }) {
  const range = doc.bufferedPageRange();
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;

  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Writing into the bottom margin would otherwise trip the automatic page
    // break and add a blank page for every page we number.
    const keep = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    if (i > range.start) {
      doc.font('Helvetica').fontSize(7.6).fillColor(MUTED)
        .text(title, left, 26, { width: right - left - 150, lineBreak: false })
        .text(subject, right - 150, 26, { width: 150, align: 'right', lineBreak: false });
      doc.save().strokeColor(RULE).lineWidth(0.6)
        .moveTo(left, 38).lineTo(right, 38).stroke().restore();
    }

    doc.font('Helvetica').fontSize(7.6).fillColor(MUTED).text(
      `Page ${i - range.start + 1} of ${range.count}`,
      left, doc.page.height - 34, { width: right - left, align: 'center', lineBreak: false }
    );

    doc.page.margins.bottom = keep;
  }
  doc.flushPages();
  doc.end();
}

function footer(doc, extra) {
  doc.moveDown(1.2);
  hr(doc);
  doc.moveDown(0.5).fillColor(MUTED).font('Helvetica').fontSize(7.8)
    .text(extra || 'Generated by JanSahayak, an independent prototype. Not a government form and not affiliated with any government body. No government system was accessed to produce this document, and nothing here has been submitted on your behalf. Verify every requirement against the current official notification before relying on it.', { align: 'left' });
}

/* ------------------------------------------------------------------ *
 * Filing order
 *
 * An office reads a file from the top down, and the order is not arbitrary:
 * the form first, then who you are, then what proves the property is yours,
 * then that tax is clear, then the succession chain, then everything that
 * merely supports. Hand over a stack in a different order and it gets
 * reshuffled at the counter, and a reshuffled file is one that is set aside.
 *
 * This used to emit whatever order the documents happened to sit in inside the
 * case object — which is insertion order, and means nothing. Telling a citizen
 * "assemble in this order" against a meaningless order was the least accurate
 * thing in the packet.
 * ------------------------------------------------------------------ */

// carryOriginal marks the documents a counter commonly asks to see in original
// alongside the copy — the registered, issued and certified ones. The form, the
// photograph and the affidavits ARE the originals being submitted, and a
// utility bill is not something anyone asks to verify.
const FILING_ORDER = [
  { kind: 'application_form', group: 'Top sheet' },
  { kind: 'photo', group: 'Top sheet' },
  { kind: 'aadhaar', group: 'Identity', carryOriginal: true },
  { kind: 'sale_deed', group: 'Title', carryOriginal: true },
  { kind: 'khata_extract', group: 'Current record', carryOriginal: true },
  { kind: 'tax_receipt', group: 'Tax clearance', carryOriginal: true },
  { kind: 'death_certificate', group: 'Succession', carryOriginal: true },
  { kind: 'legal_heir_certificate', group: 'Succession', carryOriginal: true },
  { kind: 'noc_affidavit', group: 'Succession' },
  { kind: 'encumbrance_certificate', group: 'Supporting', carryOriginal: true },
  { kind: 'bescom_bill', group: 'Supporting' }
];

const ENCLOSURE_LABELS = {
  application_form: 'Signed transfer application',
  photo: 'Passport photograph',
  aadhaar: 'Aadhaar (for eKYC)',
  sale_deed: 'Sale deed',
  khata_extract: 'Property Mutation extract',
  tax_receipt: 'Property tax receipts',
  death_certificate: 'Death certificate',
  legal_heir_certificate: 'Legal heir certificate',
  noc_affidavit: 'No-objection affidavit',
  encumbrance_certificate: 'Encumbrance certificate',
  bescom_bill: 'Electricity bill'
};

const docField = (docs, kind, name) => docs.find((d) => d.kind === kind)?.fields?.[name];

/** One line of detail per enclosure, so a clerk can identify it without opening it. */
function enclosureDetail(kind, docs) {
  const of = (name) => docField(docs, kind, name);
  const join = (parts) => parts.filter(Boolean).join(' · ');
  switch (kind) {
    case 'sale_deed':
      return join([of('registrationNumber') && 'Registration ' + of('registrationNumber'),
        of('executionDate') && 'executed ' + of('executionDate')]);
    case 'khata_extract':
      return join([of('property mutationNumber') && 'Property Mutation ' + of('property mutationNumber'),
        of('issuedDate') && 'issued ' + of('issuedDate')]);
    case 'tax_receipt': {
      // Sorted, because the thing being checked here is a consecutive run.
      // Printed in attachment order, 2023-24, 2022-23, 2024-25 reads as a gap
      // to anyone scanning it, and invites a question that has no basis.
      const years = docs.filter((d) => d.kind === 'tax_receipt')
        .map((d) => d.fields?.financialYear).filter(Boolean).sort();
      return years.length ? years.length + ' receipts — ' + years.join(', ') : '';
    }
    case 'death_certificate':
      return join([of('deceasedName'), of('dateOfDeath') && 'died ' + of('dateOfDeath')]);
    case 'legal_heir_certificate': {
      const heirs = of('heirs') || [];
      return join([of('issuingAuthority'), heirs.length ? heirs.length + ' heirs named' : '']);
    }
    case 'noc_affidavit': {
      const from = docs.filter((d) => d.kind === 'noc_affidavit').map((d) => d.fields?.fromName).filter(Boolean);
      return from.length ? 'From ' + from.join(', ') : '';
    }
    case 'encumbrance_certificate':
      return of('periodFrom') ? 'Covers ' + of('periodFrom') + ' to ' + of('periodTo') : '';
    case 'bescom_bill':
      return join([of('rrNumber') && 'RR ' + of('rrNumber'), of('billMonth')]);
    case 'aadhaar':
      return 'Carried for eKYC at the counter. Do not hand the number to anyone offering to process it for you.';
    default:
      return '';
  }
}

/**
 * Builds the enclosure index in filing order, collapsing repeats (three tax
 * receipts are one enclosure with three years named on it, not three anonymous
 * lines) and — the part that was missing entirely — listing what is NOT in the
 * stack. A citizen assembling from the old list would have read it as complete.
 */
function buildEnclosureIndex(caseData, evaluation) {
  const docs = caseData.documents || [];
  const present = new Set(docs.map((d) => d.kind).filter(Boolean));
  const required = new Set(evaluation?.documents?.missingRequired || []);
  const recommended = new Set(evaluation?.documents?.missingRecommended || []);

  const rows = [];
  const absent = [];
  for (const { kind, group, carryOriginal } of FILING_ORDER) {
    if (present.has(kind)) {
      rows.push({ label: ENCLOSURE_LABELS[kind] || kind, group, detail: enclosureDetail(kind, docs), present: true, carryOriginal: Boolean(carryOriginal) });
    } else if (required.has(kind) || recommended.has(kind)) {
      absent.push({ label: ENCLOSURE_LABELS[kind] || kind, group, required: required.has(kind) });
    }
  }

  // If the rule pack ever grows a document kind that nobody added here, it goes
  // on the end rather than silently vanishing from the index. An enclosure
  // dropped off the list is a worse failure than one in an odd position: the
  // citizen would leave the paper at home.
  const known = new Set(FILING_ORDER.map((entry) => entry.kind));
  for (const kind of new Set(docs.map((d) => d.kind).filter((k) => k && !known.has(k)))) {
    rows.push({ label: ENCLOSURE_LABELS[kind] || kind, group: 'Supporting', detail: '', present: true });
  }

  return { rows, absent };
}

/** A drawn box beats a glyph: PDFKit's Helvetica has no ballot character. */
function enclosureRow(doc, { index, label, detail, group, present }) {
  if (doc.y > doc.page.height - 130) doc.addPage();
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const top = doc.y;

  doc.save().rect(left, top + 2.4, 8.5, 8.5).lineWidth(0.9)
    .strokeColor(present ? '#9aa39a' : '#c9822b').stroke().restore();

  // Absent enclosures carry no number. The number means "position in the file",
  // and a paper you do not have yet has no position — numbering it invites the
  // citizen to read the list as nine things they are holding.
  doc.font('Helvetica-Bold').fontSize(9).fillColor(MUTED)
    .text(index == null ? '' : String(index).padStart(2, '0'), left + 15, top, { width: 18 });

  doc.font(present ? 'Helvetica' : 'Helvetica-Oblique').fontSize(10.4)
    .fillColor(present ? INK : '#8a5a12')
    .text(present ? label : label + '  —  NOT ENCLOSED', left + 36, top, { width: width - 130 });
  const afterLabel = doc.y;

  doc.font('Helvetica').fontSize(7.4).fillColor(MUTED)
    .text(group.toUpperCase(), left + width - 92, top + 1.6, { width: 92, align: 'right', characterSpacing: 0.5 });

  doc.y = afterLabel;
  if (detail) {
    doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(detail, left + 36, doc.y, { width: width - 130 });
  }
  doc.moveDown(0.34);
  doc.x = left;
}

/**
 * What the law allows the office, and what follows when it does not.
 *
 * This is the section the whole product exists for. A citizen standing at a
 * counter who knows the service has a stipulated period, knows which officer
 * is answerable for it, and knows an appeal exists the day it lapses is a
 * different citizen from one who does not — and none of that was on the paper
 * they carried. The clock module already held every one of these numbers; the
 * packet simply left a blank line for the citizen to write "days allowed" into.
 *
 * Everything printed here is marked verified in the SLA table. The caveat is
 * printed with it rather than dropped, because the quantum on the day is the
 * one on the acknowledgement slip.
 */
function entitlement(doc, service = 'khata-transfer') {
  const sla = SERVICE_SLA[service];
  if (!sla) return;

  section(doc, 'What the law allows this office');
  kv(doc, 'Service as notified', sla.serviceName);
  kv(doc, 'Stipulated period', `${sla.days} ${sla.unit}, counted from the date on your acknowledgement`);
  kv(doc, 'Answerable officer', sla.designatedOfficerRole);
  kv(doc, 'Under', `${sla.framework} (last verified ${sla.lastVerified})`);
  doc.font('Helvetica').fontSize(9.2).fillColor(MUTED).text(sla.caveat, { lineGap: 1.2 });

  doc.moveDown(0.8);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text('If the period lapses and nothing has happened:');
  doc.moveDown(0.4);

  ESCALATION_LADDER.forEach((rung, i) => {
    if (doc.y > doc.page.height - 130) doc.addPage();
    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const top = doc.y;
    doc.font('Helvetica-Bold').fontSize(10).fillColor(INK)
      .text(`${i + 1}.  ${rung.label}`, left, top, { width: width - 120 });
    const afterTitle = doc.y;
    doc.font('Helvetica').fontSize(8.8).fillColor(MUTED)
      .text(rung.availableAfterDays === 0
        ? 'the day it lapses'
        : `+${rung.availableAfterDays} days`, left + width - 120, top + 1.4, { width: 120, align: 'right' });
    doc.y = afterTitle;
    doc.font('Helvetica').fontSize(9.4).fillColor(INK)
      .text(`To the ${rung.addressedToRole}. To be disposed of within ${rung.disposalDays} days.`, left, doc.y, { width: width - 120, lineGap: 1 });
    doc.font('Helvetica-Oblique').fontSize(8.4).fillColor(MUTED)
      .text(rung.basis, left, doc.y, { width: width - 120 });
    doc.moveDown(0.5);
    doc.x = left;
  });

  doc.font('Helvetica').fontSize(9.4).fillColor(INK).text(
    'You do not have to draft any of these. Enter your acknowledgement number in JanSahayak and each one is prepared for you on the day it becomes available, with the dates already counted.',
    { lineGap: 1.3 }
  );
}

/** A ruled line for something that has to be written in by hand. */
function writeInBox(doc, labels, height = 21) {
  const left = doc.page.margins.left;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  for (const label of labels) {
    if (doc.y > doc.page.height - 110) doc.addPage();
    const top = doc.y;
    doc.font('Helvetica').fontSize(9).fillColor(MUTED).text(label, left, top, { width: 150 });
    doc.save().moveTo(left + 155, top + 10.5).lineTo(left + width, top + 10.5)
      .lineWidth(0.7).strokeColor(RULE).stroke().restore();
    doc.y = top + height;
    doc.x = left;
  }
  doc.moveDown(0.3);
}

/* ------------------------------------------------------------------ *
 * 1. Submission packet — the stack you hand across the counter
 * ------------------------------------------------------------------ */

export function streamPacket(res, { caseData, evaluation, jurisdiction, language = 'en' }) {
  const doc = startDoc(res, 'jansahayak-kaam-submission-packet.pdf');
  const office = jurisdiction?.candidates?.[0];
  const applicant = caseData.applicant?.name || 'Applicant';
  const docs = caseData.documents || [];
  const { rows, absent } = buildEnclosureIndex(caseData, evaluation);

  letterhead(doc, 'Property Mutation transfer — submission packet',
    'Prepared ' + formatDate(new Date(), 'en') + ' for ' + applicant);

  /* --- who, and where it goes ---------------------------------- */
  section(doc, 'Applicant and office');
  kv(doc, 'Applicant', applicant);
  kv(doc, 'Service', caseData.variant === 'sale' ? 'Property Mutation transfer after purchase' : 'Property Mutation transfer after inheritance');
  kv(doc, 'Corporation', office?.corporation || 'Not yet resolved');
  kv(doc, 'Zone / sub-division', office?.zone);
  kv(doc, 'Counter', office?.office);
  if (jurisdiction?.confidence === 'contested') {
    doc.fillColor('#8a5a12').font('Helvetica-Bold').fontSize(9.6).text(
      'Boundary case. Telephone this office and quote the property ID below before travelling. If the record is not with them, the alternate office is named at the end of this packet — you are being redirected, not turned away.',
      { lineGap: 1.2 }
    );
    doc.moveDown(0.4).fillColor(INK).font('Helvetica').fontSize(10.5);
  }

  /* --- the identifiers a clerk actually looks the file up by ---- */
  section(doc, 'Property identification');
  kv(doc, 'Property ID (PID)', docField(docs, 'khata_extract', 'pid') || docField(docs, 'sale_deed', 'pid'));
  kv(doc, 'Property Mutation number', docField(docs, 'khata_extract', 'property mutationNumber'));
  kv(doc, 'Survey number', docField(docs, 'khata_extract', 'surveyNumber') || docField(docs, 'sale_deed', 'surveyNumber'));
  const extent = docField(docs, 'khata_extract', 'extentSqFt');
  kv(doc, 'Extent on record', extent ? extent + ' sq ft' : null);
  kv(doc, 'Property address', docField(docs, 'khata_extract', 'address') || caseData.address);

  /* --- the index ------------------------------------------------ */
  section(doc, 'Enclosure index — assemble in this order');
  doc.font('Helvetica').fontSize(9.2).fillColor(MUTED).text(
    'Tick each box as you place the paper in the file. The order is the order an office reads a file in: the form, then who you are, then what proves the property is yours, then that tax is clear, then the succession chain, then supporting papers.',
    { lineGap: 1.2 }
  );
  doc.moveDown(0.6);

  rows.forEach((row, i) => enclosureRow(doc, Object.assign({}, row, { index: i + 1 })));

  if (absent.length) {
    const req = absent.filter((a) => a.required).length;
    doc.moveDown(0.5);
    doc.font('Helvetica-Bold').fontSize(9.8).fillColor('#8a5a12').text(
      'NOT IN THIS STACK — ' + req + ' required, ' + (absent.length - req) + ' recommended',
      { characterSpacing: 0.5 }
    );
    doc.moveDown(0.35);
    absent.forEach((row) => enclosureRow(doc, {
      label: row.label + (row.required ? ' (required)' : ' (recommended)'),
      group: row.group,
      detail: '',
      present: false,
      index: null
    }));
  }

  doc.moveDown(0.35);
  doc.font('Helvetica-Bold').fontSize(10).fillColor(INK).text(
    rows.length + ' enclosure' + (rows.length === 1 ? '' : 's') + ' in this file'
    + (absent.length ? ', ' + absent.length + ' still to obtain.' : '.')
  );

  /* --- summary only; the evidence lives in the report ----------- */
  section(doc, 'Pre-flight summary');
  kv(doc, 'Blocking issues outstanding', String(evaluation?.counts?.blocks ?? 0));
  kv(doc, 'Issues that may draw an objection', String(evaluation?.counts?.delays ?? 0));
  kv(doc, 'Rules applied to this case',
    (evaluation?.scoreBasis?.rulesApplied ?? 0) + ' applied, ' + (evaluation?.scoreBasis?.rulesSkipped ?? 0)
    + ' not applicable · rule pack ' + (evaluation?.rulePack || '—'));
  doc.font('Helvetica').fontSize(9.2).fillColor(MUTED).text(
    'Every check, its evidence and its source is set out in the separate readiness report. Carry that one too: it is what answers "your papers are not in order" with a document name and a field.',
    { lineGap: 1.2 }
  );

  /* --- originals -------------------------------------------------- *
   * The declaration below undertakes to produce originals. Which ones was left
   * for the citizen to guess, and guessing wrong means a second trip.
   * ---------------------------------------------------------------- */
  const originals = rows.filter((row) => row.carryOriginal);
  if (originals.length) {
    section(doc, 'Carry the originals of these as well');
    doc.font('Helvetica').fontSize(9.2).fillColor(MUTED).text(
      'Counters commonly ask to see the original alongside the copy, and hand it straight back. The copies stay in the file; these do not.',
      { lineGap: 1.2 }
    );
    doc.moveDown(0.5);
    originals.forEach((row) => enclosureRow(doc, { ...row, detail: '', index: null }));
  }

  /* --- what the law allows the office ---------------------------- */
  entitlement(doc);

  /* --- declaration ---------------------------------------------- */
  section(doc, 'Declaration');
  doc.font('Helvetica').fontSize(10.2).fillColor(INK).text(
    'I submit the enclosures listed above in support of my application for transfer of property mutation in respect of the property identified above. The copies enclosed are true copies of the originals, which I am able to produce for verification.',
    { lineGap: 1.5 }
  );
  doc.moveDown(0.9);
  writeInBox(doc, ['Signature', 'Name in block letters', 'Mobile number', 'Date']);

  /* --- the counter ---------------------------------------------- */
  section(doc, 'At the counter');
  [
    'Hand the file over in the order above. If the enclosures come back reshuffled, ask for them back in order.',
    'Ask for an acknowledgement number and check that it is written on your copy. Without it there is no clock and no appeal.',
    'Ask which service name the application was booked under and how many days it is allowed. Both are printed on the acknowledgement slip.',
    'If you are told the papers are not in order, ask which enclosure and which field. The readiness report names every check that was run and what it found.',
    // Government fee: no number — we have not sourced the notified schedule,
    // and inventing one in the document meant to stop overcharging would be
    // the worst place to guess. Product fee (₹500) is named only as separate
    // from this counter — never as an amount to pay here.
    'Ask what the notified government fee is and pay it at the counter that issues a receipt. Money asked for without a receipt is not a fee, whatever it is called. JanSahayak’s own fixed ₹500 (when payment is enabled) is separate and is never paid at this counter.'
  ].forEach((line) => {
    doc.font('Helvetica').fontSize(10.3).fillColor(INK).text('•  ' + line, { lineGap: 1.2 });
    doc.moveDown(0.25);
  });

  /* --- the thing that starts the clock -------------------------- */
  section(doc, 'Write the acknowledgement here');
  doc.font('Helvetica').fontSize(9.4).fillColor(MUTED).text(
    'This number is what turns a wait into a right. Enter it in JanSahayak and the statutory deadline attaches to it.',
    { lineGap: 1.2 }
  );
  doc.moveDown(0.7);
  writeInBox(doc, ['Acknowledgement no.', 'Date of submission', 'Received by (counter)']);
  // The days are not a blank to be filled in — they are notified, and printed
  // above. The line to check is whether the slip agrees.
  doc.font('Helvetica').fontSize(9.2).fillColor(MUTED).text(
    `The slip should show ${SERVICE_SLA['khata-transfer'].days} ${SERVICE_SLA['khata-transfer'].unit}. If it shows fewer, that is in your favour. If it shows more, ask under which notification.`,
    { lineGap: 1.2 }
  );

  if (jurisdiction?.candidates?.length > 1) {
    section(doc, 'Alternate office (boundary case)');
    const alt = jurisdiction.candidates[1];
    kv(doc, 'Corporation', alt.corporation);
    kv(doc, 'Zone / sub-division', alt.zone);
    kv(doc, 'Counter', alt.office);
  }

  footer(doc, 'Generated by JanSahayak, an independent prototype. In this demonstration deployment every property record is synthetic. This packet has not been submitted to any office — you file it yourself. Not a government form and not affiliated with any government body.');
  paginate(doc, { title: 'Property Mutation transfer — submission packet', subject: applicant });
}

/* ------------------------------------------------------------------ *
 * 2. Readiness report — the one you keep in your hand
 * ------------------------------------------------------------------ */

export function streamReport(res, { caseData, evaluation }) {
  const doc = startDoc(res, 'jansahayak-kaam-readiness-report.pdf');
  letterhead(doc, 'Document readiness report',
    (caseData.applicant?.name || 'Applicant') + ' · rule pack ' + evaluation.rulePack + ' · ' + formatDate(new Date(), 'en'));

  section(doc, 'Verdict');
  const verdictText = {
    'will-be-refused': 'As things stand, this application would be refused at the counter.',
    'may-be-objected': 'This application would probably be accepted, then come back as an objection.',
    ready: 'Every applicable check passed. This application is ready to file.'
  }[evaluation.verdict];
  doc.font('Helvetica-Bold').fontSize(13).fillColor(INK).text(verdictText);
  doc.moveDown(0.5).font('Helvetica').fontSize(10).fillColor(MUTED).text(
    evaluation.counts.blocks + ' blocking · ' + evaluation.counts.delays + ' likely objection · '
    + evaluation.counts.advisory + ' worth knowing. Readiness ' + evaluation.score
    + '%, a severity-weighted pass rate over the ' + evaluation.scoreBasis.rulesApplied
    + ' rules that applied to this case.',
    { lineGap: 1.2 }
  );

  /* --- what to do, before what is wrong -------------------------- *
   * Ordered LONGEST FIRST, not by severity. These fixes do not depend on each
   * other, so the date you can file is set by the slowest one — which makes the
   * slowest the one to start today. Ordering by severity would have put a
   * one-day errand above a three-week certificate and quietly cost the citizen
   * three weeks. The engine already computes both numbers; the printable
   * artifact simply never showed them.
   * -------------------------------------------------------------- */
  const plan = (evaluation.fixPlan?.steps || []).slice().sort((a, b) => (b.expectedDays || 0) - (a.expectedDays || 0));
  if (plan.length) {
    section(doc, 'What to do, slowest first');
    doc.font('Helvetica').fontSize(9.4).fillColor(MUTED).text(
      'These do not depend on each other, so start the one at the top today — it is the one that decides when you can file.',
      { lineGap: 1.2 }
    );
    doc.moveDown(0.6);

    plan.forEach((step, i) => {
      if (doc.y > doc.page.height - 140) doc.addPage();
      const left = doc.page.margins.left;
      const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const top = doc.y;
      doc.save().rect(left, top + 2.6, 8.5, 8.5).lineWidth(0.9).strokeColor('#9aa39a').stroke().restore();
      doc.font('Helvetica-Bold').fontSize(10.4).fillColor(INK)
        .text((i + 1) + '.  ' + step.title, left + 15, top, { width: width - 90 });
      const afterTitle = doc.y;
      doc.font('Helvetica-Bold').fontSize(9.4).fillColor(step.severity === 'blocks' ? '#9a3412' : '#8a5a12')
        .text('~' + step.expectedDays + ' day' + (step.expectedDays === 1 ? '' : 's'),
          left + width - 66, top + 1.2, { width: 66, align: 'right' });
      doc.y = afterTitle;
      doc.font('Helvetica').fontSize(9.6).fillColor(INK).text(step.fix, left + 15, doc.y, { width: width - 90, lineGap: 1 });
      doc.font('Helvetica-Oblique').fontSize(8.8).fillColor(MUTED)
        .text(step.owner + ' · ' + step.where, left + 15, doc.y, { width: width - 90 });
      doc.moveDown(0.55);
      doc.x = left;
    });

    doc.font('Helvetica').fontSize(9.8).fillColor(INK).text(
      'Longest single fix: ' + evaluation.fixPlan.criticalPathDays + ' days. Done one after another instead: '
      + evaluation.fixPlan.serialDays + ' days. Run them together.'
    );
  }

  /* --- findings, grouped by what they cost you ------------------- *
   * Advisory splits in two, and the split is on expectedDays rather than on
   * the owner string: a finding that takes zero days to fix is one where there
   * is nothing to fix, and that is the group we can honestly say we examined
   * and declined to call a defect. Lumping a "download this month's bill"
   * suggestion under that heading would have claimed we did not flag something
   * we plainly did. expectedDays is a number, so the split survives the report
   * being generated for a case running in Kannada or Hindi; matching on the
   * owner text would not.
   * -------------------------------------------------------------- */
  const advisory = evaluation.findings.filter((f) => f.severity === 'advisory');
  const groups = [
    ['What will stop you at the counter', evaluation.findings.filter((f) => f.severity === 'blocks'), null],
    ['What will come back as an objection', evaluation.findings.filter((f) => f.severity === 'delays'), null],
    ['Worth doing, though none of it will stop you', advisory.filter((f) => f.expectedDays > 0),
      'None of these is a defect. Each is a small thing that removes something a counter could argue about.'],
    ['What we checked and deliberately did NOT call a defect', advisory.filter((f) => !(f.expectedDays > 0)),
      'A careless check would have called these defects and sent you off for affidavits you do not need. Each was examined and found not to be a problem. That decision matters as much as the ones above.']
  ];

  for (const [heading, items, note] of groups) {
    if (!items.length) continue;
    section(doc, heading);
    if (note) {
      doc.font('Helvetica').fontSize(9.4).fillColor(MUTED).text(note, { lineGap: 1.2 });
      doc.moveDown(0.5);
    }
    for (const finding of items) {
      if (doc.y > doc.page.height - 190) doc.addPage();
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(finding.code + ' — ' + finding.title);
      // "fix typically takes 0 day(s)" was printed against findings that need no
      // fix at all, which reads as a defect with a suspiciously fast remedy.
      const lead = finding.expectedDays > 0
        ? 'fix typically takes ' + finding.expectedDays + ' day' + (finding.expectedDays === 1 ? '' : 's') + ' · '
        : '';
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED)
        .text(lead + finding.owner + ' · ' + finding.where);
      doc.moveDown(0.3).font('Helvetica').fontSize(10.5).fillColor(INK).text(finding.why, { lineGap: 1.3 });
      doc.moveDown(0.25).font('Helvetica-Bold').fontSize(10).fillColor(INK)
        .text('What to do: ', { continued: true }).font('Helvetica').text(finding.fix);
      doc.moveDown(0.25).font('Helvetica-Oblique').fontSize(9).fillColor(MUTED).text(
        'Why this answer — rule ' + finding.ruleId + ': ' + (finding.evidence?.note || '')
        + ' ' + (finding.evidence?.comparison || '')
      );
      if (finding.citation) {
        doc.font('Helvetica-Oblique').fontSize(8.5).fillColor(MUTED).text(
          'Source: ' + finding.citation.source + ' (last verified ' + finding.citation.lastVerified
          + (finding.citation.verified ? '' : ' — NOT traced to a published clause') + ')'
        );
      }
      doc.moveDown(0.8);
    }
  }

  // The same section appears in the packet. That is deliberate, not an
  // oversight: the packet is handed across the counter and stays there, so a
  // citizen who had it only in the packet would have given away the one page
  // telling them what the office owes them and what to do when it lapses. This
  // is the copy they walk home with.
  entitlement(doc);

  section(doc, 'How this verdict was reached');
  doc.font('Helvetica').fontSize(10).fillColor(INK).text(
    'A deterministic rule engine evaluated rule pack ' + evaluation.rulePack + ' against the fields in your documents. '
    + evaluation.scoreBasis.rulesApplied + ' rules applied to this case and ' + evaluation.scoreBasis.rulesSkipped
    + ' did not — a purchase is not checked for a death certificate, for instance — and rules that do not apply are '
    + 'excluded from the score rather than counted as passes. No language model took part in any verdict in this '
    + 'report. A model may have read text off a photograph, but every value it read was shown to you for confirmation '
    + 'before any rule ran.',
    { lineGap: 1.5 }
  );

  // Counted, not asserted. Saying "some requirements are counter practice" and
  // leaving the reader to tally them is the kind of soft disclosure that reads
  // as honesty while carrying no information.
  const cited = evaluation.findings.filter((f) => f.citation);
  const untraced = cited.filter((f) => !f.citation.verified).length;

  section(doc, 'What this report cannot tell you');
  [
    'Offices apply discretion. This reduces the risk of rejection; it cannot remove it.',
    untraced
      ? `${untraced} of the ${cited.length} findings above rest on counter practice we could not trace to a published clause. Each one says so under its own heading. Treat those as what an office is likely to ask for, not as what the law requires.`
      : 'Every finding above is traced to a published requirement.',
    'A field misread from a photograph and left uncorrected would produce a confident wrong answer. Check the values before relying on this.'
  ].forEach((line) => {
    doc.font('Helvetica').fontSize(9.6).fillColor(INK).text('•  ' + line, { lineGap: 1.2 });
    doc.moveDown(0.22);
  });

  footer(doc);
  paginate(doc, { title: 'Document readiness report', subject: caseData.applicant?.name || 'Applicant' });
}

/* ------------------------------------------------------------------ *
 * 3. Escalation letters
 * ------------------------------------------------------------------ */

const BODY = {
  'first-appeal': (facts, applicant) => [
    `I applied for ${facts.serviceName} on ${formatDate(facts.submittedAt, 'en')}. The application was received under acknowledgement number ${facts.acknowledgementNumber}.`,
    `The stipulated period for this service is ${facts.slaDays} calendar days, which expired on ${formatDate(facts.deadlineAt, 'en')}. As of today, ${formatDate(facts.today, 'en')}, ${facts.elapsedDays} days have elapsed since submission and the application is ${facts.daysOverdue} days beyond the stipulated period. No disposal has been communicated to me.`,
    `I therefore request that this appeal be registered and the application disposed of. I am informed that this appeal is to be disposed of within ${facts.disposalDays} days, that is by ${formatDate(facts.replyDueBy, 'en')}.`,
    'I request a written communication of the outcome, and if the application is to be rejected, the specific ground and the document or field relied upon.'
  ],
  'second-appeal': (facts) => [
    `I applied for ${facts.serviceName} on ${formatDate(facts.submittedAt, 'en')} under acknowledgement number ${facts.acknowledgementNumber}. The stipulated period of ${facts.slaDays} days expired on ${formatDate(facts.deadlineAt, 'en')}.`,
    `A first appeal was preferred after that date. The application remains undisposed ${facts.daysOverdue} days beyond the stipulated period, and the period allowed for disposal of the first appeal has also passed.`,
    `I therefore prefer this second appeal and request disposal within ${facts.disposalDays} days, that is by ${formatDate(facts.replyDueBy, 'en')}.`,
    'I request that the outcome, and the reason for the delay, be communicated to me in writing.'
  ],
  rti: (facts) => [
    'Under the Right to Information Act 2005, I request the following information in respect of the application described below.',
    `Application: ${facts.serviceName}. Acknowledgement number: ${facts.acknowledgementNumber}. Date of submission: ${formatDate(facts.submittedAt, 'en')}.`,
    'Information sought:',
    '  (a) the current status of the application;',
    '  (b) the file movement history, showing the date the file was received by each officer and the date it left them;',
    '  (c) the name of the designation (not the individual) currently holding the file;',
    '  (d) if the application has been rejected or returned, a copy of the order or endorsement and the ground recorded;',
    '  (e) the stipulated period notified for this service and the reason recorded, if any, for exceeding it.',
    `I am a citizen of India. The prescribed fee is enclosed / will be paid as directed. I request a reply within the ${facts.disposalDays} days allowed by the Act.`
  ]
};

const TITLES = {
  'first-appeal': 'First appeal — delay in a time-bound service',
  'second-appeal': 'Second appeal — continued delay in a time-bound service',
  rti: 'Application under the Right to Information Act, 2005'
};

export function streamEscalation(res, { facts, caseData }) {
  const applicant = caseData.applicant?.name || 'Applicant';
  const doc = startDoc(res, `jansahayak-kaam-${facts.rung.id}.pdf`);

  letterhead(doc, TITLES[facts.rung.id], `Draft prepared for ${applicant} to review, sign and file`);

  doc.font('Helvetica').fontSize(11).fillColor(INK);
  doc.text('To,');
  doc.font('Helvetica-Bold').text(facts.addressedToRole);
  doc.font('Helvetica').text(facts.office?.office || 'The office where the application was submitted');
  if (facts.office?.corporation) doc.text(facts.office.corporation);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').text('Subject: ', { continued: true }).font('Helvetica')
    .text(`${TITLES[facts.rung.id]} — acknowledgement ${facts.acknowledgementNumber}`);
  doc.moveDown(0.9);
  doc.text('Sir / Madam,');
  doc.moveDown(0.6);

  for (const paragraph of BODY[facts.rung.id](facts, applicant)) {
    doc.font('Helvetica').fontSize(11).fillColor(INK).text(paragraph, { align: 'left', lineGap: 2 });
    doc.moveDown(0.55);
  }

  doc.moveDown(0.6).text('Yours faithfully,');
  doc.moveDown(2.2);
  doc.font('Helvetica-Bold').text(applicant);
  doc.font('Helvetica').fontSize(10).fillColor(MUTED).text('Signature: ______________________     Date: ______________');
  doc.moveDown(0.4).text('Address and contact number to be filled in by hand before filing.');

  section(doc, 'The arithmetic behind this letter');
  doc.font('Helvetica').fontSize(9.6).fillColor(INK);
  [
    ['Submitted', formatDate(facts.submittedAt, 'en')],
    ['Stipulated period', `${facts.slaDays} calendar days`],
    ['Deadline', formatDate(facts.deadlineAt, 'en')],
    ['Today', formatDate(facts.today, 'en')],
    ['Days elapsed', String(facts.elapsedDays)],
    ['Days beyond the period', String(facts.daysOverdue)],
    ['Reply due by', formatDate(facts.replyDueBy, 'en')],
    ['Basis', facts.basis]
  ].forEach(([k, v]) => { doc.font('Helvetica-Bold').text(`${k}: `, { continued: true }).font('Helvetica').text(v); });

  footer(doc, 'Drafted by JanSahayak for you to review, sign and file yourself. It has NOT been sent to anybody. JanSahayak is an independent prototype, is not affiliated with any government body, and does not name or accuse any individual officer. Check the correct addressee and the current procedure before filing — the role named above is encoded from the published framework and may have changed.');
  doc.end();
}

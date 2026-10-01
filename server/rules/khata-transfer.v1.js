/**
 * RULE PACK: khata transfer (Bengaluru city corporations) — version 1
 *
 * A rule pack is data plus small pure predicates. Adding a second service to
 * this product means writing another file that looks exactly like this one; it
 * does not mean writing another scraper or touching the engine.
 *
 * Each rule:
 *   id           stable identifier used in the evidence trail
 *   code         the defect-ledger code emitted when the rule fails
 *   appliesWhen  a predicate over the case — rules that do not apply are not
 *                counted in the score, so a purchase case is not penalised for
 *                lacking a death certificate
 *   evaluate     returns null when the rule passes, or an evidence object
 *                naming exactly which documents and fields disagreed
 *
 * Nothing in this file produces prose. Prose lives in the defect ledger and is
 * keyed by code, which is why it can be cached per language rather than per
 * citizen.
 */

import {
  compareNames, sameSurveyNumber, samePid,
  normalizeFinancialYear, expectedFinancialYears, normalizePid
} from '../engine/text.js';

export const RULE_PACK_VERSION = 'khata-transfer@1.4.0';

/* ------------------------------------------------------------------ *
 * Required documents, by case variant
 * ------------------------------------------------------------------ */

export const DOCUMENT_KINDS = {
  sale_deed: { label: 'Sale deed', labelKn: 'ಕ್ರಯಪತ್ರ', labelHi: 'बिक्री विलेख' },
  khata_extract: { label: 'Khata extract', labelKn: 'ಖಾತಾ ಉದ್ಧೃತ', labelHi: 'खाता उद्धरण' },
  tax_receipt: { label: 'Property tax receipt', labelKn: 'ಆಸ್ತಿ ತೆರಿಗೆ ರಸೀದಿ', labelHi: 'संपत्ति कर रसीद', repeats: true },
  death_certificate: { label: 'Death certificate', labelKn: 'ಮರಣ ಪ್ರಮಾಣಪತ್ರ', labelHi: 'मृत्यु प्रमाणपत्र' },
  legal_heir_certificate: { label: 'Legal heir certificate', labelKn: 'ವಾರಸುದಾರ ಪ್ರಮಾಣಪತ್ರ', labelHi: 'वारिस प्रमाणपत्र' },
  aadhaar: { label: 'Aadhaar (for eKYC)', labelKn: 'ಆಧಾರ್ (ಇ-ಕೆವೈಸಿಗೆ)', labelHi: 'आधार (ई-केवाईसी हेतु)' },
  bescom_bill: { label: 'Electricity bill', labelKn: 'ವಿದ್ಯುತ್ ಬಿಲ್', labelHi: 'बिजली बिल' },
  encumbrance_certificate: { label: 'Encumbrance certificate', labelKn: 'ಋಣಭಾರ ಪ್ರಮಾಣಪತ್ರ', labelHi: 'भार-मुक्ति प्रमाणपत्र' },
  noc_affidavit: { label: 'No-objection affidavit', labelKn: 'ನಿರಾಕ್ಷೇಪಣಾ ಪ್ರಮಾಣಪತ್ರ', labelHi: 'अनापत्ति शपथपत्र', repeats: true },
  photo: { label: 'Passport photograph', labelKn: 'ಪಾಸ್‌ಪೋರ್ಟ್ ಭಾವಚಿತ್ರ', labelHi: 'पासपोर्ट फोटो' },
  application_form: { label: 'Signed application form', labelKn: 'ಸಹಿ ಮಾಡಿದ ಅರ್ಜಿ', labelHi: 'हस्ताक्षरित आवेदन' }
};

export const VARIANTS = {
  inheritance: {
    id: 'inheritance',
    label: 'Transfer after inheritance',
    labelKn: 'ವಾರಸಿನ ನಂತರ ವರ್ಗಾವಣೆ',
    labelHi: 'विरासत के बाद हस्तांतरण',
    required: ['sale_deed', 'khata_extract', 'tax_receipt', 'aadhaar', 'death_certificate', 'legal_heir_certificate'],
    recommended: ['bescom_bill', 'encumbrance_certificate', 'photo'],
    slaDays: 30
  },
  sale: {
    id: 'sale',
    label: 'Transfer after purchase',
    labelKn: 'ಖರೀದಿಯ ನಂತರ ವರ್ಗಾವಣೆ',
    labelHi: 'खरीद के बाद हस्तांतरण',
    required: ['sale_deed', 'khata_extract', 'tax_receipt', 'aadhaar'],
    recommended: ['bescom_bill', 'encumbrance_certificate', 'photo'],
    slaDays: 30
  }
};

export const TAX_YEARS_REQUIRED = 3;

/* ------------------------------------------------------------------ *
 * Helpers available to rules
 * ------------------------------------------------------------------ */

const one = (ctx, kind) => ctx.byKind[kind]?.[0] || null;
const all = (ctx, kind) => ctx.byKind[kind] || [];
const f = (doc, field) => (doc && doc.fields ? doc.fields[field] : undefined);

const ev = (note, comparison, docs = []) => ({ note, comparison, documents: docs });
const cite = (doc, field) => ({
  kind: doc.kind,
  fileName: doc.fileName,
  field,
  value: f(doc, field) === undefined || f(doc, field) === null ? '(absent)' : String(f(doc, field))
});

/** Verhoeff checksum — the algorithm Aadhaar numbers actually use. */
const D_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 2, 3, 4, 0, 6, 7, 8, 9, 5],
  [2, 3, 4, 0, 1, 7, 8, 9, 5, 6], [3, 4, 0, 1, 2, 8, 9, 5, 6, 7],
  [4, 0, 1, 2, 3, 9, 5, 6, 7, 8], [5, 9, 8, 7, 6, 0, 4, 3, 2, 1],
  [6, 5, 9, 8, 7, 1, 0, 4, 3, 2], [7, 6, 5, 9, 8, 2, 1, 0, 4, 3],
  [8, 7, 6, 5, 9, 3, 2, 1, 0, 4], [9, 8, 7, 6, 5, 4, 3, 2, 1, 0]
];
const P_TABLE = [
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], [1, 5, 7, 6, 2, 8, 3, 0, 9, 4],
  [5, 8, 0, 3, 7, 9, 6, 1, 4, 2], [8, 9, 1, 6, 0, 4, 3, 5, 2, 7],
  [9, 4, 5, 3, 1, 2, 6, 8, 7, 0], [4, 2, 8, 6, 5, 7, 3, 9, 0, 1],
  [2, 7, 9, 3, 8, 0, 6, 4, 1, 5], [7, 0, 4, 6, 9, 1, 3, 2, 5, 8]
];

export function isValidAadhaarFormat(raw = '') {
  const digits = String(raw).replace(/\D/g, '');
  if (digits.length !== 12) return false;
  if (digits[0] === '0' || digits[0] === '1') return false;
  let c = 0;
  const reversed = digits.split('').reverse().map(Number);
  reversed.forEach((digit, index) => { c = D_TABLE[c][P_TABLE[index % 8][digit]]; });
  return c === 0;
}

const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/* ------------------------------------------------------------------ *
 * The rules
 * ------------------------------------------------------------------ */

export const RULES = [
  /* --- presence ------------------------------------------------- */
  ...['sale_deed', 'khata_extract', 'aadhaar'].map((kind, i) => ({
    id: `R-PRESENCE-${String(i + 1).padStart(2, '0')}`,
    code: { sale_deed: 'DOC-01', khata_extract: 'DOC-02', aadhaar: 'DOC-04' }[kind],
    appliesWhen: (ctx) => ctx.variant.required.includes(kind),
    evaluate: (ctx) => (one(ctx, kind) ? null : ev(
      `No document of kind "${kind}" was supplied.`,
      `required by ${ctx.variant.id} variant · found 0`,
      []
    ))
  })),
  {
    id: 'R-PRESENCE-04',
    code: 'DOC-03',
    appliesWhen: (ctx) => ctx.variant.required.includes('tax_receipt'),
    evaluate: (ctx) => (all(ctx, 'tax_receipt').length ? null : ev(
      'No property tax receipts were supplied.',
      `required ${TAX_YEARS_REQUIRED} consecutive years · found 0`,
      []
    ))
  },
  {
    id: 'R-PRESENCE-05',
    code: 'DOC-07',
    appliesWhen: (ctx) => ctx.variant.id === 'inheritance',
    evaluate: (ctx) => (one(ctx, 'death_certificate') ? null : ev(
      'Inheritance transfer without a death certificate.',
      'required for inheritance variant · found 0',
      []
    ))
  },
  {
    id: 'R-PRESENCE-06',
    code: 'DOC-08',
    appliesWhen: (ctx) => ctx.variant.id === 'inheritance',
    evaluate: (ctx) => (one(ctx, 'legal_heir_certificate') ? null : ev(
      'Inheritance transfer without a document establishing who inherits.',
      'required for inheritance variant · found 0',
      []
    ))
  },
  {
    id: 'R-PRESENCE-07',
    code: 'DOC-05',
    appliesWhen: () => true,
    evaluate: (ctx) => (one(ctx, 'bescom_bill') ? null : ev(
      'No electricity bill supplied to tie the property to an address.',
      'recommended enclosure · found 0',
      []
    ))
  },
  {
    id: 'R-PRESENCE-08',
    code: 'DOC-06',
    appliesWhen: () => true,
    evaluate: (ctx) => (one(ctx, 'encumbrance_certificate') ? null : ev(
      'No encumbrance certificate supplied.',
      'recommended enclosure · found 0',
      []
    ))
  },
  {
    id: 'R-PRESENCE-09',
    code: 'DOC-10',
    appliesWhen: () => true,
    evaluate: (ctx) => (one(ctx, 'photo') ? null : ev('No passport photograph supplied.', 'recommended enclosure · found 0', []))
  },
  {
    id: 'R-PRESENCE-10',
    code: 'DOC-09',
    appliesWhen: (ctx) => Boolean(one(ctx, 'application_form')),
    evaluate: (ctx) => {
      const doc = one(ctx, 'application_form');
      return f(doc, 'signed') === false
        ? ev('The application form is present but unsigned.', 'signed = false', [cite(doc, 'signed')])
        : null;
    }
  },
  {
    id: 'R-PRESENCE-11',
    code: 'DOC-11',
    appliesWhen: (ctx) => {
      const heir = one(ctx, 'legal_heir_certificate');
      return Boolean(heir) && (f(heir, 'heirs') || []).length > 1;
    },
    evaluate: (ctx) => {
      const heir = one(ctx, 'legal_heir_certificate');
      const heirs = f(heir, 'heirs') || [];
      const others = heirs.filter((name) => compareNames(name, ctx.applicant.name).verdict === 'mismatch');
      const nocs = all(ctx, 'noc_affidavit');
      const covered = others.filter((name) => nocs.some((n) => compareNames(f(n, 'fromName'), name).verdict !== 'mismatch'));
      if (covered.length >= others.length) return null;
      const missing = others.filter((name) => !covered.includes(name));
      return ev(
        `${missing.length} of ${others.length} co-heirs have not given a no-objection.`,
        `co-heirs on record: ${others.join(', ')} · no-objections held: ${covered.length}`,
        [cite(heir, 'heirs')]
      );
    }
  },

  /* --- name consistency ------------------------------------------ */
  /*
   * The khata should currently stand in the name of whoever the deed says holds
   * the property *before* this transfer. For an inheritance that is the deed's
   * owner (the deceased). For a purchase that is the seller — the khata being
   * in the seller's name is not a defect, it is the entire reason the citizen
   * is here. Getting this distinction wrong would flag every honest buyer.
   */
  {
    id: 'R-NAME-01',
    code: 'NAME-01',
    appliesWhen: (ctx) => Boolean(one(ctx, 'sale_deed') && one(ctx, 'khata_extract')),
    evaluate: (ctx) => {
      const deed = one(ctx, 'sale_deed');
      const khata = one(ctx, 'khata_extract');
      const field = ctx.variant.id === 'sale' ? 'sellerName' : 'ownerName';
      const expected = f(deed, field);
      if (!expected) return null;
      const result = compareNames(expected, f(khata, 'ownerName'));
      if (result.verdict !== 'mismatch') return null;
      return ev(
        ctx.variant.id === 'sale'
          ? 'The khata does not stand in the name of the person who sold you the property.'
          : 'The deed and the khata name different people as owner.',
        `deed ${field} "${expected}" vs khata ownerName "${f(khata, 'ownerName')}" — match score ${result.score}; ${result.explanation}`,
        [cite(deed, field), cite(khata, 'ownerName')]
      );
    }
  },
  {
    id: 'R-NAME-02',
    code: 'NAME-07',
    appliesWhen: (ctx) => Boolean(one(ctx, 'sale_deed') && one(ctx, 'khata_extract')),
    evaluate: (ctx) => {
      const deed = one(ctx, 'sale_deed');
      const khata = one(ctx, 'khata_extract');
      const field = ctx.variant.id === 'sale' ? 'sellerName' : 'ownerName';
      const expected = f(deed, field);
      if (!expected) return null;
      const result = compareNames(expected, f(khata, 'ownerName'));
      if (result.verdict !== 'probable') return null;
      return ev(
        'The names align once initials and spelling are accounted for, but they are not written identically. We are NOT calling this a mismatch — you do not need an affidavit for it.',
        `"${expected}" ≈ "${f(khata, 'ownerName')}" — match score ${result.score}; ${result.explanation}`,
        [cite(deed, field), cite(khata, 'ownerName')]
      );
    }
  },
  {
    id: 'R-NAME-03',
    code: 'NAME-02',
    appliesWhen: (ctx) => Boolean(one(ctx, 'khata_extract')) && all(ctx, 'tax_receipt').length > 0,
    evaluate: (ctx) => {
      const khata = one(ctx, 'khata_extract');
      const offenders = all(ctx, 'tax_receipt')
        .map((receipt) => ({ receipt, result: compareNames(f(khata, 'ownerName'), f(receipt, 'assesseeName')) }))
        .filter((x) => x.result.verdict === 'mismatch');
      if (!offenders.length) return null;
      const first = offenders[0];
      return ev(
        `${offenders.length} tax receipt(s) are assessed to a different name from the khata.`,
        `khata "${f(khata, 'ownerName')}" vs receipt "${f(first.receipt, 'assesseeName')}" — match score ${first.result.score}`,
        [cite(khata, 'ownerName'), cite(first.receipt, 'assesseeName')]
      );
    }
  },
  {
    id: 'R-NAME-04',
    code: 'NAME-03',
    appliesWhen: (ctx) => Boolean(one(ctx, 'aadhaar')),
    evaluate: (ctx) => {
      const aadhaar = one(ctx, 'aadhaar');
      const result = compareNames(f(aadhaar, 'name'), ctx.applicant.name);
      if (result.verdict !== 'mismatch') return null;
      return ev(
        'eKYC compares these two strings directly and will stop here.',
        `Aadhaar "${f(aadhaar, 'name')}" vs applicant "${ctx.applicant.name}" — match score ${result.score}`,
        [cite(aadhaar, 'name')]
      );
    }
  },
  {
    id: 'R-NAME-05',
    code: 'NAME-06',
    appliesWhen: (ctx) => Boolean(one(ctx, 'death_certificate') && one(ctx, 'khata_extract')),
    evaluate: (ctx) => {
      const death = one(ctx, 'death_certificate');
      const khata = one(ctx, 'khata_extract');
      const result = compareNames(f(death, 'deceasedName'), f(khata, 'ownerName'));
      if (result.verdict !== 'mismatch') return null;
      return ev(
        'The person on the death certificate is not the person on the khata.',
        `death certificate "${f(death, 'deceasedName')}" vs khata "${f(khata, 'ownerName')}" — match score ${result.score}`,
        [cite(death, 'deceasedName'), cite(khata, 'ownerName')]
      );
    }
  },
  {
    id: 'R-NAME-06',
    code: 'NAME-05',
    appliesWhen: (ctx) => Boolean(one(ctx, 'khata_extract')),
    evaluate: (ctx) => {
      const khata = one(ctx, 'khata_extract');
      // Deliberately strict: only an unambiguous match counts as "you are the
      // owner". A merely probable match (a shared surname, say) still has to
      // show the chain, because a shared surname is not a title.
      const isOwner = compareNames(f(khata, 'ownerName'), ctx.applicant.name).verdict === 'match';
      if (isOwner) return null;
      // Not the owner — that is fine, provided the chain to the applicant exists.
      const heir = one(ctx, 'legal_heir_certificate');
      const death = one(ctx, 'death_certificate');
      const deed = one(ctx, 'sale_deed');
      const heirNames = f(heir, 'heirs') || [];
      const namedAsHeir = heirNames.some((name) => compareNames(name, ctx.applicant.name).verdict !== 'mismatch');
      const boughtIt = deed && compareNames(f(deed, 'ownerName'), ctx.applicant.name).verdict !== 'mismatch';
      if ((death && heir && namedAsHeir) || boughtIt) return null;
      return ev(
        'The applicant is neither the recorded owner nor connected to the recorded owner by any supplied document.',
        `khata owner "${f(khata, 'ownerName')}" · applicant "${ctx.applicant.name}" · heirship document ${heir ? 'present' : 'absent'} · applicant named as heir: ${namedAsHeir}`,
        [cite(khata, 'ownerName')]
      );
    }
  },
  {
    id: 'R-NAME-07',
    code: 'NAME-04',
    appliesWhen: (ctx) => Boolean(one(ctx, 'bescom_bill') && one(ctx, 'khata_extract')),
    evaluate: (ctx) => {
      const bill = one(ctx, 'bescom_bill');
      const khata = one(ctx, 'khata_extract');
      const result = compareNames(f(bill, 'consumerName'), f(khata, 'ownerName'));
      if (result.verdict !== 'mismatch') return null;
      return ev(
        'The electricity connection is in a different name.',
        `bill "${f(bill, 'consumerName')}" vs khata "${f(khata, 'ownerName')}"`,
        [cite(bill, 'consumerName'), cite(khata, 'ownerName')]
      );
    }
  },
  {
    id: 'R-NAME-08',
    code: 'INH-02',
    appliesWhen: (ctx) => (f(one(ctx, 'legal_heir_certificate'), 'heirs') || []).length > 1,
    evaluate: (ctx) => {
      const heir = one(ctx, 'legal_heir_certificate');
      const heirs = f(heir, 'heirs') || [];
      return ev(
        `The heirship record names ${heirs.length} heirs.`,
        `heirs on record: ${heirs.join(', ')}`,
        [cite(heir, 'heirs')]
      );
    }
  },

  /* --- identifier consistency ------------------------------------ */
  {
    id: 'R-ID-01',
    code: 'ID-01',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'sale_deed'), 'surveyNumber') && f(one(ctx, 'khata_extract'), 'surveyNumber')),
    evaluate: (ctx) => {
      const deed = one(ctx, 'sale_deed');
      const khata = one(ctx, 'khata_extract');
      const cmp = sameSurveyNumber(f(deed, 'surveyNumber'), f(khata, 'surveyNumber'));
      if (cmp.same !== false) return null;
      return ev(
        'After normalising formatting, the two survey numbers are still different.',
        `deed "${f(deed, 'surveyNumber')}" → ${cmp.a} · khata "${f(khata, 'surveyNumber')}" → ${cmp.b}`,
        [cite(deed, 'surveyNumber'), cite(khata, 'surveyNumber')]
      );
    }
  },
  {
    id: 'R-ID-02',
    code: 'ID-02',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'khata_extract'), 'pid')) && all(ctx, 'tax_receipt').length > 0,
    evaluate: (ctx) => {
      const khata = one(ctx, 'khata_extract');
      const offenders = all(ctx, 'tax_receipt').filter((r) => samePid(f(khata, 'pid'), f(r, 'pid')).same === false);
      if (!offenders.length) return null;
      return ev(
        `${offenders.length} tax receipt(s) carry a different property ID.`,
        `khata PID ${normalizePid(f(khata, 'pid'))} · receipt PID ${normalizePid(f(offenders[0], 'pid'))}`,
        [cite(khata, 'pid'), cite(offenders[0], 'pid')]
      );
    }
  },
  {
    id: 'R-ID-03',
    code: 'ID-04',
    appliesWhen: (ctx) => Boolean(one(ctx, 'khata_extract')),
    evaluate: (ctx) => {
      const khata = one(ctx, 'khata_extract');
      return normalizePid(f(khata, 'pid')) ? null : ev(
        'The khata extract does not carry a property ID.',
        'pid = (absent)',
        [cite(khata, 'pid')]
      );
    }
  },
  {
    id: 'R-ID-04',
    code: 'ID-05',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'sale_deed'), 'extentSqFt') && f(one(ctx, 'khata_extract'), 'extentSqFt')),
    evaluate: (ctx) => {
      const deed = one(ctx, 'sale_deed');
      const khata = one(ctx, 'khata_extract');
      const a = Number(f(deed, 'extentSqFt'));
      const b = Number(f(khata, 'extentSqFt'));
      if (!a || !b) return null;
      const drift = Math.abs(a - b) / Math.max(a, b);
      if (drift <= 0.05) return null;   // 5% tolerance for rounding between units
      return ev(
        'The recorded site extent differs by more than the 5% tolerance we allow for unit rounding.',
        `deed ${a} sq ft · khata ${b} sq ft · difference ${(drift * 100).toFixed(1)}%`,
        [cite(deed, 'extentSqFt'), cite(khata, 'extentSqFt')]
      );
    }
  },
  {
    id: 'R-ID-05',
    code: 'ID-03',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'khata_extract'), 'address') && f(one(ctx, 'bescom_bill'), 'address')),
    evaluate: (ctx) => {
      const khata = one(ctx, 'khata_extract');
      const bill = one(ctx, 'bescom_bill');
      const tokens = (s) => new Set(String(s).toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((t) => t.length > 2));
      const A = tokens(f(khata, 'address'));
      const B = tokens(f(bill, 'address'));
      const overlap = [...A].filter((t) => B.has(t)).length;
      const jaccard = overlap / Math.max(1, new Set([...A, ...B]).size);
      if (jaccard >= 0.34) return null;
      return ev(
        'The two addresses share very few words in common.',
        `khata "${f(khata, 'address')}" · bill "${f(bill, 'address')}" · overlap ${(jaccard * 100).toFixed(0)}%`,
        [cite(khata, 'address'), cite(bill, 'address')]
      );
    }
  },

  /* --- tax continuity -------------------------------------------- */
  {
    id: 'R-TAX-01',
    code: 'TAX-01',
    appliesWhen: (ctx) => all(ctx, 'tax_receipt').length > 0,
    evaluate: (ctx) => {
      const years = all(ctx, 'tax_receipt').map((r) => normalizeFinancialYear(f(r, 'financialYear'))).filter(Boolean);
      if (!years.length) return null;
      const startYears = years.map((y) => Number(y.slice(0, 4))).sort((a, b) => a - b);
      const latest = startYears[startYears.length - 1];
      const expected = expectedFinancialYears(latest, TAX_YEARS_REQUIRED);
      const missing = expected.filter((y) => !years.includes(y));
      if (!missing.length) return null;
      return ev(
        `The three-year run ending ${expected[expected.length - 1]} is broken.`,
        `required ${expected.join(', ')} · supplied ${[...new Set(years)].sort().join(', ')} · missing ${missing.join(', ')}`,
        all(ctx, 'tax_receipt').map((r) => cite(r, 'financialYear'))
      );
    }
  },
  {
    id: 'R-TAX-02',
    code: 'TAX-02',
    appliesWhen: (ctx) => all(ctx, 'tax_receipt').length > 0,
    evaluate: (ctx) => {
      const receipts = all(ctx, 'tax_receipt');
      const currentFyStart = ctx.today.getMonth() >= 3 ? ctx.today.getFullYear() : ctx.today.getFullYear() - 1;
      const mostRecentAllowed = [currentFyStart, currentFyStart - 1];
      const years = receipts.map((r) => Number(normalizeFinancialYear(f(r, 'financialYear')).slice(0, 4))).filter(Boolean);
      if (!years.length) return null;
      const latest = Math.max(...years);
      if (mostRecentAllowed.includes(latest)) return null;
      return ev(
        'The newest receipt supplied is older than the last completed assessment year.',
        `newest receipt ${latest}-${String((latest + 1) % 100).padStart(2, '0')} · current assessment year ${currentFyStart}-${String((currentFyStart + 1) % 100).padStart(2, '0')}`,
        [cite(receipts[0], 'financialYear')]
      );
    }
  },
  {
    id: 'R-TAX-03',
    code: 'TAX-03',
    appliesWhen: (ctx) => all(ctx, 'tax_receipt').length > 0,
    evaluate: (ctx) => {
      const withArrears = all(ctx, 'tax_receipt').filter((r) => Number(f(r, 'arrears') || 0) > 0);
      if (!withArrears.length) return null;
      const total = withArrears.reduce((sum, r) => sum + Number(f(r, 'arrears') || 0), 0);
      return ev(
        'At least one receipt shows an unpaid balance.',
        `arrears total ₹${total.toLocaleString('en-IN')} across ${withArrears.length} receipt(s)`,
        withArrears.map((r) => cite(r, 'arrears'))
      );
    }
  },
  {
    id: 'R-TAX-04',
    code: 'TAX-04',
    appliesWhen: (ctx) => all(ctx, 'tax_receipt').length > TAX_YEARS_REQUIRED,
    evaluate: (ctx) => ev(
      `${all(ctx, 'tax_receipt').length} receipts supplied where ${TAX_YEARS_REQUIRED} are required.`,
      `supplied ${all(ctx, 'tax_receipt').length} · required ${TAX_YEARS_REQUIRED}`,
      []
    )
  },

  /* --- format ----------------------------------------------------- */
  {
    id: 'R-FMT-01',
    code: 'FMT-01',
    appliesWhen: (ctx) => Boolean(one(ctx, 'sale_deed')) && f(one(ctx, 'sale_deed'), 'marketValue') != null,
    evaluate: (ctx) => {
      const deed = one(ctx, 'sale_deed');
      const value = Number(f(deed, 'marketValue'));
      const paid = Number(f(deed, 'stampDutyPaid'));
      if (!value || Number.isNaN(paid)) return null;
      // Conveyance duty in Karnataka sits around 5% for the slabs a city
      // property falls into; we allow a generous margin and only flag a clear
      // shortfall, because we would rather miss a marginal case than send
      // someone to a District Registrar they do not need.
      const expected = value * 0.05;
      if (paid >= expected * 0.85) return null;
      return ev(
        'Stamp duty paid is materially below the duty a conveyance of this value would normally attract.',
        `declared value ₹${value.toLocaleString('en-IN')} · duty paid ₹${paid.toLocaleString('en-IN')} · indicative duty ₹${Math.round(expected).toLocaleString('en-IN')}`,
        [cite(deed, 'stampDutyPaid'), cite(deed, 'marketValue')]
      );
    }
  },
  {
    id: 'R-FMT-02',
    code: 'FMT-02',
    appliesWhen: (ctx) => Boolean(one(ctx, 'sale_deed')),
    evaluate: (ctx) => {
      const deed = one(ctx, 'sale_deed');
      return f(deed, 'registrationNumber') ? null : ev(
        'The deed carries no registration number.',
        'registrationNumber = (absent)',
        [cite(deed, 'registrationNumber')]
      );
    }
  },
  {
    id: 'R-FMT-03',
    code: 'FMT-03',
    appliesWhen: (ctx) => ctx.documents.some((d) => f(d, 'signaturePresent') === false),
    evaluate: (ctx) => {
      const offenders = ctx.documents.filter((d) => f(d, 'signaturePresent') === false);
      return ev(
        `${offenders.length} document(s) have a signature block with no signature in it.`,
        offenders.map((d) => `${d.kind}: signaturePresent = false`).join(' · '),
        offenders.map((d) => cite(d, 'signaturePresent'))
      );
    }
  },
  {
    id: 'R-FMT-04',
    code: 'FMT-04',
    appliesWhen: (ctx) => ctx.documents.some((d) => f(d, 'expectedPageCount') && f(d, 'pageCount')),
    evaluate: (ctx) => {
      const offenders = ctx.documents.filter((d) => f(d, 'expectedPageCount') && Number(f(d, 'pageCount')) < Number(f(d, 'expectedPageCount')));
      if (!offenders.length) return null;
      const d = offenders[0];
      return ev(
        'A document is shorter than the page count printed on it.',
        `${d.kind}: ${f(d, 'pageCount')} of ${f(d, 'expectedPageCount')} pages present`,
        offenders.map((x) => cite(x, 'pageCount'))
      );
    }
  },
  {
    id: 'R-FMT-05',
    code: 'FMT-05',
    appliesWhen: (ctx) => ctx.documents.some((d) => typeof f(d, 'legibility') === 'number'),
    evaluate: (ctx) => {
      const offenders = ctx.documents.filter((d) => typeof f(d, 'legibility') === 'number' && f(d, 'legibility') < 0.6);
      if (!offenders.length) return null;
      const d = offenders[0];
      return ev(
        'At least one scan is below the legibility threshold we consider readable.',
        `${d.kind}: legibility ${Number(f(d, 'legibility')).toFixed(2)} · threshold 0.60`,
        offenders.map((x) => cite(x, 'legibility'))
      );
    }
  },
  {
    id: 'R-FMT-06',
    code: 'FMT-06',
    appliesWhen: (ctx) => Boolean(one(ctx, 'photo')),
    evaluate: (ctx) => {
      const photo = one(ctx, 'photo');
      const problems = [];
      if (f(photo, 'faceVisible') === false) problems.push('face not clearly visible');
      if (f(photo, 'plainBackground') === false) problems.push('background is not plain');
      if (Number(f(photo, 'widthPx') || 0) < 350) problems.push(`width ${f(photo, 'widthPx')}px is below 350px`);
      if (!problems.length) return null;
      return ev('The photograph does not meet the usual counter specification.', problems.join(' · '), [cite(photo, 'widthPx')]);
    }
  },
  {
    id: 'R-FMT-07',
    code: 'FMT-07',
    appliesWhen: (ctx) => Boolean(one(ctx, 'death_certificate') || one(ctx, 'legal_heir_certificate')),
    evaluate: (ctx) => {
      const needAttestation = [one(ctx, 'death_certificate'), one(ctx, 'legal_heir_certificate')].filter(Boolean);
      const offenders = needAttestation.filter((d) => f(d, 'attested') === false);
      if (!offenders.length) return null;
      return ev(
        `${offenders.length} succession document(s) are unattested copies.`,
        offenders.map((d) => `${d.kind}: attested = false`).join(' · '),
        offenders.map((d) => cite(d, 'attested'))
      );
    }
  },
  {
    id: 'R-FMT-08',
    code: 'FMT-08',
    appliesWhen: (ctx) => ctx.documents.some((d) => Number(d.fileSizeBytes || 0) > 0),
    evaluate: (ctx) => {
      const offenders = ctx.documents.filter((d) => Number(d.fileSizeBytes || 0) > 2 * 1024 * 1024);
      if (!offenders.length) return null;
      return ev(
        `${offenders.length} file(s) exceed the 2 MB upload limit portals commonly apply.`,
        offenders.map((d) => `${d.fileName}: ${(d.fileSizeBytes / 1048576).toFixed(1)} MB`).join(' · '),
        []
      );
    }
  },

  /* --- encumbrance ------------------------------------------------ */
  {
    id: 'R-ENC-01',
    code: 'ENC-01',
    appliesWhen: (ctx) => Boolean(one(ctx, 'encumbrance_certificate')),
    evaluate: (ctx) => {
      const doc = one(ctx, 'encumbrance_certificate');
      const entries = f(doc, 'entries') || [];
      const live = entries.filter((e) => e.type === 'mortgage' && e.status === 'subsisting');
      if (!live.length) return null;
      return ev(
        'A mortgage is recorded and has not been released.',
        live.map((e) => `${e.date}: mortgage in favour of ${e.party} — ${e.status}`).join(' · '),
        [cite(doc, 'entries')]
      );
    }
  },
  {
    id: 'R-ENC-02',
    code: 'ENC-03',
    appliesWhen: (ctx) => Boolean(one(ctx, 'encumbrance_certificate')),
    evaluate: (ctx) => {
      const doc = one(ctx, 'encumbrance_certificate');
      const entries = f(doc, 'entries') || [];
      const live = entries.filter((e) => e.type === 'attachment' && e.status === 'subsisting');
      if (!live.length) return null;
      return ev(
        'A court attachment is recorded against the property.',
        live.map((e) => `${e.date}: attachment — ${e.party}`).join(' · '),
        [cite(doc, 'entries')]
      );
    }
  },
  {
    id: 'R-ENC-03',
    code: 'ENC-02',
    appliesWhen: (ctx) => Boolean(one(ctx, 'encumbrance_certificate') && one(ctx, 'sale_deed')),
    evaluate: (ctx) => {
      const doc = one(ctx, 'encumbrance_certificate');
      const deed = one(ctx, 'sale_deed');
      const entries = (f(doc, 'entries') || []).filter((e) => e.type === 'sale');
      if (!entries.length) return null;
      const deedYear = String(f(deed, 'executionDate') || '').slice(0, 4);
      const unexplained = entries.filter((e) => String(e.date).slice(0, 4) !== deedYear);
      if (!unexplained.length) return null;
      return ev(
        'The EC records a registered transfer that does not correspond to the deed supplied.',
        `deed executed ${f(deed, 'executionDate')} · EC entry ${unexplained[0].date} (${unexplained[0].party})`,
        [cite(doc, 'entries'), cite(deed, 'executionDate')]
      );
    }
  },
  {
    id: 'R-ENC-04',
    code: 'DATE-03',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'encumbrance_certificate'), 'periodTo')),
    evaluate: (ctx) => {
      const doc = one(ctx, 'encumbrance_certificate');
      const gap = daysBetween(f(doc, 'periodTo'), ctx.today);
      if (gap <= 180) return null;
      return ev(
        'The EC stops well short of today, so recent entries would not appear on it.',
        `EC covers up to ${f(doc, 'periodTo')} · that is ${gap} days before today`,
        [cite(doc, 'periodTo')]
      );
    }
  },

  /* --- dates ------------------------------------------------------ */
  {
    id: 'R-DATE-01',
    code: 'DATE-01',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'death_certificate'), 'dateOfDeath') && f(one(ctx, 'legal_heir_certificate'), 'issuedDate')),
    evaluate: (ctx) => {
      const death = one(ctx, 'death_certificate');
      const heir = one(ctx, 'legal_heir_certificate');
      if (new Date(f(heir, 'issuedDate')) >= new Date(f(death, 'dateOfDeath'))) return null;
      return ev(
        'The heirship certificate was issued before the death it relies on.',
        `date of death ${f(death, 'dateOfDeath')} · heir certificate issued ${f(heir, 'issuedDate')}`,
        [cite(death, 'dateOfDeath'), cite(heir, 'issuedDate')]
      );
    }
  },
  {
    id: 'R-DATE-02',
    code: 'DATE-02',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'khata_extract'), 'issuedDate')),
    evaluate: (ctx) => {
      const khata = one(ctx, 'khata_extract');
      const age = daysBetween(f(khata, 'issuedDate'), ctx.today);
      if (age <= 365) return null;
      return ev(
        'The khata extract is older than the twelve months most counters accept.',
        `issued ${f(khata, 'issuedDate')} · ${age} days old today`,
        [cite(khata, 'issuedDate')]
      );
    }
  },
  {
    id: 'R-DATE-03',
    code: 'DATE-04',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'bescom_bill'), 'billMonth')),
    evaluate: (ctx) => {
      const bill = one(ctx, 'bescom_bill');
      const age = daysBetween(`${f(bill, 'billMonth')}-01`, ctx.today);
      if (age <= 95) return null;
      return ev(
        'The electricity bill is more than three months old.',
        `bill month ${f(bill, 'billMonth')} · ${age} days ago`,
        [cite(bill, 'billMonth')]
      );
    }
  },

  /* --- KYC --------------------------------------------------------- */
  {
    id: 'R-KYC-01',
    code: 'KYC-01',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'aadhaar'), 'number')),
    evaluate: (ctx) => {
      const aadhaar = one(ctx, 'aadhaar');
      const number = String(f(aadhaar, 'number'));
      if (isValidAadhaarFormat(number)) return null;
      return ev(
        'The number fails the Verhoeff checksum that all Aadhaar numbers satisfy.',
        `checked digits ending ${number.replace(/\D/g, '').slice(-4)} · checksum invalid`,
        [{ kind: 'aadhaar', fileName: aadhaar.fileName, field: 'number', value: `XXXX XXXX ${number.replace(/\D/g, '').slice(-4)}` }]
      );
    }
  },
  {
    id: 'R-KYC-02',
    code: 'KYC-02',
    appliesWhen: (ctx) => Boolean(f(one(ctx, 'aadhaar'), 'address') && f(one(ctx, 'khata_extract'), 'address')),
    evaluate: (ctx) => {
      const aadhaar = one(ctx, 'aadhaar');
      const khata = one(ctx, 'khata_extract');
      const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (norm(f(aadhaar, 'address')) === norm(f(khata, 'address'))) return null;
      return ev(
        'The Aadhaar address and the property address are different places.',
        'this is expected when the applicant does not live in the property',
        [cite(khata, 'address')]
      );
    }
  },

  /* --- inheritance advisories -------------------------------------- */
  {
    id: 'R-INH-01',
    code: 'INH-01',
    appliesWhen: (ctx) => Boolean(ctx.declared?.willExists),
    evaluate: (ctx) => (ctx.declared?.willProbated ? null : ev(
      'The citizen told us a will exists but has not been probated.',
      'declared: willExists = true, willProbated = false',
      []
    ))
  }
];

export const RULE_COUNT = RULES.length;

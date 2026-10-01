/**
 * SYNTHETIC CASE FIXTURES — Bhopal, Madhya Pradesh
 *
 * Every person, property, deed, receipt and number below is invented. No real
 * record was copied, transcribed or derived. The Aadhaar-format numbers are
 * sequential test values chosen only because they satisfy the public Verhoeff
 * checksum — they are not allocated to anybody, and the app never transmits
 * them anywhere.
 *
 * The fixtures exist so a reviewer with two minutes can see the engine make a
 * real decision without first having to find five property documents. Anything
 * a citizen uploads themselves goes through exactly the same engine.
 */

export const TODAY_ANCHOR = '2026-08-28';

/* ------------------------------------------------------------------ *
 * Persona 1 — Savita. Inheritance. The main demo path.
 * ------------------------------------------------------------------ */

const savitaDocuments = (corrected) => [
  {
    id: 'doc-deed', kind: 'sale_deed', fileName: 'sale-deed-2008.pdf',
    fileSizeBytes: 840_000, extractionSource: 'fixture',
    fields: {
      ownerName: 'Ramesh Gupta',
      sellerName: 'Sri. Hariprasad Gupta',
      surveyNumber: '142/1',
      pid: '3-12-789',
      extentSqFt: 1350,
      registrationNumber: 'BPL-1-00421/2008-09',
      executionDate: '2008-03-14',
      marketValue: 1_800_000,
      stampDutyPaid: 90_000,
      address: '14, Arera Colony E-7, Bhopal 462016',
      pageCount: 12, expectedPageCount: 12,
      signaturePresent: true,
      legibility: 0.90
    }
  },
  {
    id: 'doc-khata', kind: 'khata_extract', fileName: 'naksha-extract.pdf',
    fileSizeBytes: 210_000, extractionSource: 'fixture',
    fields: {
      ownerName: 'R. Gupta',
      khataNumber: 'KH/3/0891',
      pid: '3/12/789',
      surveyNumber: '142/1',
      extentSqFt: 1350,
      // Stale in the defective set — a real and very common cause of a wasted trip.
      issuedDate: corrected ? '2026-08-04' : '2025-01-10',
      address: '14, Arera Colony E-7, Bhopal 462016',
      pageCount: 2, expectedPageCount: 2,
      legibility: 0.88
    }
  },
  ...[
    ...(corrected ? [{ year: '2023-24', receipt: 'PT/2023/881204', paid: '2023-05-20' }] : []),
    { year: '2022-23', receipt: 'PT/2022/663801', paid: '2022-05-10' },
    { year: '2024-25', receipt: 'PT/2024/991230', paid: '2024-06-05' },
    { year: '2025-26', receipt: 'PT/2025/229041', paid: '2025-05-30' }
  ].map((entry, index) => ({
    id: `doc-tax-${index}`, kind: 'tax_receipt', fileName: `property-tax-${entry.year}.pdf`,
    fileSizeBytes: 96_000, extractionSource: 'fixture',
    fields: {
      assesseeName: 'Ramesh Gupta',
      pid: '3-12-789',
      financialYear: entry.year,
      receiptNumber: entry.receipt,
      paidDate: entry.paid,
      amountPaid: 5200,
      arrears: 0,
      legibility: 0.86
    }
  })),
  {
    id: 'doc-death', kind: 'death_certificate', fileName: 'death-certificate.jpg',
    fileSizeBytes: 1_400_000, extractionSource: 'fixture',
    fields: {
      deceasedName: 'Ramesh Gupta',
      dateOfDeath: '2025-10-18',
      registrationNumber: 'DTH/BPL/2025/33142',
      issuingAuthority: 'Registrar of Births and Deaths, Bhopal Municipal Corporation',
      // The blocking defect in the defective set.
      attested: corrected,
      legibility: 0.74
    }
  },
  {
    id: 'doc-heir', kind: 'legal_heir_certificate', fileName: 'legal-heir-certificate.pdf',
    fileSizeBytes: 180_000, extractionSource: 'fixture',
    fields: {
      deceasedName: 'Ramesh Gupta',
      heirs: ['Savita Gupta', 'Mohan Gupta'],
      issuedDate: '2026-02-10',
      issuingAuthority: 'Tehsildar, Bhopal Tehsil',
      attested: true,
      legibility: 0.90
    }
  },
  {
    id: 'doc-noc', kind: 'noc_affidavit', fileName: 'noc-mohan-gupta.pdf',
    fileSizeBytes: 120_000, extractionSource: 'fixture',
    fields: { fromName: 'Mohan Gupta', notarised: true, legibility: 0.89 }
  },
  {
    id: 'doc-aadhaar', kind: 'aadhaar', fileName: 'aadhaar-front.jpg',
    fileSizeBytes: 640_000, extractionSource: 'fixture',
    fields: {
      name: 'Savita Gupta',
      number: '234567890124',           // fictitious, checksum-valid only
      dob: '1981-07-12',
      address: '22, Zone-2, Arera Colony, Bhopal 462016',
      legibility: 0.93
    }
  },
  {
    id: 'doc-bescom', kind: 'bescom_bill', fileName: 'mpeb-bill.pdf',
    fileSizeBytes: 88_000, extractionSource: 'fixture',
    fields: {
      // Still in the grandfather's name — normal for an old family property,
      // and the engine must say so rather than flagging it as a problem.
      consumerName: 'Hariprasad Gupta',
      rrNumber: 'BPL-AC-221840',
      billMonth: '2026-04',
      address: '14, Arera Colony E-7, Bhopal 462016',
      legibility: 0.83
    }
  },
  {
    id: 'doc-ec', kind: 'encumbrance_certificate', fileName: 'ec-2014-2026.pdf',
    fileSizeBytes: 320_000, extractionSource: 'fixture',
    fields: {
      periodFrom: '2014-01-01',
      periodTo: '2026-06-30',
      entries: [
        { type: 'mortgage', date: '2015-03-22', party: 'Central Bank of India, Arera Colony Branch, Bhopal', status: 'released' }
      ],
      legibility: 0.79
    }
  },
  {
    id: 'doc-photo', kind: 'photo', fileName: 'passport-photo.jpg',
    fileSizeBytes: 42_000, extractionSource: 'fixture',
    fields: { widthPx: 420, heightPx: 540, faceVisible: true, plainBackground: true }
  },
  {
    id: 'doc-form', kind: 'application_form', fileName: 'namaantaran-application.pdf',
    fileSizeBytes: 64_000, extractionSource: 'fixture',
    fields: { signed: true }
  }
];

/* ------------------------------------------------------------------ *
 * Persona 2 — Farhan. Purchase, home loan blocked pending mutation.
 * Different variant, different defects, contested boundary address.
 * ------------------------------------------------------------------ */

const farhanDocuments = (corrected) => [
  {
    id: 'doc-deed', kind: 'sale_deed', fileName: 'sale-deed-2026.pdf',
    fileSizeBytes: 910_000, extractionSource: 'fixture',
    fields: {
      ownerName: 'Farhan Ansari',
      sellerName: 'Suresh Patidar',
      surveyNumber: '88/4',
      pid: '5-9-441',
      extentSqFt: 950,
      registrationNumber: 'BPL-2-00188/2026-27',
      executionDate: '2026-04-22',
      marketValue: 8_500_000,
      // Under-stamped in the defective set: 5% of 85 lakh is 4.25 lakh.
      stampDutyPaid: corrected ? 425_000 : 180_000,
      address: '7, Govindpura Colony, Bhopal 462023',
      pageCount: 11, expectedPageCount: 11,
      signaturePresent: true,
      legibility: 0.94
    }
  },
  {
    id: 'doc-khata', kind: 'khata_extract', fileName: 'naksha-extract.pdf',
    fileSizeBytes: 200_000, extractionSource: 'fixture',
    fields: {
      ownerName: 'Suresh Patidar',
      khataNumber: 'KH/5/0182',
      pid: '5-9-441',
      // Typo in the record: 88/4 written as 88/6. Genuinely blocking,
      // genuinely slow to fix, and exactly the kind of thing an agent "handles".
      surveyNumber: corrected ? '88/4' : '88/6',
      extentSqFt: 950,
      issuedDate: '2026-05-10',
      address: '7, Govindpura Colony, Bhopal 462023',
      legibility: 0.9
    }
  },
  ...['2023-24', '2024-25', '2025-26'].map((year, index) => ({
    id: `doc-tax-${index}`, kind: 'tax_receipt', fileName: `property-tax-${year}.pdf`,
    fileSizeBytes: 92_000, extractionSource: 'fixture',
    fields: {
      assesseeName: 'Suresh Patidar', pid: '5-9-441', financialYear: year,
      receiptNumber: `PT/${year.slice(0, 4)}/55${index}812`,
      paidDate: `${year.slice(0, 4)}-06-15`, amountPaid: 9_800,
      arrears: !corrected && index === 2 ? 1_950 : 0,
      legibility: 0.87
    }
  })),
  {
    id: 'doc-aadhaar', kind: 'aadhaar', fileName: 'aadhaar-front.jpg',
    fileSizeBytes: 610_000, extractionSource: 'fixture',
    fields: {
      name: 'Farhan Ansari', number: '765432109878', dob: '1993-08-05',
      address: '7, Govindpura Colony, Bhopal 462023', legibility: 0.92
    }
  },
  {
    id: 'doc-ec', kind: 'encumbrance_certificate', fileName: 'ec-2014-2026.pdf',
    fileSizeBytes: 300_000, extractionSource: 'fixture',
    fields: {
      periodFrom: '2014-04-01', periodTo: '2026-07-31',
      entries: [
        { type: 'sale', date: '2026-04-22', party: 'Suresh Patidar to Farhan Ansari', status: 'registered' },
        // The seller's old home loan was never released on record. The buyer's
        // own bank will not disburse until this clears.
        { type: 'mortgage', date: '2019-05-10', party: 'State Bank of India, Govindpura Branch, Bhopal', status: corrected ? 'released' : 'subsisting' }
      ],
      legibility: 0.81
    }
  },
  {
    id: 'doc-bescom', kind: 'bescom_bill', fileName: 'mpeb-bill.pdf',
    fileSizeBytes: 84_000, extractionSource: 'fixture',
    fields: {
      consumerName: 'Suresh Patidar', rrNumber: 'BPL-GV-118440',
      billMonth: '2026-08', address: '7, Govindpura Colony, Bhopal 462023', legibility: 0.85
    }
  },
  {
    id: 'doc-photo', kind: 'photo', fileName: 'passport-photo.jpg',
    fileSizeBytes: 38_000, extractionSource: 'fixture',
    fields: { widthPx: 420, heightPx: 540, faceVisible: true, plainBackground: true }
  },
  {
    id: 'doc-form', kind: 'application_form', fileName: 'namaantaran-application.pdf',
    fileSizeBytes: 60_000, extractionSource: 'fixture',
    fields: { signed: corrected }
  }
];

/* ------------------------------------------------------------------ *
 * Persona 3 — Ramkali. The hard case: an unresolvable-on-paper file.
 * Included on purpose. A product that only ever shows the happy path is
 * not a product, it is a slideshow.
 * ------------------------------------------------------------------ */

const ramkaliDocuments = () => [
  {
    id: 'doc-deed', kind: 'sale_deed', fileName: 'sale-deed-1998-scan.jpg',
    fileSizeBytes: 3_100_000, extractionSource: 'fixture',
    fields: {
      ownerName: 'Shivdayal',
      sellerName: 'Not legible',
      surveyNumber: '72/2',
      extentSqFt: 650,
      registrationNumber: null,
      executionDate: '1998-11-20',
      address: 'Makaan 5, Karond, Bhopal 462038',
      pageCount: 4, expectedPageCount: 9,
      signaturePresent: true,
      legibility: 0.39
    }
  },
  {
    id: 'doc-khata', kind: 'khata_extract', fileName: 'naksha-extract-old.jpg',
    fileSizeBytes: 240_000, extractionSource: 'fixture',
    fields: {
      ownerName: 'Shivdayal', khataNumber: 'B-Register/4/0098', pid: null,
      surveyNumber: '72/2', extentSqFt: 650, issuedDate: '2020-04-08',
      address: 'Makaan 5, Karond, Bhopal 462038', legibility: 0.52
    }
  },
  {
    id: 'doc-aadhaar', kind: 'aadhaar', fileName: 'aadhaar.jpg',
    fileSizeBytes: 520_000, extractionSource: 'fixture',
    fields: { name: 'Ramkali Bai', number: '765432109884', dob: '1964-02-10', address: 'Makaan 5, Karond, Bhopal 462038', legibility: 0.88 }
  },
  {
    id: 'doc-death', kind: 'death_certificate', fileName: 'death-certificate.pdf',
    fileSizeBytes: 140_000, extractionSource: 'fixture',
    fields: {
      deceasedName: 'Shivdayal', dateOfDeath: '2022-06-15',
      registrationNumber: 'DTH/BPL/2022/07821', attested: true, legibility: 0.86
    }
  }
];

/* ------------------------------------------------------------------ *
 * Personas
 * ------------------------------------------------------------------ */

export const PERSONAS = {
  savita: {
    id: 'savita',
    name: 'Savita Gupta',
    nameHi: 'सविता गुप्ता',
    initial: 'स',
    variant: 'inheritance',
    address: '14, Arera Colony E-7, Bhopal 462016',
    headline: 'Inherited her father\'s house in Arera Colony. Cannot sell it until the mutation moves to her name.',
    headlineHi: 'पिता का घर विरासत में मिला। नामांतरण अपने नाम आए बिना बेच नहीं सकतीं।',
    quotedByAgent: 5000,
    spokenIntake: 'Bhai, mujhe apne pita ki property ka namaantaran karwana hai. Woh pichhle October mein gaye. Ghar Arera Colony mein hai, bechna hai. Mere paas saare kaagaz hain.',
    spokenIntakeGloss: 'I need to get my father\'s property mutation done. He passed away last October. The house is in Arera Colony, I want to sell it. I have all the documents.',
    declared: { willExists: false, willProbated: false, relationshipToOwner: 'daughter' },
    documents: savitaDocuments
  },
  farhan: {
    id: 'farhan',
    name: 'Farhan Ansari',
    nameHi: 'फरहान अंसारी',
    initial: 'फ',
    variant: 'sale',
    address: '7, Govindpura Colony, Bhopal 462023',
    headline: 'Bought a plot in April. His bank will not release the home loan until the mutation is in his name.',
    headlineHi: 'अप्रैल में प्लॉट खरीदा। नामांतरण उनके नाम आए बिना बैंक होम लोन जारी नहीं करेगा।',
    quotedByAgent: 12000,
    spokenIntake: 'Bhai, maine April mein Govindpura mein plot liya. Bank bol raha hai namaantaran ke baad hi loan milega. Registry ho gayi hai.',
    spokenIntakeGloss: 'I bought a plot in Govindpura in April. The bank says the loan will only be released after the mutation. The registration is already done.',
    declared: { willExists: false, willProbated: false, relationshipToOwner: 'purchaser' },
    documents: farhanDocuments
  },
  ramkali: {
    id: 'ramkali',
    name: 'Ramkali Bai',
    nameHi: 'रामकली बाई',
    initial: 'र',
    variant: 'inheritance',
    address: 'Makaan 5, Karond, Bhopal 462038',
    headline: 'A 1998 deed that was never registered. The hard case — and the one where telling the truth matters most.',
    headlineHi: '1998 का विलेख, कभी पंजीकृत नहीं हुआ। कठिन मामला — और यहीं सच बोलना सबसे ज़रूरी है।',
    quotedByAgent: 20000,
    spokenIntake: 'Hamara ghar Karond mein hai. Pati chale gaye. Koi bol raha hai 20 hazaar do toh namaantaran karwa denge.',
    spokenIntakeGloss: 'Our house is in Karond. My husband passed away. Someone says if I pay twenty thousand they will get the mutation done.',
    declared: { willExists: true, willProbated: false, relationshipToOwner: 'spouse' },
    documents: ramkaliDocuments
  }
};

// Aliases for backwards compatibility with tests and older client references
PERSONAS.lakshmi = PERSONAS.savita;
PERSONAS.imran = PERSONAS.farhan;
PERSONAS.sarala = PERSONAS.ramkali;

export const PRIMARY_PERSONA_IDS = ['savita', 'farhan', 'ramkali'];
export const PERSONA_IDS = Object.keys(PERSONAS);

/** Builds the case object a persona starts from. */
export function buildPersonaCase(personaId, { corrected = false } = {}) {
  const persona = PERSONAS[personaId];
  if (!persona) throw new Error(`Unknown persona "${personaId}"`);
  return {
    personaId: personaId,
    applicant: { name: persona.name, personaId: persona.id },
    variant: persona.variant,
    address: persona.address,
    declared: persona.declared,
    documents: persona.documents(corrected).map((doc) => ({ ...doc, synthetic: true }))
  };
}

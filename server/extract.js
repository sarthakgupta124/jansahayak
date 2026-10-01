/**
 * DOCUMENT INTAKE AND FIELD EXTRACTION
 *
 * The compliance engine needs structured fields. Getting them out of a phone
 * photo of a twenty-year-old deed is the hard part, and it is the one place in
 * this product where a model is genuinely the right tool.
 *
 * The boundary is strict and worth stating precisely:
 *
 *   the model READS.   It turns pixels into candidate field values.
 *   the model does NOT DECIDE. It never sees a rule, never scores a document,
 *                      never says whether anything is acceptable.
 *
 * Everything the model produces is shown back to the citizen as an editable
 * value with its confidence, before any rule runs on it. A wrong reading is
 * therefore a correctable inconvenience, not a wrong verdict.
 *
 * Two extraction paths exist, and the app always tells the user which one ran:
 *
 *   manual         the default — classify by file name, measure pixels on the
 *                  device, and ask the citizen to confirm the handful of fields
 *                  the rules actually need
 *   openai-vision  optional fallback — only when the citizen asks to read a
 *                  photograph and a key is configured
 *
 * Manual is not a degraded path. On a 2G connection, typing six fields is
 * faster than waiting on a vision round-trip, and it is what works in a CSC
 * kiosk with no connectivity budget. The model still never decides a rule.
 */

const OPENAI_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 25_000);

export const hasOpenAI = () => Boolean(process.env.OPENAI_API_KEY);

export const extractionMode = () => (hasOpenAI()
  ? {
      mode: 'manual',
      model: OPENAI_MODEL,
      visionFallback: true,
      note: 'Documents are classified by file name and you confirm the fields. A vision model is available as a fallback if you ask it to read a photograph — every value is still shown to you before any rule runs.'
    }
  : {
      mode: 'manual',
      model: null,
      visionFallback: false,
      note: 'No vision model is configured on this deployment, so documents are classified by file name and you confirm the fields yourself. The compliance engine is identical either way.'
    });

/* ------------------------------------------------------------------ *
 * Which document is this?
 * ------------------------------------------------------------------ */

const KIND_PATTERNS = [
  { kind: 'sale_deed', patterns: [/sale[\s_-]*deed/i, /\bdeed\b/i, /kraya/i, /conveyance/i, /\bsd[\s_-]?\d/i] },
  { kind: 'khata_extract', patterns: [/khata/i, /khatha/i, /\bkata[\s_-]*extract/i, /b[\s_-]?register/i] },
  { kind: 'tax_receipt', patterns: [/tax/i, /\bpt[\s_-]?\d/i, /receipt/i, /assessment/i] },
  { kind: 'death_certificate', patterns: [/death/i, /demise/i, /\bdc[\s_-]?cert/i] },
  { kind: 'legal_heir_certificate', patterns: [/heir/i, /succession/i, /varasu/i, /family[\s_-]*member/i] },
  { kind: 'aadhaar', patterns: [/aadha?ar/i, /\buid(ai)?\b/i, /\bekyc\b/i] },
  { kind: 'bescom_bill', patterns: [/bescom/i, /electric/i, /\beb[\s_-]*bill/i, /power[\s_-]*bill/i] },
  { kind: 'encumbrance_certificate', patterns: [/encumbrance/i, /\bec\b/i, /form[\s_-]*1[56]/i] },
  { kind: 'noc_affidavit', patterns: [/noc/i, /no[\s_-]*objection/i, /affidavit/i, /relinquish/i] },
  { kind: 'photo', patterns: [/photo/i, /passport[\s_-]*size/i, /selfie/i] },
  { kind: 'application_form', patterns: [/application/i, /\bform\b/i] }
];

/** Guesses a document kind from its file name. Deliberately conservative. */
export function classifyByFileName(fileName = '') {
  for (const { kind, patterns } of KIND_PATTERNS) {
    const hit = patterns.find((pattern) => pattern.test(fileName));
    if (hit) return { kind, confidence: 0.7, basis: `file name matched /${hit.source}/` };
  }
  return { kind: null, confidence: 0, basis: 'file name did not match any known document type' };
}

/* ------------------------------------------------------------------ *
 * What does each document type need to yield?
 *
 * This is the contract between extraction and the rules. If a rule reads a
 * field, that field must appear here, or a citizen on the manual path can
 * never supply it.
 * ------------------------------------------------------------------ */

export const FIELD_TEMPLATES = {
  sale_deed: [
    { key: 'ownerName', label: 'Name of the buyer / current owner on the deed', type: 'text', required: true },
    { key: 'sellerName', label: 'Name of the seller on the deed', type: 'text' },
    { key: 'surveyNumber', label: 'Survey number', type: 'text', required: true, hint: 'Written as it appears, e.g. Sy. No. 42/3' },
    { key: 'registrationNumber', label: 'Registration number', type: 'text', required: true },
    { key: 'executionDate', label: 'Date of execution', type: 'date' },
    { key: 'extentSqFt', label: 'Site extent in square feet', type: 'number' },
    { key: 'marketValue', label: 'Consideration / market value shown (₹)', type: 'number' },
    { key: 'stampDutyPaid', label: 'Stamp duty paid (₹)', type: 'number' },
    { key: 'address', label: 'Property address on the deed', type: 'text' }
  ],
  khata_extract: [
    { key: 'ownerName', label: 'Name the khata currently stands in', type: 'text', required: true },
    { key: 'khataNumber', label: 'Khata number', type: 'text' },
    { key: 'pid', label: 'Property ID (PID)', type: 'text', required: true },
    { key: 'surveyNumber', label: 'Survey number', type: 'text', required: true },
    { key: 'extentSqFt', label: 'Extent in square feet', type: 'number' },
    { key: 'issuedDate', label: 'Date the extract was issued', type: 'date', required: true },
    { key: 'address', label: 'Property address', type: 'text' }
  ],
  tax_receipt: [
    { key: 'assesseeName', label: 'Name on the receipt', type: 'text', required: true },
    { key: 'pid', label: 'Property ID (PID)', type: 'text', required: true },
    { key: 'financialYear', label: 'Assessment year', type: 'text', required: true, hint: 'e.g. 2024-25' },
    { key: 'receiptNumber', label: 'Receipt number', type: 'text' },
    { key: 'amountPaid', label: 'Amount paid (₹)', type: 'number' },
    { key: 'arrears', label: 'Arrears shown (₹, 0 if none)', type: 'number' }
  ],
  death_certificate: [
    { key: 'deceasedName', label: 'Name of the deceased', type: 'text', required: true },
    { key: 'dateOfDeath', label: 'Date of death', type: 'date', required: true },
    { key: 'registrationNumber', label: 'Registration number', type: 'text' },
    { key: 'attested', label: 'Is this an attested copy?', type: 'boolean', required: true }
  ],
  legal_heir_certificate: [
    { key: 'deceasedName', label: 'Name of the deceased', type: 'text', required: true },
    { key: 'heirs', label: 'Heirs named (one per line)', type: 'list', required: true },
    { key: 'issuedDate', label: 'Date issued', type: 'date', required: true },
    { key: 'issuingAuthority', label: 'Issuing authority', type: 'text' },
    { key: 'attested', label: 'Is this an attested copy?', type: 'boolean' }
  ],
  aadhaar: [
    { key: 'name', label: 'Name exactly as printed on Aadhaar', type: 'text', required: true },
    { key: 'number', label: 'Aadhaar number', type: 'text', required: true, sensitive: true, hint: 'Used only to run the public checksum in your browser session. Never stored, never sent onward.' },
    { key: 'address', label: 'Address on Aadhaar', type: 'text' }
  ],
  bescom_bill: [
    { key: 'consumerName', label: 'Consumer name', type: 'text', required: true },
    { key: 'rrNumber', label: 'RR number', type: 'text' },
    { key: 'billMonth', label: 'Bill month', type: 'month', required: true, hint: 'e.g. 2026-08' },
    { key: 'address', label: 'Service address', type: 'text' }
  ],
  encumbrance_certificate: [
    { key: 'periodFrom', label: 'Period covered from', type: 'date', required: true },
    { key: 'periodTo', label: 'Period covered to', type: 'date', required: true },
    { key: 'entries', label: 'Entries listed', type: 'entries' }
  ],
  noc_affidavit: [
    { key: 'fromName', label: 'Name of the person giving the no-objection', type: 'text', required: true },
    { key: 'notarised', label: 'Is it notarised?', type: 'boolean' }
  ],
  photo: [
    { key: 'widthPx', label: 'Width in pixels', type: 'number' },
    { key: 'faceVisible', label: 'Is the full face visible?', type: 'boolean' },
    { key: 'plainBackground', label: 'Is the background plain?', type: 'boolean' }
  ],
  application_form: [
    { key: 'signed', label: 'Have you signed it?', type: 'boolean', required: true }
  ]
};

export const fieldTemplate = (kind) => FIELD_TEMPLATES[kind] || [];

/* ------------------------------------------------------------------ *
 * Vision extraction
 * ------------------------------------------------------------------ */

const EXTRACTION_SYSTEM_PROMPT = `You transcribe fields from photographs of Indian property and civil documents.

Rules you must follow:
- Transcribe only what is visibly printed or written. Never infer, complete or correct a value.
- If a field is not visible, absent, or you are not sure, return null for it. A null is always better than a guess.
- Copy names exactly as written, including initials, honorifics and spelling. Do NOT normalise or "correct" a name.
- Dates must be returned as YYYY-MM-DD. If only a month is visible, return YYYY-MM.
- Amounts must be returned as plain numbers with no currency symbol, commas or words.
- You are transcribing only. You must never judge whether a document is valid, complete, acceptable or sufficient. Something else does that.
- Return JSON only.`;

function buildExtractionPrompt(kind, template) {
  const fields = template.map((field) => `  "${field.key}": ${field.type === 'list' ? 'array of strings' : field.type === 'boolean' ? 'true | false | null' : field.type === 'number' ? 'number | null' : 'string | null'}  // ${field.label}`).join('\n');
  return `Document type: ${kind}

Return exactly this JSON shape:
{
  "fields": {
${fields}
  },
  "pageCount": number of pages visible in this image or null,
  "notes": short string describing anything that was unreadable, or null
}

Transcribe only. Report a field as null when you cannot read it — never infer
it, and never assess the quality of the image itself. How legible a scan is,
whether a signature block was signed and whether a photograph meets the
specification are measured from the pixels on the citizen's device, not judged
here.`;
}

async function callOpenAI(messages) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch(OPENAI_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages,
        temperature: 0,
        response_format: { type: 'json_object' }
      }),
      signal: controller.signal
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`OpenAI responded ${response.status}: ${detail.slice(0, 200)}`);
    }
    const body = await response.json();
    const content = body?.choices?.[0]?.message?.content;
    if (!content) throw new Error('OpenAI returned an empty completion');
    return JSON.parse(content);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Extracts fields from one uploaded document.
 *
 * Never throws for an extraction failure — a failure downgrades to the manual
 * path and says so, because the citizen still needs to get through the journey.
 */
export async function extractDocument({ fileName, mimeType, sizeBytes, dataUrl, kindHint, useVision = false }) {
  const classified = kindHint ? { kind: kindHint, confidence: 1, basis: 'chosen by the citizen' } : classifyByFileName(fileName);
  const kind = classified.kind;
  const template = fieldTemplate(kind);

  const base = {
    kind,
    fileName,
    mimeType,
    fileSizeBytes: sizeBytes || 0,
    classification: classified,
    template,
    fields: {},
    needsConfirmation: true
  };

  const isImage = typeof mimeType === 'string' && mimeType.startsWith('image/');

  // Primary path: existing offline system — file-name classification + citizen
  // confirmation. Vision runs only when explicitly requested as a fallback.
  if (!useVision || !hasOpenAI() || !dataUrl || !isImage || !kind) {
    return {
      ...base,
      extractionSource: 'manual',
      extractionNote: !kind
        ? 'We could not tell what this document is from its file name. Choose the type and confirm the fields.'
        : !isImage
          ? 'Field reading runs on photographs. For a PDF, confirm the fields below yourself — it takes about thirty seconds.'
          : useVision && !hasOpenAI()
            ? 'This deployment has no vision model configured. Confirm the fields below yourself.'
            : useVision && !dataUrl
              ? 'No image data was sent, so the fields are yours to confirm.'
              : hasOpenAI()
                ? 'Confirm the fields below, or ask the vision fallback to read this photograph.'
                : 'Confirm the fields below yourself.'
    };
  }

  try {
    const result = await callOpenAI([
      { role: 'system', content: EXTRACTION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: [
          { type: 'text', text: buildExtractionPrompt(kind, template) },
          { type: 'image_url', image_url: { url: dataUrl, detail: 'high' } }
        ]
      }
    ]);

    const fields = result?.fields && typeof result.fields === 'object' ? result.fields : {};
    // Only keep keys the template declares. A model inventing a field is a bug
    // we absorb here rather than letting it reach a rule.
    const allowed = new Set(template.map((field) => field.key));
    const cleaned = {};
    for (const [key, value] of Object.entries(fields)) {
      if (allowed.has(key) && value !== undefined) cleaned[key] = value;
    }
    // result.legibility is dropped on purpose even when the model returns it.
    // It is measured from the pixels, and a second opinion here could only ever
    // disagree with the measurement or duplicate it.
    if (typeof result.pageCount === 'number') cleaned.pageCount = result.pageCount;

    return {
      ...base,
      fields: cleaned,
      extractionSource: 'openai-vision',
      extractionModel: OPENAI_MODEL,
      extractionNote: result?.notes || 'Read from your photograph. Check every value below before continuing — a misread field would produce a wrong answer.',
      needsConfirmation: true
    };
  } catch (error) {
    return {
      ...base,
      extractionSource: 'manual',
      extractionError: error.message,
      extractionNote: 'Automatic reading did not work for this image, so please confirm the fields yourself. Nothing is lost — the checks are identical.'
    };
  }
}

/* ------------------------------------------------------------------ *
 * Coercion — turn confirmed form values into engine-shaped fields
 * ------------------------------------------------------------------ */

export function coerceFields(kind, raw = {}) {
  const template = fieldTemplate(kind);
  const out = {};
  for (const field of template) {
    const value = raw[field.key];
    if (value === undefined || value === null || value === '') continue;
    switch (field.type) {
      case 'number': {
        const n = Number(String(value).replace(/[^0-9.-]/g, ''));
        if (Number.isFinite(n)) out[field.key] = n;
        break;
      }
      case 'boolean':
        out[field.key] = value === true || value === 'true' || value === 'yes';
        break;
      case 'list':
        out[field.key] = Array.isArray(value)
          ? value.filter(Boolean)
          : String(value).split(/[\n,]/).map((s) => s.trim()).filter(Boolean);
        break;
      case 'entries':
        out[field.key] = Array.isArray(value) ? value : [];
        break;
      default:
        out[field.key] = String(value).trim();
    }
  }
  if (typeof raw.pageCount === 'number') out.pageCount = raw.pageCount;
  if (typeof raw.expectedPageCount === 'number') out.expectedPageCount = raw.expectedPageCount;
  // legibility and signaturePresent are deliberately NOT carried through from
  // the extraction any more. They are measured from the pixels (src/measure.js)
  // and written in by the upload route. A model that volunteers them anyway is
  // ignored here rather than left to race the measurement.
  return out;
}

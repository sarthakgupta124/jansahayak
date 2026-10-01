/**
 * CODE-MIXED INTAKE
 *
 * Real Bhopal speech puts Hindi, Hindi and English inside a single clause:
 *
 *   "sir, naanu appa house-na namaantaran transfer maadbeku, papers ellide"
 *
 * Off-the-shelf intent parsing degrades on this because it wants to pick a
 * language first. We do not need to. The information we actually need from the
 * first utterance is small and closed:
 *
 *   which service, which variant, what relationship, what is the urgency,
 *   and which locality
 *
 * so a cue-based matcher over romanised forms in all three languages gets there
 * without a language-ID decision, works offline, and costs nothing per user. A
 * model is used only to fill gaps the cues missed, and only when a key is
 * configured — it can add fields, never overturn a confident cue match.
 */

import { GAZETTEER } from './geo/jurisdiction.js';

const normalise = (s = '') => ` ${String(s).toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()} `;

/**
 * Cue sets. Each entry is romanised Hindi / Hindi / English forms of the same
 * idea, because that is how people actually type and speak it.
 */
const CUES = {
  service_namaantaran: ['namaantaran', 'khatha', 'kata transfer', 'mutation', 'property transfer', 'naam transfer', 'hesaru badalane'],
  variant_inheritance: [
    'appa', 'amma', 'father', 'mother', 'pita', 'papa', 'ganda', 'husband', 'pati',
    'theerikondru', 'tirikondaru', 'nidhanaraadaru', 'passed away', 'expired', 'death', 'guzar', 'nidhan', 'mruta',
    'inherit', 'varasu', 'virasat', 'legal heir', 'succession', 'nanna appana', 'ancestral'
  ],
  variant_sale: [
    'kharidi', 'kharida', 'bought', 'purchase', 'khareed', 'liya hai', 'took', 'registration aagide',
    'flat', 'site tagondide', 'new owner', 'seller', 'builder'
  ],
  urgency_sale: ['maarbeku', 'mare beku', 'sell', 'bechna', 'becha', 'selling', 'buyer waiting'],
  urgency_loan: ['loan', 'bank', 'housing loan', 'home loan', 'disburse', 'sanction', 'emi'],
  urgency_agent: ['agent', 'middleman', 'broker', 'dalal', 'commission', 'lanch', 'bribe', 'saavira kotre', 'paise maangta'],
  has_documents: ['papers ellide', 'documents ive', 'all papers', 'saare kaagaz', 'documents hain', 'ella ide'],
  missing_documents: ['papers illa', 'documents illa', 'kaagaz nahi', 'no papers', 'kaaneya', 'kaledide', 'lost']
};

/**
 * Ordered most-specific first. Note the last two entries: people rarely say
 * "I am the daughter". They say "my father's house". Naming a deceased parent
 * or spouse is itself the statement of relationship, and missing that was
 * leaving the field blank on the most common utterance there is.
 */
const RELATIONSHIPS = [
  { key: 'daughter', cues: ['magalu', 'daughter', 'beti', 'putri'] },
  { key: 'son', cues: ['maga', 'son', 'beta', 'putra'] },
  { key: 'spouse', cues: ['ganda', 'hendathi', 'husband', 'wife', 'pati', 'patni'] },
  { key: 'purchaser', cues: ['kharidi', 'bought', 'purchase', 'buyer', 'khareed'] },
  { key: 'child-of-owner', cues: ['appa', 'amma', 'father', 'mother', 'pita', 'papa', 'thande', 'thayi'] }
];

function countCues(text, list) {
  const matched = list.filter((cue) => text.includes(` ${cue} `) || text.includes(`${cue} `) || text.includes(` ${cue}`));
  return { count: matched.length, matched };
}

/**
 * Deterministic first pass. Always runs, always offline.
 * @returns {{variant:string|null, confidence:number, cues:object, ...}}
 */
export function parseIntakeDeterministic(utterance = '') {
  const text = normalise(utterance);
  const service = countCues(text, CUES.service_namaantaran);
  const inheritance = countCues(text, CUES.variant_inheritance);
  const sale = countCues(text, CUES.variant_sale);
  const urgencySale = countCues(text, CUES.urgency_sale);
  const urgencyLoan = countCues(text, CUES.urgency_loan);
  const urgencyAgent = countCues(text, CUES.urgency_agent);
  const hasDocs = countCues(text, CUES.has_documents);
  const missingDocs = countCues(text, CUES.missing_documents);

  let variant = null;
  if (inheritance.count > sale.count) variant = 'inheritance';
  else if (sale.count > inheritance.count) variant = 'sale';

  const relationship = RELATIONSHIPS.find((r) => countCues(text, r.cues).count > 0)?.key || null;

  const locality = GAZETTEER.find((entry) => text.includes(` ${entry.name.toLowerCase()} `))?.name || null;

  const urgency = urgencyLoan.count ? 'loan-blocked'
    : urgencySale.count ? 'sale-blocked'
      : urgencyAgent.count ? 'quoted-by-agent'
        : null;

  // Confidence is the share of the five things we wanted that we actually got.
  const captured = [service.count > 0, Boolean(variant), Boolean(relationship), Boolean(urgency), Boolean(locality)].filter(Boolean).length;

  return {
    engine: 'deterministic-cues',
    service: service.count > 0 ? 'property-mutation' : null,
    variant,
    relationship,
    urgency,
    locality,
    documentsClaimed: hasDocs.count > 0 ? true : missingDocs.count > 0 ? false : null,
    confidence: Number((captured / 5).toFixed(2)),
    cues: {
      service: service.matched,
      inheritance: inheritance.matched,
      sale: sale.matched,
      urgency: [...urgencySale.matched, ...urgencyLoan.matched, ...urgencyAgent.matched]
    }
  };
}

const INTAKE_SYSTEM_PROMPT = `You read a single sentence spoken by a citizen in Bhopal about a property record task. The sentence mixes Hindi, Hindi and English freely, often romanised.

Extract only what the sentence actually says. Return null for anything not stated. Never infer.

Return JSON:
{
  "variant": "inheritance" | "sale" | null,
  "relationship": "daughter" | "son" | "spouse" | "purchaser" | "other" | null,
  "urgency": "sale-blocked" | "loan-blocked" | "quoted-by-agent" | null,
  "locality": string | null,
  "documentsClaimed": true | false | null,
  "summaryEnglish": a one-sentence plain English restatement of what they said
}

You classify intent only. You never decide anything about documents, eligibility or process.`;

/**
 * When cues already resolved the transfer kind, stay offline. The model is only
 * a fallback for utterances the cue lists did not recognise.
 */
export function intakeNeedsModelFallback(deterministic) {
  if (!deterministic) return false;
  return !deterministic.variant || deterministic.confidence < 0.4;
}

/**
 * Full intake. Deterministic cues always run first and win on every field they
 * fill. OpenAI is called only when those cues leave the variant unresolved (or
 * confidence is very low) — gap-fill and an English gloss, never an override.
 */
export async function parseIntake(utterance = '') {
  const deterministic = parseIntakeDeterministic(utterance);
  if (!process.env.OPENAI_API_KEY || !utterance.trim() || !intakeNeedsModelFallback(deterministic)) {
    return { ...deterministic, modelAssisted: false };
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: INTAKE_SYSTEM_PROMPT },
          { role: 'user', content: utterance.slice(0, 600) }
        ]
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timer));

    if (!response.ok) throw new Error(`OpenAI responded ${response.status}`);
    const body = await response.json();
    const parsed = JSON.parse(body.choices[0].message.content);

    return {
      ...deterministic,
      // The model fills gaps; it does not overwrite a cue match.
      variant: deterministic.variant ?? (parsed.variant === 'inheritance' || parsed.variant === 'sale' ? parsed.variant : null),
      relationship: deterministic.relationship ?? parsed.relationship ?? null,
      urgency: deterministic.urgency ?? parsed.urgency ?? null,
      locality: deterministic.locality ?? parsed.locality ?? null,
      documentsClaimed: deterministic.documentsClaimed ?? parsed.documentsClaimed ?? null,
      summaryEnglish: typeof parsed.summaryEnglish === 'string' ? parsed.summaryEnglish : null,
      engine: 'deterministic-cues + model gap-fill',
      modelAssisted: true
    };
  } catch (error) {
    return { ...deterministic, modelAssisted: false, modelError: error.message };
  }
}

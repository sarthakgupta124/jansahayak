/**
 * THE ASSISTANT'S ANSWER ENGINE
 *
 * This is the half of the assistant that decides what to say, and the whole
 * point of it is that it does not compose anything.
 *
 * Every sentence it returns is either (a) read verbatim out of the defect
 * ledger — one of the 141 explanations that a person wrote and attached a
 * citation to — or (b) a number lifted straight off the evaluation, the
 * jurisdiction resolver or the statutory clock. There is no generation step
 * anywhere in here, which means there is no way for it to reassure someone
 * that their papers are fine when the rules say otherwise.
 *
 * WHY THAT LINE AND NOT SOMEWHERE ELSE
 *
 * A conversational agent sitting next to a verdict is the most dangerous
 * possible place for a language model in this product. Everything else is
 * built on "rules decide, the model only reads and explains", and a bot that
 * answers "so am I okay?" in its own words walks straight through that.
 *
 * So the split is: a model may be used to understand the QUESTION — matching
 * messy, code-mixed speech to an intent is exactly what models are good at,
 * and `matchIntent` below is the seam where that would plug in — but the
 * ANSWER is always retrieved, never written. Model on the way in, ledger on
 * the way out.
 *
 * It also keeps the economics intact. Answers cost nothing per citizen because
 * they already exist; only intent matching would ever cost anything, and that
 * is a handful of tokens rather than an unbounded conversation.
 *
 * Today `matchIntent` is pure keyword matching with no model at all, and it
 * runs offline alongside the engine. That is a deliberate floor, not a stub:
 * whatever gets added on top, this has to keep working with no signal.
 */

import { SERVICE_SLA, ESCALATION_LADDER } from '../server/engine/clock.js';

/* ------------------------------------------------------------------ *
 * Intent vocabulary
 *
 * Three languages, because the citizen asking is the one least likely to be
 * asking in English. Latin transliterations are included alongside the native
 * scripts — people type "tax receipt yenu" far more often than they switch
 * keyboards mid-sentence.
 * ------------------------------------------------------------------ */

const INTENTS = [
  {
    id: 'verdict',
    words: ['ready', 'fine', 'okay', 'ok', 'good', 'pass', 'submit', 'can i go', 'am i', 'verdict', 'result',
      'ಸಿದ್ಧ', 'ಸರಿ', 'ಆಗುತ್ತಾ', 'ಹೋಗಬಹುದ', 'तैयार', 'ठीक', 'जा सकता']
  },
  {
    id: 'blockers',
    words: ['wrong', 'problem', 'issue', 'blocking', 'worst', 'stop', 'refuse', 'reject', 'turned away',
      'ತಪ್ಪ', 'ಸಮಸ್ಯೆ', 'ತೊಂದರೆ', 'ಸರಿಯಿಲ್ಲ', 'गलत', 'ग़लत', 'समस्या', 'दिक्कत', 'रुक']
  },
  {
    id: 'howlong',
    words: ['how long', 'how many days', 'time', 'duration', 'when can', 'fast', 'quick',
      'ಎಷ್ಟು ದಿನ', 'ಸಮಯ', 'ಯಾವಾಗ', 'कितने दिन', 'कितना समय', 'कब']
  },
  {
    id: 'office',
    words: ['where', 'office', 'which office', 'go to', 'address', 'zone', 'corporation', 'counter',
      'ಎಲ್ಲಿ', 'ಕಚೇರಿ', 'ಆಫೀಸ', 'कहाँ', 'कहां', 'दफ्तर', 'कार्यालय']
  },
  {
    id: 'deadline',
    words: ['deadline', 'sakala', 'statutory', 'stipulated', 'law', 'entitled', 'legally', 'thirty', '30 days',
      // The suggestion chips are questions people will actually click, so the
      // vocabulary has to contain them verbatim or the chip answers the wrong
      // question — which is exactly what this one did.
      'how many days does the office', 'days does the office have', 'office have', 'allowed',
      'ಗಡುವು', 'ಕಾನೂನು', 'ಸಕಾಲ', 'ಕಚೇರಿಗೆ ಎಷ್ಟು ದಿನ', 'समय-सीमा', 'कानून', 'सकाल', 'कार्यालय के पास कितने दिन']
  },
  {
    id: 'appeal',
    words: ['appeal', 'complain', 'escalate', 'rti', 'late', 'delay', 'overdue', 'not done', 'sitting on',
      'ಮೇಲ್ಮನವಿ', 'ದೂರು', 'ವಿಳಂಬ', 'अपील', 'शिकायत', 'देरी']
  },
  {
    id: 'missing',
    words: ['missing', 'need', 'what do i need', 'documents', 'papers', 'bring', 'carry', 'checklist',
      'ಬೇಕು', 'ದಾಖಲೆ', 'ಕಾಗದ', 'चाहिए', 'दस्तावेज़', 'कागज']
  },
  {
    id: 'fee',
    words: ['fee', 'cost', 'pay', 'money', 'bribe', 'charge', 'rupee', 'price', 'agent',
      'ಶುಲ್ಕ', 'ದುಡ್ಡು', 'ಹಣ', 'ಲಂಚ', 'ಪಾವತಿ', 'फीस', 'पैसा', 'शुल्क', 'रिश्वत', 'देना', 'भुगतान']
  },
  {
    id: 'help',
    words: ['help', 'what can', 'how does', 'who are you', 'hello', 'hi', 'namaskara', 'namaste',
      'ಸಹಾಯ', 'ನಮಸ್ಕಾರ', 'मदद', 'नमस्ते']
  }
];

/**
 * Keywords that name a particular defect, so "what about the tax receipt"
 * lands on TAX-01 rather than on the generic list. Matched against the code
 * prefix, so it survives the ledger growing new codes in the same family.
 */
const TOPIC_PREFIXES = [
  { prefix: 'TAX', words: ['tax', 'receipt', 'ಕಂದಾಯ', 'ತೆರಿಗೆ', 'ರಸೀದಿ', 'कर', 'रसीद', 'टैक्स'] },
  { prefix: 'NAME', words: ['name', 'spelling', 'spelt', 'initial', 'ಹೆಸರು', 'ಕಾಗುಣಿತ', 'नाम', 'वर्तनी'] },
  { prefix: 'DATE', words: ['old', 'expired', 'stale', 'date', 'year', 'ಹಳೆ', 'ದಿನಾಂಕ', 'पुराना', 'तारीख'] },
  { prefix: 'FMT', words: ['attest', 'notary', 'blurry', 'blur', 'unclear', 'photo', 'signature', 'sign', 'scan',
    'ದೃಢೀಕರ', 'ಸಹಿ', 'ಫೋಟೋ', 'अटेस्ट', 'हस्ताक्षर', 'फोटो'] },
  { prefix: 'KYC', words: ['aadhaar', 'aadhar', 'kyc', 'identity', 'ಆಧಾರ', 'आधार'] },
  { prefix: 'INH', words: ['heir', 'inherit', 'death', 'died', 'father', 'mother', 'succession',
    'ವಾರಸು', 'ಮರಣ', 'ಅಪ್ಪ', 'वारिस', 'मृत्यु', 'पिता'] },
  { prefix: 'EC', words: ['encumbrance', 'loan', 'mortgage', 'ಋಣಭಾರ', 'ಸಾಲ', 'ऋण', 'कर्ज'] },
  { prefix: 'DEED', words: ['deed', 'sale', 'registered', 'registration', 'ಕ್ರಯ', 'ನೋಂದಣಿ', 'बैनामा', 'रजिस्ट्री'] }
];

const normalise = (text) => String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Splits a question into words.
 *
 * \p{M} — combining marks — is not optional here. Kannada and Devanagari build
 * a syllable from a consonant plus marks: ಕಂದಾಯ is ಕ + ಂ + ದ + ಾ + ಯ, and
 * Unicode classes those marks as M, not L. Splitting on [^\p{L}\p{N}] therefore
 * shattered every Indic word at every matra, and silently broke matching in the
 * two languages the product exists for while English carried on working.
 */
const tokenise = (q) => q.split(/[^\p{L}\p{N}\p{M}]+/u).filter(Boolean);

/**
 * How strongly one vocabulary entry matches a question.
 *
 * Tokenised rather than substring-matched. Plain `includes` looked reasonable
 * and was badly wrong: 'ok' matches "joke", 'hi' matches "this" and "which",
 * 'sign' matches "design", 'old' matches "household". "Tell me a joke" came
 * back as a confident verdict answer because of it.
 *
 * Prefix matching applies only to entries long enough for a prefix to mean
 * something — that is how Indic suffixes attach (ಸಹಾಯ → ಸಹಾಯಕ್ಕೆ) and how
 * English inflects (delay → delayed). Below four characters it is noise.
 */
function hits(q, tokens, word) {
  // A longer matching phrase is a more specific one and must outrank a shorter
  // phrase it contains. "How many days does the office have" is a question
  // about the statutory period; "how many days" alone is a question about the
  // fix plan, and a flat phrase score let the shorter, wronger one win.
  if (word.includes(' ')) return q.includes(word) ? 1 + word.split(' ').length : 0;
  if (tokens.includes(word)) return 1;
  if (word.length >= 4 && tokens.some((tk) => tk.startsWith(word))) return 1;
  return 0;
}

/**
 * Picks the intent whose vocabulary the question hits hardest.
 *
 * Longer phrases score above single words, so "how long" beats a stray "how".
 * A tie or a total miss returns null and the caller says so rather than
 * guessing — a wrong confident answer here is worse than an admission.
 */
export function matchIntent(question) {
  const q = normalise(question);
  if (!q) return null;

  const tokens = tokenise(q);
  let best = null;
  for (const intent of INTENTS) {
    let score = 0;
    for (const word of intent.words) score += hits(q, tokens, word);
    if (score > 0 && (!best || score > best.score)) best = { id: intent.id, score };
  }
  return best;
}

/** Finds the finding a question is pointing at, if it points at one. */
export function matchTopic(question, findings = []) {
  const q = normalise(question);
  if (!q) return null;
  const tokens = tokenise(q);
  for (const { prefix, words } of TOPIC_PREFIXES) {
    if (!words.some((w) => hits(q, tokens, w))) continue;
    const hit = findings.find((f) => String(f.code || '').startsWith(prefix));
    if (hit) return hit;
  }
  return null;
}

/* ------------------------------------------------------------------ *
 * Answers
 *
 * Each returns { text, cite } where `cite` names where the words came from, so
 * the panel can show its working the same way every verdict does. Nothing here
 * writes a sentence about the citizen's case that a person did not write first.
 * ------------------------------------------------------------------ */

const list = (items) => items.map((s) => `• ${s}`).join('\n');

function describeFinding(finding, strings) {
  return {
    text: `${finding.title}\n\n${finding.why}\n\n${strings.whatToDo} ${finding.fix}\n\n${strings.whoWhere} ${finding.owner} — ${finding.where}`,
    cite: `${finding.code} · ${strings.fromRulebook}`
  };
}

/**
 * @param {string} question what was asked, typed or spoken
 * @param {object} ctx { caseData, evaluation, strings } — strings are the UI
 *   scaffolding in the citizen's language; everything substantive comes from
 *   the evaluation, whose findings are already in that language.
 */
export function answer(question, ctx = {}) {
  // `= {}` only fills an UNDEFINED argument, and on the landing page there is a
  // real null here — no case has been started. Every read below must therefore
  // be optional, or "where do I go?" throws instead of answering.
  const { caseData, evaluation = null, strings = {}, language = 'en' } = ctx;
  const findings = evaluation?.findings || [];
  const sla = SERVICE_SLA['khata-transfer'];

  // The ladder already carries its own labels in all three languages. Reading
  // r.label regardless put "First appeal" in the middle of a Kannada sentence
  // when labelKn was sitting right there in the data.
  const rungLabel = (rung) => rung[`label${language === 'kn' ? 'Kn' : language === 'hi' ? 'Hi' : ''}`] || rung.label;
  // The SLA's unit is stored in English because it is data, not copy.
  const unit = strings.calendarDays || sla.unit;

  // A question naming a specific defect wins over a general intent: someone
  // asking "what about the tax receipt" wants that one, not the whole list.
  const topic = matchTopic(question, findings);
  if (topic) return describeFinding(topic, strings);

  const intent = matchIntent(question);

  // Only questions ABOUT THIS CASE need a check to have run. The statutory
  // period, the appeal ladder and what you should be paying are facts about the
  // service, true before anyone uploads anything — and they are precisely the
  // questions someone has on the landing page, before committing to eight
  // steps. Blacklisting two intents instead of whitelisting four made the
  // assistant answer "run the check first" to every question asked outside a
  // case, which is useless exactly where it is most needed.
  const NEEDS_EVALUATION = new Set(['verdict', 'blockers', 'howlong', 'missing']);
  if (!evaluation && NEEDS_EVALUATION.has(intent?.id)) {
    return { text: strings.noCheckYet, cite: null };
  }

  switch (intent?.id) {
    case 'verdict': {
      const blocks = evaluation.counts.blocks;
      const head = { 'will-be-refused': strings.verdictRefused, 'may-be-objected': strings.verdictObjected, ready: strings.verdictReady }[evaluation.verdict];
      return {
        text: `${head}\n\n${strings.countsLine
          .replace('{blocks}', evaluation.counts.blocks)
          .replace('{delays}', evaluation.counts.delays)
          .replace('{advisory}', evaluation.counts.advisory)}`
          + (blocks ? `\n\n${list(findings.filter((f) => f.severity === 'blocks').map((f) => f.title))}` : ''),
        cite: `${strings.fromEngine} ${evaluation.rulePack}`
      };
    }

    case 'blockers': {
      const blocking = findings.filter((f) => f.severity === 'blocks');
      if (!blocking.length) return { text: strings.noBlockers, cite: `${strings.fromEngine} ${evaluation.rulePack}` };
      if (blocking.length === 1) return describeFinding(blocking[0], strings);
      return {
        text: `${strings.blockersIntro}\n\n${list(blocking.map((f) => f.title))}\n\n${strings.askWhichOne}`,
        cite: blocking.map((f) => f.code).join(' · ')
      };
    }

    case 'howlong': {
      const plan = evaluation.fixPlan;
      if (!plan?.steps?.length) return { text: strings.nothingToFix, cite: `${strings.fromEngine} ${evaluation.rulePack}` };
      const slowest = [...plan.steps].sort((a, b) => b.expectedDays - a.expectedDays)[0];
      return {
        text: strings.howLongAnswer
          .replace('{critical}', plan.criticalPathDays)
          .replace('{serial}', plan.serialDays)
          .replace('{slowest}', slowest.title)
          + `\n\n${slowest.fix}`,
        cite: `${slowest.code} · ${strings.fromRulebook}`
      };
    }

    case 'office': {
      const office = caseData?.jurisdiction?.candidates?.[0];
      if (!office) return { text: strings.noOfficeYet, cite: null };
      const extra = caseData?.jurisdiction?.confidence === 'contested' ? `\n\n${strings.contested}` : '';
      return {
        text: `${office.office}\n${office.zone}, ${office.corporation}${extra}`,
        cite: strings.fromJurisdiction
      };
    }

    case 'deadline':
      return {
        text: strings.deadlineAnswer
          .replace('{days}', sla.days)
          .replace('{unit}', unit)
          .replace('{role}', sla.designatedOfficerRole)
          .replace('{framework}', sla.framework),
        cite: `${sla.framework} · ${strings.lastVerified} ${sla.lastVerified}`
      };

    case 'appeal':
      return {
        text: `${strings.appealIntro}\n\n${list(ESCALATION_LADDER.map((r) => `${rungLabel(r)} — ${r.availableAfterDays === 0 ? strings.theDayItLapses : `+${r.availableAfterDays} ${strings.days}`}, ${strings.disposedWithin} ${r.disposalDays} ${strings.days}`))}\n\n${strings.appealDrafted}`,
        cite: ESCALATION_LADDER.map((r) => r.basis).join(' · ')
      };

    case 'missing': {
      const missing = [...(evaluation.documents?.missingRequired || []), ...(evaluation.documents?.missingRecommended || [])];
      if (!missing.length) return { text: strings.nothingMissing, cite: `${strings.fromEngine} ${evaluation.rulePack}` };
      return { text: `${strings.missingIntro}\n\n${list(missing)}`, cite: `${strings.fromEngine} ${evaluation.rulePack}` };
    }

    case 'fee':
      return { text: strings.feeAnswer, cite: null };

    case 'help':
    default:
      // isHelp marks the one reply that is not about this case, so the panel
      // can leave the "read aloud" button off it and the tests can tell an
      // admission of ignorance apart from a substantive answer.
      return { text: strings.helpAnswer, cite: null, isHelp: true };
  }
}

/** The chips offered under the input, so nobody has to guess what it knows. */
export const SUGGESTION_INTENTS = ['blockers', 'howlong', 'deadline', 'office', 'appeal', 'fee'];

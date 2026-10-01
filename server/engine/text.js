/**
 * Transliteration-aware text normalisation and fuzzy matching for Indian names
 * and property identifiers.
 *
 * WHY THIS EXISTS
 * ---------------
 * The single most common blocking defect in a khata transfer is "name does not
 * match". In practice the name genuinely differs across documents because:
 *   - the sale deed carries a full name, the khata carries an initial form
 *     ("Ramesh Murthy"  vs  "M. Ramesh")
 *   - the same Kannada name is romanised differently by different clerks
 *     ("Murthy" / "Moorthy" / "Murthi", "Lakshmi" / "Laxmi")
 *   - honorifics and relationship markers leak into the field
 *     ("Sri. Ramesh Murthy S/o Muniyappa")
 *   - one document is in Kannada script and another in Latin script
 *
 * A naive string comparison flags all of these as mismatches, which is exactly
 * the false positive that would send a citizen to a notary for an affidavit
 * they do not need. So the comparison is done on a phonetic canonical form,
 * order-independently, with explicit handling of initials.
 *
 * Everything here is deterministic and pure. No model is involved in deciding
 * whether two names match.
 */

/* ------------------------------------------------------------------ *
 * 1. Script transliteration (Kannada / Devanagari -> Latin)
 * ------------------------------------------------------------------ */

// Compact ISO-ish transliteration covering the characters that actually occur
// in names on Karnataka revenue documents. Not a general-purpose transliterator.
const INDIC_MAP = {
  // NOTE ON LONG VOWELS: the long "e" and "o" of these scripts are written as a
  // single Latin letter here, not "ee"/"oo". phoneticKey reads "ee" the English
  // way (as in "meet") and folds it to "i", which turned ರಮೇಶ್ into "ramis" and
  // stopped it matching the Latin "Ramesh" on the next document. Vocalic r is
  // written "ri" for the same reason: every romanisation of ಕೃಷ್ಣ in the wild is
  // "Krishna", not "Krushna".
  // Kannada vowels
  'ಅ': 'a', 'ಆ': 'aa', 'ಇ': 'i', 'ಈ': 'ii', 'ಉ': 'u', 'ಊ': 'uu',
  'ಋ': 'ri', 'ಎ': 'e', 'ಏ': 'e', 'ಐ': 'ai', 'ಒ': 'o', 'ಓ': 'o', 'ಔ': 'au',
  // Kannada consonants
  'ಕ': 'ka', 'ಖ': 'kha', 'ಗ': 'ga', 'ಘ': 'gha', 'ಙ': 'na',
  'ಚ': 'cha', 'ಛ': 'chha', 'ಜ': 'ja', 'ಝ': 'jha', 'ಞ': 'na',
  'ಟ': 'ta', 'ಠ': 'tha', 'ಡ': 'da', 'ಢ': 'dha', 'ಣ': 'na',
  'ತ': 'ta', 'ಥ': 'tha', 'ದ': 'da', 'ಧ': 'dha', 'ನ': 'na',
  'ಪ': 'pa', 'ಫ': 'pha', 'ಬ': 'ba', 'ಭ': 'bha', 'ಮ': 'ma',
  'ಯ': 'ya', 'ರ': 'ra', 'ಲ': 'la', 'ವ': 'va', 'ಶ': 'sha',
  'ಷ': 'sha', 'ಸ': 'sa', 'ಹ': 'ha', 'ಳ': 'la', 'ೞ': 'la',
  // Kannada matras
  'ಾ': 'aa', 'ಿ': 'i', 'ೀ': 'ii', 'ು': 'u', 'ೂ': 'uu', 'ೃ': 'ri',
  'ೆ': 'e', 'ೇ': 'e', 'ೈ': 'ai', 'ೊ': 'o', 'ೋ': 'o', 'ೌ': 'au',
  '್': '', 'ಂ': 'n', 'ಃ': 'h',
  // Devanagari vowels
  'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ii', 'उ': 'u', 'ऊ': 'uu',
  'ऋ': 'ri', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
  // Devanagari consonants
  'क': 'ka', 'ख': 'kha', 'ग': 'ga', 'घ': 'gha', 'ङ': 'na',
  'च': 'cha', 'छ': 'chha', 'ज': 'ja', 'झ': 'jha', 'ञ': 'na',
  'ट': 'ta', 'ठ': 'tha', 'ड': 'da', 'ढ': 'dha', 'ण': 'na',
  'त': 'ta', 'थ': 'tha', 'द': 'da', 'ध': 'dha', 'न': 'na',
  'प': 'pa', 'फ': 'pha', 'ब': 'ba', 'भ': 'bha', 'म': 'ma',
  'य': 'ya', 'र': 'ra', 'ल': 'la', 'व': 'va', 'श': 'sha',
  'ष': 'sha', 'स': 'sa', 'ह': 'ha', 'ळ': 'la',
  // Devanagari matras
  'ा': 'aa', 'ि': 'i', 'ी': 'ii', 'ु': 'u', 'ू': 'uu', 'ृ': 'ri',
  'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au',
  '्': '', 'ं': 'n', 'ः': 'h', 'ँ': 'n'
};

/**
 * Absent means absent.
 *
 * `String(null)` is `"null"` and `String(undefined)` is `"undefined"`. Feeding
 * either into a name comparison produced a confident MISMATCH against a field
 * that simply was not there — a blocking defect invented out of a missing
 * value. Every normaliser in this file goes through here first.
 */
const asText = (value) => (value === null || value === undefined ? '' : String(value));

const KN_MATRAS = 'ಾಿೀುೂೃೆೇೈೊೋೌ';
const DV_MATRAS = 'ािीुूृेैोौ';
const VIRAMAS = '್्';
const isMatra = (ch) => KN_MATRAS.includes(ch) || DV_MATRAS.includes(ch);
const isVirama = (ch) => VIRAMAS.includes(ch);
const isConsonant = (ch) => {
  const mapped = INDIC_MAP[ch];
  return typeof mapped === 'string' && mapped.length > 1 && mapped.endsWith('a');
};

/**
 * Indic script to Latin.
 *
 * The subtlety is the inherent vowel: a consonant carries an implicit "a"
 * UNLESS a matra or a virama follows it. Emitting it unconditionally turned
 * "ರಮೇಶ್" into "ramaeesha" instead of "rameesh", which then failed to match the
 * Latin spelling of the same name on the next document.
 */
export function transliterate(input = '') {
  const chars = [...asText(input)];
  let out = '';
  let pendingInherentA = false;

  for (const ch of chars) {
    if (isMatra(ch)) { out += INDIC_MAP[ch] ?? ''; pendingInherentA = false; continue; }
    if (isVirama(ch)) { pendingInherentA = false; continue; }

    if (pendingInherentA) { out += 'a'; pendingInherentA = false; }

    if (isConsonant(ch)) { out += INDIC_MAP[ch].slice(0, -1); pendingInherentA = true; continue; }
    out += Object.prototype.hasOwnProperty.call(INDIC_MAP, ch) ? INDIC_MAP[ch] : ch;
  }
  if (pendingInherentA) out += 'a';
  return out;
}

/* ------------------------------------------------------------------ *
 * 2. Honorifics and relationship markers
 * ------------------------------------------------------------------ */

const HONORIFICS = new Set([
  'sri', 'shri', 'smt', 'smt.', 'srimati', 'srimathi', 'kum', 'kumari',
  'mr', 'mrs', 'ms', 'dr', 'prof', 'late', 'sivaji', 'thiru',
  'sriyuth', 'sriyutha', 'shrimati', 'sou'
]);

// "S/o", "W/o", "D/o", "C/o" and their spelled-out forms mark the start of a
// parent/spouse reference. Everything after them belongs to a different person.
const RELATION_MARKERS = /\b(s\s*\/\s*o|w\s*\/\s*o|d\s*\/\s*o|c\s*\/\s*o|son\s+of|wife\s+of|daughter\s+of|care\s+of|bin|binte)\b/i;

/** Splits "Ramesh Murthy S/o Muniyappa" into { self, relation }. */
export function splitRelation(raw = '') {
  const text = asText(raw);
  const m = text.match(RELATION_MARKERS);
  if (!m) return { self: text.trim(), relation: null, relationType: null };
  return {
    self: text.slice(0, m.index).trim(),
    relation: text.slice(m.index + m[0].length).trim() || null,
    relationType: m[0].toLowerCase().replace(/[\s.]/g, '')
  };
}

/* ------------------------------------------------------------------ *
 * 3. Phonetic canonicalisation
 * ------------------------------------------------------------------ */

/**
 * Reduces a romanised Indian name token to a canonical phonetic skeleton so
 * that spelling variants collapse onto one another.
 *
 *   murthy / moorthy / murthi / murti  -> murti
 *   lakshmi / laxmi / lakshmee         -> laksmi
 *   ramesh / rameshh / ramesha         -> rames
 */
export function phoneticKey(token = '') {
  let t = asText(token).toLowerCase().replace(/[^a-z]/g, '');
  if (!t) return '';

  t = t.replace(/ksh/g, 'ks').replace(/x/g, 'ks');
  t = t.replace(/aa+/g, 'a').replace(/ee+/g, 'i').replace(/ii+/g, 'i');
  t = t.replace(/oo+/g, 'u').replace(/uu+/g, 'u');
  t = t.replace(/th/g, 't').replace(/dh/g, 'd').replace(/bh/g, 'b');
  t = t.replace(/gh/g, 'g').replace(/kh/g, 'k').replace(/ph/g, 'f');
  t = t.replace(/chh/g, 'c').replace(/ch/g, 'c').replace(/sh/g, 's');
  t = t.replace(/jh/g, 'j').replace(/w/g, 'v').replace(/z/g, 'j');
  t = t.replace(/y$/g, 'i');
  t = t.replace(/(.)\1+/g, '$1');          // collapse doubled letters
  if (t.length > 3) t = t.replace(/a$/, ''); // Kannada trailing schwa
  t = t.replace(/(.)\1+/g, '$1');
  return t;
}

/** Levenshtein distance, iterative, O(n*m) with a single row buffer. */
export function levenshtein(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(row[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    prev = row;
  }
  return prev[b.length];
}

/** 0..1 similarity from edit distance. */
export function ratio(a = '', b = '') {
  const longest = Math.max(a.length, b.length);
  if (longest === 0) return 1;
  return 1 - levenshtein(a, b) / longest;
}

/* ------------------------------------------------------------------ *
 * 4. Name tokenisation and comparison
 * ------------------------------------------------------------------ */

/**
 * Turns a raw name field into { tokens, initials } where tokens are phonetic
 * keys of full name-words and initials are single letters ("M." in "M. Ramesh").
 */
export function tokenizeName(raw = '') {
  const { self } = splitRelation(transliterate(raw));
  const words = self
    .toLowerCase()
    .replace(/[^a-z\s.]/g, ' ')
    .split(/[\s]+/)
    .map((w) => w.trim())
    .filter(Boolean)
    .filter((w) => !HONORIFICS.has(w.replace(/\./g, '')));

  const tokens = [];
  const initials = [];
  for (const word of words) {
    const bare = word.replace(/\./g, '');
    if (!bare) continue;
    if (bare.length === 1) initials.push(bare);
    else tokens.push(phoneticKey(bare));
  }
  return { tokens: tokens.filter(Boolean), initials, source: String(raw) };
}

const TOKEN_MATCH_THRESHOLD = 0.82;

/**
 * Compares two name strings.
 *
 * Returns { verdict, score, matched, unmatchedA, unmatchedB, explanation }
 * where verdict is 'match' | 'probable' | 'mismatch'.
 *
 * The algorithm is deliberately asymmetric-tolerant: a shorter name that is
 * fully contained in a longer one (with initials expanded) is treated as the
 * same person, because that is what the underlying reality almost always is.
 */
export function compareNames(a, b) {
  const A = tokenizeName(a);
  const B = tokenizeName(b);

  if (!A.tokens.length && !A.initials.length) {
    return { verdict: 'unknown', score: 0, matched: [], unmatchedA: [], unmatchedB: [], explanation: 'first name field is empty' };
  }
  if (!B.tokens.length && !B.initials.length) {
    return { verdict: 'unknown', score: 0, matched: [], unmatchedA: [], unmatchedB: [], explanation: 'second name field is empty' };
  }

  const poolB = [...B.tokens];
  const matched = [];
  const unmatchedA = [];

  // Pass 1: match full tokens against full tokens.
  for (const tokenA of A.tokens) {
    let bestIndex = -1;
    let bestScore = 0;
    poolB.forEach((tokenB, index) => {
      const score = ratio(tokenA, tokenB);
      if (score > bestScore) { bestScore = score; bestIndex = index; }
    });
    if (bestIndex >= 0 && bestScore >= TOKEN_MATCH_THRESHOLD) {
      matched.push({ a: tokenA, b: poolB[bestIndex], score: Number(bestScore.toFixed(3)) });
      poolB.splice(bestIndex, 1);
    } else {
      unmatchedA.push(tokenA);
    }
  }

  // Pass 2: an initial on one side may stand for a full token on the other —
  // but ONLY if something else already matched. "M. Ramesh" vs "Ramesh Murthy"
  // has "ramesh" in common, so M↔Murthy is credible. "M. Ramesh" vs
  // "Muniyappa" has nothing in common, and letting M↔Muniyappa count would
  // merge two unrelated people on the strength of one letter.
  const poolBInitials = [...poolB];
  const consumedByInitial = [];
  const initialBridgingAllowed = matched.length > 0;
  for (const initial of initialBridgingAllowed ? A.initials : []) {
    const index = poolBInitials.findIndex((tokenB) => tokenB.startsWith(initial) || phoneticKey(initial) === tokenB[0]);
    if (index >= 0) {
      consumedByInitial.push({ a: `${initial}.`, b: poolBInitials[index], score: 1, viaInitial: true });
      poolBInitials.splice(index, 1);
    }
  }
  // And the same in the other direction.
  const leftoverA = [...unmatchedA];
  for (const initial of initialBridgingAllowed ? B.initials : []) {
    const index = leftoverA.findIndex((tokenA) => tokenA.startsWith(initial));
    if (index >= 0) {
      consumedByInitial.push({ a: leftoverA[index], b: `${initial}.`, score: 1, viaInitial: true });
      leftoverA.splice(index, 1);
    }
  }

  const allMatched = [...matched, ...consumedByInitial];
  const totalA = A.tokens.length + A.initials.length;
  const totalB = B.tokens.length + B.initials.length;
  const coverage = allMatched.length / Math.max(1, Math.min(totalA, totalB));

  // Verdicts are deliberately three-valued.
  //   match     every part lined up on its own merits
  //   probable  they line up, but only because we expanded an initial or
  //             because one side carries an extra name-word — the same person
  //             in all likelihood, yet written differently enough that a clerk
  //             may query it, so the citizen should be warned rather than sent
  //             to a notary
  //   mismatch  these are two different people as far as the paper goes
  const usedInitialBridge = consumedByInitial.length > 0;
  let verdict;
  if (coverage >= 0.999 && leftoverA.length === 0 && !usedInitialBridge) verdict = 'match';
  else if (coverage >= 0.5) verdict = 'probable';
  else verdict = 'mismatch';

  const score = Number(Math.min(1, coverage).toFixed(3));
  const explanation = allMatched.length
    ? `${allMatched.length} of ${Math.min(totalA, totalB)} name parts aligned (${allMatched.map((m) => `${m.a}≈${m.b}`).join(', ')})`
    : 'no name parts aligned';

  return {
    verdict,
    score,
    matched: allMatched,
    unmatchedA: leftoverA,
    unmatchedB: poolBInitials,
    explanation
  };
}

/* ------------------------------------------------------------------ *
 * 5. Property identifiers
 * ------------------------------------------------------------------ */

/**
 * Survey numbers are written wildly inconsistently:
 *   "Sy. No. 42/3", "Survey No 42-3", "42/3", "SY NO. 042/03"
 * Canonical form is digits and separators only, leading zeros stripped.
 */
export function normalizeSurveyNumber(raw = '') {
  const cleaned = asText(raw)
    .toLowerCase()
    // Only strip a leading "Sy. No." / "Survey Number" prefix — a global strip
    // would eat any "s" that happens to appear later in the value.
    .replace(/^\s*(sy|survey|khasra)?\.?\s*(no\.?|number)?\.?\s*/i, ' ')
    .replace(/[^0-9a-z\/\-]/g, '')
    .replace(/-/g, '/');
  const parts = cleaned.split('/').map((p) => p.replace(/^0+(?=\d)/, '')).filter(Boolean);
  return parts.join('/');
}

/** PID / property ID: strip separators, uppercase. "84-12-345" -> "8412345". */
export function normalizePid(raw = '') {
  return asText(raw).toUpperCase().replace(/[^0-9A-Z]/g, '');
}

export function sameSurveyNumber(a, b) {
  const na = normalizeSurveyNumber(a);
  const nb = normalizeSurveyNumber(b);
  if (!na || !nb) return { same: null, a: na, b: nb };
  return { same: na === nb, a: na, b: nb };
}

export function samePid(a, b) {
  const na = normalizePid(a);
  const nb = normalizePid(b);
  if (!na || !nb) return { same: null, a: na, b: nb };
  return { same: na === nb, a: na, b: nb };
}

/* ------------------------------------------------------------------ *
 * 6. Financial years
 * ------------------------------------------------------------------ */

/** "2019-20", "2019-2020", "FY2019-20", "2019/20" -> "2019-20". */
export function normalizeFinancialYear(raw = '') {
  const digits = asText(raw).match(/(20\d{2})\s*[-/–]\s*(\d{2,4})/);
  if (!digits) {
    const single = asText(raw).match(/(20\d{2})/);
    if (!single) return '';
    const start = Number(single[1]);
    return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
  }
  const start = Number(digits[1]);
  const endRaw = digits[2];
  const end = endRaw.length === 4 ? Number(endRaw) % 100 : Number(endRaw);
  return `${start}-${String(end).padStart(2, '0')}`;
}

/** Returns the financial years expected for `count` years ending at `endYear`. */
export function expectedFinancialYears(endYearStart, count) {
  const years = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const start = endYearStart - i;
    years.push(`${start}-${String((start + 1) % 100).padStart(2, '0')}`);
  }
  return years;
}

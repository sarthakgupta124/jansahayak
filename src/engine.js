/**
 * THE COMPLIANCE ENGINE, ON THE DEVICE
 *
 * The same rule pack the server runs, imported straight into the bundle and
 * executed in the browser. Not a reimplementation and not a subset — the very
 * same modules, so there is no second copy of the rules to drift out of step
 * with the first.
 *
 * That is possible because the engine never needed a server. Its whole
 * dependency closure is four files —
 *
 *     compliance.js → ledger.js
 *                   → khata-transfer.v1.js → text.js
 *
 * — with no file system, no network, no clock beyond `new Date()`, and no node
 * builtins anywhere in it. It sat behind an HTTP call for no better reason than
 * that it was written on the server first.
 *
 * Three things follow, and they are the reasons to do this rather than a
 * cleanup for its own sake:
 *
 *   1. IT WORKS OFFLINE. The people this is for are on patchy 2G in a queue
 *      outside a government office. Until now the app could detect that it was
 *      offline and say so; the check itself still needed a round trip. Now the
 *      answer arrives with no network at all.
 *
 *   2. THE DOCUMENTS DO NOT LEAVE THE PHONE. Privacy stops being a promise in
 *      a policy page and becomes a property of where the code runs. Nothing is
 *      uploaded to find out whether a khata extract is stale.
 *
 *   3. IT IS INSTANT. Correcting a misread field and seeing the verdict move
 *      is a sub-millisecond loop instead of a request.
 *
 * WHY THIS IS A STATIC IMPORT AND NOT A LAZY ONE. It costs about 31 KB gzipped
 * — the rule pack plus 141 defect explanations in three languages — and the
 * obvious optimisation is to split it into a chunk fetched when the citizen
 * reaches the check step. That optimisation destroys the feature. A chunk
 * fetched on demand is a chunk that cannot be fetched when there is no signal,
 * which is precisely the moment this exists for. It has to be in the bundle
 * that already loaded. The 31 KB is the price of the guarantee, paid once and
 * then cached, against a round trip per check forever.
 *
 * WHAT THE SERVER IS STILL FOR. The server re-runs the same evaluation before
 * it will attach a clock to a case (see /submit, which calls runCheck and
 * refuses while blockers stand). That is deliberate: this module makes the
 * check fast and private, it does not make the browser the authority. A client
 * cannot talk its way past a blocking defect by not running the rules.
 */

import { evaluateCase } from '../server/engine/compliance.js';
import { RULES, RULE_PACK_VERSION } from '../server/rules/khata-transfer.v1.js';
import { ledgerStats } from '../server/engine/ledger.js';

export const localRulePack = RULE_PACK_VERSION;
export const localRuleCount = RULES.length;
export const localLedgerStats = ledgerStats;

/**
 * Runs the rule pack against a case, here, now.
 *
 * @param {object} caseData the case as the client holds it
 * @param {object} [options] `language` selects the ledger's explanations
 * @returns {object} the same evaluation shape the API returns, with
 *   `computedOn: 'device'` so the UI can say where the answer came from
 *   rather than implying it came from somewhere authoritative.
 */
export function checkLocally(caseData, options = {}) {
  const evaluation = evaluateCase(caseData, {
    language: options.language || caseData?.language || 'en',
    today: options.today
  });
  return { ...evaluation, computedOn: 'device' };
}

/**
 * True when the local engine can answer for this case at all.
 *
 * The engine is happy to evaluate a case with no documents — it returns a
 * "not ready" verdict, which is correct — but running it before the citizen has
 * attached anything shows them a wall of blockers for work they have not done
 * yet. The journey only calls this from the check step onward.
 */
export function canCheckLocally(caseData) {
  return Boolean(caseData && Array.isArray(caseData.documents) && caseData.documents.length > 0);
}

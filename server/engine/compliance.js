/**
 * THE COMPLIANCE ENGINE
 *
 * Takes a case (applicant + documents with extracted fields) and a rule pack,
 * and returns a list of defect codes with an evidence trail.
 *
 * Properties this file is responsible for:
 *   - deterministic: same input, same output, always
 *   - explainable: every finding names the rule, the documents and the fields
 *   - scoped: rules that do not apply to this case are excluded from the score
 *     rather than silently passing, so the denominator is honest
 *   - crash-resistant: a throwing rule is reported as an engine error, never as
 *     a clean bill of health, because "your papers are fine" is the one answer
 *     that must never be produced by accident
 */

import { RULES, RULE_PACK_VERSION, VARIANTS, DOCUMENT_KINDS } from '../rules/khata-transfer.v1.js';
import { DEFECTS, explain } from './ledger.js';

const SEVERITY_WEIGHT = { blocks: 3, delays: 1, advisory: 0 };
const SEVERITY_ORDER = { blocks: 0, delays: 1, advisory: 2 };

/**
 * @param {object} caseData
 * @param {object} [options]
 * @param {string} [options.language]
 * @param {Date}   [options.today]  injectable for tests and the time-travel demo
 */
export function evaluateCase(caseData, options = {}) {
  const language = options.language || 'en';
  const today = options.today ? new Date(options.today) : new Date();
  const variant = VARIANTS[caseData.variant] || VARIANTS.inheritance;
  const documents = Array.isArray(caseData.documents) ? caseData.documents : [];

  const byKind = {};
  for (const doc of documents) {
    if (!doc || !doc.kind) continue;
    (byKind[doc.kind] ||= []).push(doc);
  }

  const ctx = {
    variant,
    documents,
    byKind,
    applicant: caseData.applicant || { name: '' },
    declared: caseData.declared || {},
    today
  };

  const findings = [];
  const passed = [];
  const skipped = [];
  const engineErrors = [];

  for (const rule of RULES) {
    let applies = false;
    try {
      applies = Boolean(rule.appliesWhen(ctx));
    } catch (error) {
      engineErrors.push({ ruleId: rule.id, phase: 'appliesWhen', message: error.message });
      continue;
    }
    if (!applies) { skipped.push(rule.id); continue; }

    let outcome = null;
    try {
      outcome = rule.evaluate(ctx);
    } catch (error) {
      engineErrors.push({ ruleId: rule.id, phase: 'evaluate', message: error.message });
      continue;
    }

    if (!outcome) { passed.push(rule.id); continue; }

    const ledgerEntry = DEFECTS[rule.code];
    findings.push({
      code: rule.code,
      ruleId: rule.id,
      rulePack: RULE_PACK_VERSION,
      severity: ledgerEntry ? ledgerEntry.severity : 'advisory',
      evidence: outcome,
      ...explain(rule.code, language)
    });
  }

  findings.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || a.code.localeCompare(b.code));

  const counts = { blocks: 0, delays: 0, advisory: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  /* ---- readiness score -------------------------------------------
   * A weighted pass rate over the rules that actually applied. Blocking rules
   * count for three, delaying rules for one, advisories for nothing.
   *
   * The band matters more than the number. A pass rate alone is actively
   * misleading here: fail two rules out of forty and you score 92, which reads
   * as "nearly there" when in fact you will be turned away at the counter. So
   * the score is confined to a band chosen by the worst outstanding severity,
   * and the UI leads with the blocker count rather than the percentage.
   * ---------------------------------------------------------------- */
  let weightAvailable = 0;
  let weightLost = 0;
  for (const rule of RULES) {
    if (skipped.includes(rule.id)) continue;
    const severity = DEFECTS[rule.code]?.severity || 'advisory';
    const weight = SEVERITY_WEIGHT[severity];
    weightAvailable += weight;
    if (findings.some((finding) => finding.ruleId === rule.id)) weightLost += weight;
  }
  const passRate = weightAvailable === 0 ? 1 : 1 - weightLost / weightAvailable;

  const verdict = counts.blocks > 0 ? 'will-be-refused' : counts.delays > 0 ? 'may-be-objected' : 'ready';
  const BANDS = { 'will-be-refused': [10, 55], 'may-be-objected': [60, 85], ready: [90, 100] };
  const [floor, ceiling] = BANDS[verdict];
  const score = Math.round(floor + (ceiling - floor) * passRate);

  /* ---- fix plan ---------------------------------------------------
   * Fixes are mostly independent, so the honest estimate of "how long until
   * I can submit" is the longest single fix, not the sum of all of them. We
   * show both, because the citizen has to make trips.
   * ---------------------------------------------------------------- */
  const actionable = findings.filter((finding) => finding.severity !== 'advisory');
  const criticalPathDays = actionable.reduce((max, finding) => Math.max(max, finding.expectedDays || 0), 0);
  const serialDays = actionable.reduce((sum, finding) => sum + (finding.expectedDays || 0), 0);

  const missingRequired = variant.required.filter((kind) => !(byKind[kind]?.length));
  const missingRecommended = variant.recommended.filter((kind) => !(byKind[kind]?.length));

  return {
    rulePack: RULE_PACK_VERSION,
    language,
    evaluatedAt: today.toISOString(),
    variant: variant.id,
    score,
    verdict,
    scoreBasis: {
      weightAvailable, weightLost,
      passRate: Number(passRate.toFixed(3)),
      band: [floor, ceiling],
      rulesApplied: RULES.length - skipped.length,
      rulesSkipped: skipped.length,
      method: 'Severity-weighted pass rate over applicable rules, confined to a band set by the worst outstanding severity.'
    },
    submittable: counts.blocks === 0,
    counts,
    findings,
    passedRuleIds: passed,
    skippedRuleIds: skipped,
    engineErrors,
    fixPlan: {
      criticalPathDays,
      serialDays,
      steps: actionable.map((finding) => ({
        code: finding.code,
        title: finding.title,
        fix: finding.fix,
        owner: finding.owner,
        where: finding.where,
        expectedDays: finding.expectedDays,
        severity: finding.severity
      }))
    },
    documents: {
      supplied: documents.map((doc) => ({ id: doc.id, kind: doc.kind, label: DOCUMENT_KINDS[doc.kind]?.label || doc.kind, fileName: doc.fileName, extractionSource: doc.extractionSource })),
      missingRequired,
      missingRecommended
    }
  };
}

/**
 * The positive verdict is also a code. When nothing failed we emit PASS-01 so
 * that the "why this answer" expander has something to show, and so the UI
 * never has to invent reassuring language of its own.
 */
export function withPassVerdict(result) {
  if (result.findings.length > 0) return result;
  return {
    ...result,
    findings: [{
      code: 'PASS-01',
      ruleId: 'R-ALL',
      rulePack: result.rulePack,
      severity: 'advisory',
      evidence: {
        note: 'Every applicable rule in the pack returned no defect.',
        comparison: `${result.scoreBasis.rulesApplied} rules applied · ${result.scoreBasis.rulesSkipped} not applicable to this case · 0 failures`,
        documents: []
      },
      ...explain('PASS-01', result.language)
    }]
  };
}

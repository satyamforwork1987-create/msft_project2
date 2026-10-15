/**
 * Nova Policy Engine — deterministic, pure functions, evaluated BEFORE any LLM call.
 * These are the GUARDRAILS. They are the core feature.
 *
 * Order of evaluation (§2-A):
 *  1. FRAUD flag → always Human Handoff
 *  2. LEGAL flag → always Human Handoff
 *  3. REFUND CAP > ₹500 → Human Handoff
 *  4. PRICE MATCH ineligible (margin loss > 15%) → Human Handoff
 */

import type { Ticket, PolicyCheckResult, ActionType } from '@/types';

// =========================================================
// CONSTANTS
// =========================================================
const REFUND_CAP_INR = 500;
const PRICE_MATCH_MAX_MARGIN_LOSS_PCT = 15;
const CONFIDENCE_THRESHOLD = 0.75;
const VALID_ACTIONS: ActionType[] = [
  'refund',
  'replace',
  'check_delivery',
  'price_match',
  'save_subscription',
  'recover_cart',
  'update_ticket',
  'draft_reply',
  'human_verification',
];

// =========================================================
// RULE 1: FRAUD
// =========================================================
export function checkFraudRule(ticket: Pick<Ticket, 'fraud_flag' | 'category'>): PolicyCheckResult {
  const hasFraud = ticket.fraud_flag || ticket.category === 'fraud';
  if (hasFraud) {
    return {
      blocked: true,
      rule: 'FRAUD_FLAG',
      reason: 'Fraud or suspicious activity detected. Mandatory human verification required before any action.',
    };
  }
  return { blocked: false, rule: null, reason: '' };
}

// =========================================================
// RULE 2: LEGAL
// =========================================================
export function checkLegalRule(ticket: Pick<Ticket, 'legal_flag' | 'category' | 'body'>): PolicyCheckResult {
  const hasLegalFlag = ticket.legal_flag || ticket.category === 'legal';
  const legalKeywords = ['chargeback', 'legal', 'lawyer', 'court', 'regulatory', 'consumer protection', 'dispute resolution'];
  const bodyLower = ticket.body.toLowerCase();
  const hasLegalKeyword = legalKeywords.some((kw) => bodyLower.includes(kw));

  if (hasLegalFlag || hasLegalKeyword) {
    return {
      blocked: true,
      rule: 'LEGAL_FLAG',
      reason: 'Legal dispute, chargeback, or regulatory mention detected. Escalated to legal team for review.',
    };
  }
  return { blocked: false, rule: null, reason: '' };
}

// =========================================================
// RULE 3: REFUND CAP
// =========================================================
export function checkRefundCapRule(
  ticket: Pick<Ticket, 'category' | 'amount_inr'>
): PolicyCheckResult {
  if (ticket.category === 'refund' && ticket.amount_inr !== null && ticket.amount_inr !== undefined) {
    if (ticket.amount_inr > REFUND_CAP_INR) {
      return {
        blocked: true,
        rule: 'REFUND_CAP',
        reason: `Refund amount ₹${ticket.amount_inr} exceeds autonomous limit of ₹${REFUND_CAP_INR}. Manager approval required.`,
      };
    }
  }
  return { blocked: false, rule: null, reason: '' };
}

// =========================================================
// RULE 4: PRICE MATCH INELIGIBILITY
// =========================================================
export function checkPriceMatchRule(
  ticket: Pick<Ticket, 'category' | 'amount_inr' | 'metadata'>
): PolicyCheckResult {
  if (ticket.category !== 'price_match') {
    return { blocked: false, rule: null, reason: '' };
  }

  const metadata = ticket.metadata as Record<string, unknown>;
  const competitorPrice = metadata?.competitor_price as number | undefined;
  const originalPrice = ticket.amount_inr;
  const marginDiffPct = metadata?.margin_diff_pct as number | undefined;

  // Check if margin loss exceeds threshold
  if (marginDiffPct !== undefined && marginDiffPct > PRICE_MATCH_MAX_MARGIN_LOSS_PCT) {
    return {
      blocked: true,
      rule: 'PRICE_MATCH_INELIGIBLE',
      reason: `Price match would result in ${marginDiffPct}% margin loss (limit: ${PRICE_MATCH_MAX_MARGIN_LOSS_PCT}%). Escalating for commercial review.`,
    };
  }

  // Calculate from prices if margin_diff_pct not provided
  if (originalPrice !== null && originalPrice !== undefined && competitorPrice !== undefined) {
    const diffPct = ((originalPrice - competitorPrice) / originalPrice) * 100;
    if (diffPct > PRICE_MATCH_MAX_MARGIN_LOSS_PCT) {
      return {
        blocked: true,
        rule: 'PRICE_MATCH_INELIGIBLE',
        reason: `Price match would result in ${diffPct.toFixed(1)}% margin loss (limit: ${PRICE_MATCH_MAX_MARGIN_LOSS_PCT}%). Escalating for commercial review.`,
      };
    }
  }

  return { blocked: false, rule: null, reason: '' };
}

// =========================================================
// MASTER POLICY CHECK — runs all rules in order
// =========================================================
export function runPolicyChecks(ticket: Ticket): PolicyCheckResult {
  // Rule 1: Fraud (highest priority)
  const fraudResult = checkFraudRule(ticket);
  if (fraudResult.blocked) return fraudResult;

  // Rule 2: Legal
  const legalResult = checkLegalRule(ticket);
  if (legalResult.blocked) return legalResult;

  // Rule 3: Refund cap
  const refundResult = checkRefundCapRule(ticket);
  if (refundResult.blocked) return refundResult;

  // Rule 4: Price match
  const priceResult = checkPriceMatchRule(ticket);
  if (priceResult.blocked) return priceResult;

  return { blocked: false, rule: null, reason: '' };
}

// =========================================================
// CONFIDENCE GATE
// =========================================================
export function checkConfidenceGate(confidence: number): PolicyCheckResult {
  if (confidence < CONFIDENCE_THRESHOLD) {
    return {
      blocked: true,
      rule: null,
      reason: `Agent confidence ${(confidence * 100).toFixed(0)}% is below the autonomous threshold of ${(CONFIDENCE_THRESHOLD * 100).toFixed(0)}%. Escalating for human review.`,
    };
  }
  return { blocked: false, rule: null, reason: '' };
}

// =========================================================
// ACTION WHITELIST CHECK
// =========================================================
export function isValidAction(action: string): action is ActionType {
  return VALID_ACTIONS.includes(action as ActionType);
}

// =========================================================
// POLICY REFS BUILDER
// =========================================================
export function buildPolicyRefs(ticket: Ticket): string[] {
  const refs: string[] = ['§1-STANDARD_SUPPORT_POLICY'];

  if (ticket.fraud_flag) refs.push('§2A-1-FRAUD_ZERO_TOLERANCE');
  if (ticket.legal_flag) refs.push('§2A-2-LEGAL_ESCALATION');
  if (ticket.category === 'refund' && ticket.amount_inr !== null) {
    if (ticket.amount_inr > REFUND_CAP_INR) {
      refs.push('§2A-3-REFUND_CAP');
    } else {
      refs.push('§3-REFUND_ELIGIBILITY');
    }
  }
  if (ticket.category === 'price_match') refs.push('§4-PRICE_MATCH_POLICY');
  if (ticket.category === 'subscription') refs.push('§5-RETENTION_POLICY');
  if (ticket.category === 'cart_recovery') refs.push('§6-WINBACK_POLICY');
  if (ticket.category === 'replacement') refs.push('§7-REPLACEMENT_POLICY');
  if (ticket.category === 'delivery') refs.push('§8-DELIVERY_RESOLUTION');

  return refs;
}

export { CONFIDENCE_THRESHOLD, REFUND_CAP_INR, VALID_ACTIONS };

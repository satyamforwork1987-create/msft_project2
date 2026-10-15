import { describe, it, expect } from 'vitest';
import {
  checkFraudRule,
  checkLegalRule,
  checkRefundCapRule,
  checkPriceMatchRule,
  runPolicyChecks,
  checkConfidenceGate,
  isValidAction,
} from '@/lib/policy-engine';
import type { Ticket } from '@/types';

// Helper to build a base ticket for testing
function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    id: 'test-uuid',
    ticket_number: 'TKT-TEST',
    customer_name: 'Test User',
    customer_email: 'test@test.com',
    subject: 'Test',
    body: 'Normal request without any keywords.',
    category: 'general',
    status: 'open',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// =========================================================
// RULE 1: FRAUD TESTS
// =========================================================
describe('Fraud Rule', () => {
  it('blocks ticket with fraud_flag=true', () => {
    const result = checkFraudRule({ fraud_flag: true, category: 'general' });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('FRAUD_FLAG');
  });

  it('blocks ticket with category=fraud', () => {
    const result = checkFraudRule({ fraud_flag: false, category: 'fraud' });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('FRAUD_FLAG');
  });

  it('blocks ticket with both fraud_flag and fraud category', () => {
    const result = checkFraudRule({ fraud_flag: true, category: 'fraud' });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('FRAUD_FLAG');
  });

  it('allows normal ticket through', () => {
    const result = checkFraudRule({ fraud_flag: false, category: 'refund' });
    expect(result.blocked).toBe(false);
    expect(result.rule).toBeNull();
  });
});

// =========================================================
// RULE 2: LEGAL TESTS
// =========================================================
describe('Legal Rule', () => {
  it('blocks ticket with legal_flag=true', () => {
    const result = checkLegalRule({ legal_flag: true, category: 'general', body: 'Normal body' });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('LEGAL_FLAG');
  });

  it('blocks ticket with category=legal', () => {
    const result = checkLegalRule({ legal_flag: false, category: 'legal', body: 'Normal body' });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('LEGAL_FLAG');
  });

  it('blocks ticket mentioning chargeback in body', () => {
    const result = checkLegalRule({
      legal_flag: false,
      category: 'refund',
      body: 'I have filed a chargeback with my bank.',
    });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('LEGAL_FLAG');
  });

  it('blocks ticket mentioning lawyer', () => {
    const result = checkLegalRule({
      legal_flag: false,
      category: 'general',
      body: 'My lawyer has advised me to escalate this.',
    });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('LEGAL_FLAG');
  });

  it('allows normal refund ticket body', () => {
    const result = checkLegalRule({
      legal_flag: false,
      category: 'refund',
      body: 'I want a refund for my broken product.',
    });
    expect(result.blocked).toBe(false);
  });
});

// =========================================================
// RULE 3: REFUND CAP TESTS
// =========================================================
describe('Refund Cap Rule', () => {
  it('blocks refund > ₹500', () => {
    const result = checkRefundCapRule({ category: 'refund', amount_inr: 501 });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('REFUND_CAP');
  });

  it('blocks refund exactly at ₹501', () => {
    const result = checkRefundCapRule({ category: 'refund', amount_inr: 501 });
    expect(result.blocked).toBe(true);
  });

  it('allows refund of exactly ₹500', () => {
    const result = checkRefundCapRule({ category: 'refund', amount_inr: 500 });
    expect(result.blocked).toBe(false);
  });

  it('allows refund below ₹500', () => {
    const result = checkRefundCapRule({ category: 'refund', amount_inr: 350 });
    expect(result.blocked).toBe(false);
  });

  it('does not block non-refund categories even with high amounts', () => {
    const result = checkRefundCapRule({ category: 'price_match', amount_inr: 5000 });
    expect(result.blocked).toBe(false);
  });

  it('does not block refund with null amount', () => {
    const result = checkRefundCapRule({ category: 'refund', amount_inr: null });
    expect(result.blocked).toBe(false);
  });
});

// =========================================================
// RULE 4: PRICE MATCH TESTS
// =========================================================
describe('Price Match Rule', () => {
  it('blocks price match with >15% margin loss via metadata', () => {
    const result = checkPriceMatchRule({
      category: 'price_match',
      amount_inr: 1299,
      metadata: { margin_diff_pct: 23 },
    });
    expect(result.blocked).toBe(true);
    expect(result.rule).toBe('PRICE_MATCH_INELIGIBLE');
  });

  it('blocks price match calculated to >15% loss from prices', () => {
    const result = checkPriceMatchRule({
      category: 'price_match',
      amount_inr: 1000,
      metadata: { competitor_price: 800 }, // 20% loss
    });
    expect(result.blocked).toBe(true);
  });

  it('allows price match with <=15% margin loss', () => {
    const result = checkPriceMatchRule({
      category: 'price_match',
      amount_inr: 1000,
      metadata: { competitor_price: 900 }, // 10% loss - within limit
    });
    expect(result.blocked).toBe(false);
  });

  it('does not apply to non price_match categories', () => {
    const result = checkPriceMatchRule({
      category: 'refund',
      amount_inr: 1000,
      metadata: { margin_diff_pct: 50 },
    });
    expect(result.blocked).toBe(false);
  });
});

// =========================================================
// MASTER POLICY ENGINE — ORDER TESTS
// =========================================================
describe('Master Policy Engine (runPolicyChecks)', () => {
  it('FRAUD beats everything — fraud+legal+high-refund → FRAUD blocked', () => {
    const ticket = makeTicket({
      fraud_flag: true,
      legal_flag: true,
      category: 'refund',
      amount_inr: 9999,
    });
    const result = runPolicyChecks(ticket);
    expect(result.rule).toBe('FRAUD_FLAG');
  });

  it('LEGAL is second — non-fraud legal ticket → LEGAL blocked', () => {
    const ticket = makeTicket({
      fraud_flag: false,
      legal_flag: true,
      category: 'refund',
      amount_inr: 9999,
    });
    const result = runPolicyChecks(ticket);
    expect(result.rule).toBe('LEGAL_FLAG');
  });

  it('REFUND_CAP is third — normal ticket with high refund → REFUND_CAP', () => {
    const ticket = makeTicket({
      category: 'refund',
      amount_inr: 1500,
    });
    const result = runPolicyChecks(ticket);
    expect(result.rule).toBe('REFUND_CAP');
  });

  it('Clean ticket passes all rules', () => {
    const ticket = makeTicket({ category: 'delivery' });
    const result = runPolicyChecks(ticket);
    expect(result.blocked).toBe(false);
    expect(result.rule).toBeNull();
  });
});

// =========================================================
// CONFIDENCE GATE — BOUNDARY TESTS
// =========================================================
describe('Confidence Gate', () => {
  it('blocks confidence of 0.74 (below threshold)', () => {
    const result = checkConfidenceGate(0.74);
    expect(result.blocked).toBe(true);
  });

  it('allows confidence of exactly 0.75 (at threshold)', () => {
    const result = checkConfidenceGate(0.75);
    expect(result.blocked).toBe(false);
  });

  it('allows confidence of 0.76 (above threshold)', () => {
    const result = checkConfidenceGate(0.76);
    expect(result.blocked).toBe(false);
  });

  it('blocks confidence of 0.50', () => {
    const result = checkConfidenceGate(0.5);
    expect(result.blocked).toBe(true);
  });

  it('blocks confidence of 0.00', () => {
    const result = checkConfidenceGate(0.0);
    expect(result.blocked).toBe(true);
  });

  it('allows confidence of 1.00', () => {
    const result = checkConfidenceGate(1.0);
    expect(result.blocked).toBe(false);
  });
});

// =========================================================
// ACTION WHITELIST TESTS
// =========================================================
describe('Action Whitelist', () => {
  it('accepts all 9 valid actions', () => {
    const validActions = [
      'refund', 'replace', 'check_delivery', 'price_match',
      'save_subscription', 'recover_cart', 'update_ticket',
      'draft_reply', 'human_verification',
    ];
    validActions.forEach((action) => {
      expect(isValidAction(action)).toBe(true);
    });
  });

  it('rejects unknown actions', () => {
    expect(isValidAction('delete_account')).toBe(false);
    expect(isValidAction('process_payment')).toBe(false);
    expect(isValidAction('')).toBe(false);
    expect(isValidAction('REFUND')).toBe(false); // case sensitive
  });
});

/**
 * Nova AI Layer
 * Single interface: decide(ticket) → AgentDecision
 * Priority: Gemini → Groq → DEMO_MODE replay
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import Groq from 'groq-sdk';
import { z } from 'zod';
import type { Ticket, AgentDecision, LLMDecision, ActionType } from '@/types';
import {
  runPolicyChecks,
  checkConfidenceGate,
  isValidAction,
  buildPolicyRefs,
} from './policy-engine';

// =========================================================
// ZOD SCHEMA for LLM output validation
// =========================================================
const LLMDecisionSchema = z.object({
  action: z.enum([
    'refund',
    'replace',
    'check_delivery',
    'price_match',
    'save_subscription',
    'recover_cart',
    'update_ticket',
    'draft_reply',
    'human_verification',
  ]),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
  customer_reply: z.string().min(20),
  policy_refs: z.array(z.string()),
});

// =========================================================
// DEMO DECISIONS for fallback / DEMO_MODE
// =========================================================
const DEMO_DECISIONS: Record<string, Partial<LLMDecision>> = {
  refund: {
    action: 'refund',
    confidence: 0.92,
    reasoning: 'Product arrived defective. Customer provided order ID. Refund amount within autonomous limit. Full refund approved.',
    customer_reply: 'Hello Priya, I\'m sorry to hear about your defective headphones. I\'ve processed a full refund of ₹350 to your original payment method. You should see it in 3-5 business days. You\'re welcome to keep or return the item.',
    policy_refs: ['§3-REFUND_ELIGIBILITY', '§1-STANDARD_SUPPORT_POLICY'],
  },
  fraud: {
    action: 'human_verification',
    confidence: 0.0,
    reasoning: 'FRAUD_FLAG: Multiple account signals detected. Mandatory human review.',
    customer_reply: 'Your request has been forwarded to our security team for review.',
    policy_refs: ['§2A-1-FRAUD_ZERO_TOLERANCE'],
  },
  replacement: {
    action: 'replace',
    confidence: 0.89,
    reasoning: 'Product arrived with manufacturing defect (cracked screen), packaging intact. Replacement policy applies.',
    customer_reply: 'Hello Ananya, I\'ve arranged a replacement Kindle Paperwhite for you. You\'ll receive a shipping confirmation within 24 hours. No return of the defective unit is required.',
    policy_refs: ['§7-REPLACEMENT_POLICY', '§1-STANDARD_SUPPORT_POLICY'],
  },
  delivery: {
    action: 'check_delivery',
    confidence: 0.88,
    reasoning: 'Package 5 days overdue, tracking stuck on "Out for Delivery". Initiating carrier investigation.',
    customer_reply: 'Hello Karthik, I\'ve initiated an urgent investigation with our delivery partner. You\'ll receive an update within 24 hours. If unresolved, we\'ll arrange a replacement shipment.',
    policy_refs: ['§8-DELIVERY_RESOLUTION', '§1-STANDARD_SUPPORT_POLICY'],
  },
  price_match: {
    action: 'human_verification',
    confidence: 0.0,
    reasoning: 'PRICE_MATCH_INELIGIBLE: Margin loss exceeds 15% threshold.',
    customer_reply: 'Thank you for bringing this to our attention. We\'re reviewing this pricing request.',
    policy_refs: ['§4-PRICE_MATCH_POLICY'],
  },
  subscription: {
    action: 'save_subscription',
    confidence: 0.85,
    reasoning: 'High-value customer (8 months, LTV ₹3200). Retention offer: 30% discount next 3 months appropriate.',
    customer_reply: 'Hello Vikram, I completely understand. As a valued 8-month member, I\'d like to offer you 30% off your next 3 months (₹X/month instead of ₹Y). Would you like to continue with this special rate?',
    policy_refs: ['§5-RETENTION_POLICY', '§1-STANDARD_SUPPORT_POLICY'],
  },
  cart_recovery: {
    action: 'recover_cart',
    confidence: 0.82,
    reasoning: 'Customer showed genuine interest, high cart value (₹7,998). 10% discount code + free shipping appropriate.',
    customer_reply: 'Hello Deepa! Your cart is still saved. Here\'s an exclusive 10% discount code: NOVA10BACK + free shipping for your Philips Air Fryer and Samsung Galaxy Buds. Code valid for 48 hours!',
    policy_refs: ['§6-WINBACK_POLICY', '§1-STANDARD_SUPPORT_POLICY'],
  },
  legal: {
    action: 'human_verification',
    confidence: 0.0,
    reasoning: 'LEGAL_FLAG: Chargeback filed, legal threats mentioned. Mandatory legal team escalation.',
    customer_reply: 'Your case has been escalated to our legal resolution team. They will contact you within 24 hours.',
    policy_refs: ['§2A-2-LEGAL_ESCALATION'],
  },
};

// =========================================================
// SYSTEM PROMPT BUILDER
// =========================================================
function buildSystemPrompt(): string {
  return `You are Nova, an autonomous AI support agent for an e-commerce platform.
You analyze customer support tickets and decide the best course of action.

VALID ACTIONS (use ONLY these 9):
- refund: Process a refund for an eligible order
- replace: Send a replacement product
- check_delivery: Investigate a delivery issue with the carrier
- price_match: Match a competitor's lower price (if eligible)
- save_subscription: Make a retention offer to prevent cancellation
- recover_cart: Send a win-back offer for abandoned cart
- update_ticket: Update ticket status/notes without further action
- draft_reply: Compose a helpful response to the customer
- human_verification: Flag for human review (use when uncertain)

RESPONSE FORMAT (strict JSON, no markdown):
{
  "action": "<one of the 9 actions>",
  "confidence": <0.00 to 1.00>,
  "reasoning": "<2-3 sentences explaining your decision>",
  "customer_reply": "<professional, empathetic reply to the customer in 2-4 sentences>",
  "policy_refs": ["<relevant policy sections>"]
}

GUIDELINES:
- Be empathetic and professional in customer replies
- High confidence (>0.85) only when situation is clear-cut
- Use human_verification when ANY doubt exists
- Never promise refunds/actions outside your authority
- Customer replies should be warm but concise`;
}

function buildUserPrompt(ticket: Ticket): string {
  return `TICKET #${ticket.ticket_number}
Customer: ${ticket.customer_name} (${ticket.customer_email})
Subject: ${ticket.subject}
Category: ${ticket.category}
Priority: ${ticket.priority}
Amount: ${ticket.amount_inr ? '₹' + ticket.amount_inr : 'N/A'}
Body: ${ticket.body}
Metadata: ${JSON.stringify(ticket.metadata, null, 2)}

Analyze this ticket and respond with the JSON decision.`;
}

// =========================================================
// GEMINI CLIENT
// =========================================================
async function callGemini(ticket: Ticket): Promise<LLMDecision> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-3.8-flash',
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.3,
    },
  });

  const prompt = `${buildSystemPrompt()}\n\n${buildUserPrompt(ticket)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const result = await model.generateContent(prompt);
    clearTimeout(timeout);
    const text = result.response.text();
    const parsed = JSON.parse(text);
    return LLMDecisionSchema.parse(parsed);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// =========================================================
// GROQ FALLBACK CLIENT
// =========================================================
async function callGroq(ticket: Ticket): Promise<LLMDecision> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not set');

  const groq = new Groq({ apiKey });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(ticket) },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 512,
    });

    clearTimeout(timeout);
    const text = completion.choices[0]?.message?.content ?? '';
    const parsed = JSON.parse(text);
    return LLMDecisionSchema.parse(parsed);
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

// =========================================================
// DEMO MODE REPLAY
// =========================================================
function getDemoDecision(ticket: Ticket): LLMDecision {
  const demo = DEMO_DECISIONS[ticket.category] ?? DEMO_DECISIONS['refund'];
  return {
    action: (demo.action as ActionType) ?? 'draft_reply',
    confidence: demo.confidence ?? 0.80,
    reasoning: demo.reasoning ?? 'Demo mode: pre-recorded decision.',
    customer_reply: demo.customer_reply ?? 'Thank you for your message. We will assist you shortly.',
    policy_refs: demo.policy_refs ?? ['§1-STANDARD_SUPPORT_POLICY'],
  };
}

// =========================================================
// LLM CALL WITH RETRY
// =========================================================
async function callLLMWithRetry(ticket: Ticket): Promise<{ decision: LLMDecision; provider: string }> {
  const isDemoMode = process.env.DEMO_MODE === 'true';

  if (isDemoMode) {
    return { decision: getDemoDecision(ticket), provider: 'demo_replay' };
  }

  // Try Gemini first
  try {
    const decision = await callGemini(ticket);
    return { decision, provider: 'gemini-3.8-flash' };
  } catch (geminiErr) {
    console.warn('[Nova] Gemini failed, retrying once:', geminiErr);

    try {
      const decision = await callGemini(ticket);
      return { decision, provider: 'gemini-3.8-flash' };
    } catch {
      console.warn('[Nova] Gemini retry failed, falling back to Groq');
    }
  }

  // Groq fallback
  try {
    const decision = await callGroq(ticket);
    return { decision, provider: 'groq-openai-gpt-oss-120b' };
  } catch (groqErr) {
    console.warn('[Nova] Groq failed, falling back to demo replay:', groqErr);
  }

  // Final fallback: demo replay
  return { decision: getDemoDecision(ticket), provider: 'demo_replay' };
}

// =========================================================
// MAIN DECIDE FUNCTION
// =========================================================
export async function decide(ticket: Ticket): Promise<AgentDecision> {
  // §2-A: Hard rules BEFORE LLM
  const policyResult = runPolicyChecks(ticket);

  if (policyResult.blocked) {
    return {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      outcome: 'escalated',
      action: 'human_verification',
      confidence: 0,
      reasoning: policyResult.reason,
      customer_reply: `Thank you for reaching out, ${ticket.customer_name}. Your request requires specialized review. Our team will contact you within 24 hours.`,
      policy_refs: buildPolicyRefs(ticket),
      escalation_reason: policyResult.reason,
      hard_rule_fired: policyResult.rule,
      llm_provider: null,
    };
  }

  // Call LLM with retry/fallback
  const { decision: llmDecision, provider } = await callLLMWithRetry(ticket);

  // §2-D: Action whitelist check
  if (!isValidAction(llmDecision.action)) {
    return {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      outcome: 'escalated',
      action: 'human_verification',
      confidence: llmDecision.confidence,
      reasoning: `LLM returned invalid action "${llmDecision.action}". Failing safe to human review.`,
      customer_reply: `Thank you for reaching out, ${ticket.customer_name}. Your request is being reviewed by our team.`,
      policy_refs: buildPolicyRefs(ticket),
      escalation_reason: `Invalid action from LLM: ${llmDecision.action}`,
      hard_rule_fired: null,
      llm_provider: provider,
    };
  }

  // §2-B: Confidence gate
  const confidenceCheck = checkConfidenceGate(llmDecision.confidence);
  if (confidenceCheck.blocked) {
    return {
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      outcome: 'escalated',
      action: 'human_verification',
      confidence: llmDecision.confidence,
      reasoning: llmDecision.reasoning,
      customer_reply: `Thank you for reaching out, ${ticket.customer_name}. Your request requires specialist review. We'll respond within 24 hours.`,
      policy_refs: buildPolicyRefs(ticket),
      escalation_reason: confidenceCheck.reason,
      hard_rule_fired: null,
      llm_provider: provider,
    };
  }

  // AUTONOMOUS — all checks passed
  const outcome = provider === 'demo_replay' ? 'demo_replay' : 'autonomous';

  return {
    ticket_id: ticket.id,
    ticket_number: ticket.ticket_number,
    outcome,
    action: llmDecision.action as ActionType,
    confidence: llmDecision.confidence,
    reasoning: llmDecision.reasoning,
    customer_reply: llmDecision.customer_reply,
    policy_refs: [...buildPolicyRefs(ticket), ...llmDecision.policy_refs].filter(
      (v, i, a) => a.indexOf(v) === i
    ),
    escalation_reason: null,
    hard_rule_fired: null,
    llm_provider: provider,
  };
}

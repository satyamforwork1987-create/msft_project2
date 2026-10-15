// Nova Agent Type Definitions

export type TicketCategory =
  | 'refund'
  | 'replacement'
  | 'delivery'
  | 'price_match'
  | 'subscription'
  | 'cart_recovery'
  | 'legal'
  | 'fraud'
  | 'general';

export type TicketStatus =
  | 'open'
  | 'processing'
  | 'autonomous'
  | 'escalated'
  | 'human_resolved'
  | 'closed';

export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export type ActionType =
  | 'refund'
  | 'replace'
  | 'check_delivery'
  | 'price_match'
  | 'save_subscription'
  | 'recover_cart'
  | 'update_ticket'
  | 'draft_reply'
  | 'human_verification';

export type AuditOutcome =
  | 'autonomous'
  | 'escalated'
  | 'human_resolved'
  | 'demo_replay';

export type HardRule =
  | 'FRAUD_FLAG'
  | 'LEGAL_FLAG'
  | 'REFUND_CAP'
  | 'PRICE_MATCH_INELIGIBLE';

export interface Ticket {
  id: string;
  ticket_number: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  body: string;
  category: TicketCategory;
  status: TicketStatus;
  priority: TicketPriority;
  amount_inr: number | null;
  fraud_flag: boolean;
  legal_flag: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditLogEntry {
  id: string;
  ticket_id: string;
  ticket_number: string;
  action: ActionType | string;
  confidence: number | null;
  reasoning: string;
  policy_refs: string[];
  escalation_reason: string | null;
  outcome: AuditOutcome;
  llm_provider: string | null;
  customer_reply: string | null;
  hard_rule_fired: string | null;
  created_at: string;
}

export interface Action {
  id: string;
  ticket_id: string;
  audit_log_id: string | null;
  action_type: ActionType;
  action_data: Record<string, unknown>;
  executed_by: string;
  created_at: string;
}

export interface PolicyCheckResult {
  blocked: boolean;
  rule: HardRule | null;
  reason: string;
}

export interface LLMDecision {
  action: ActionType;
  confidence: number;
  reasoning: string;
  customer_reply: string;
  policy_refs: string[];
}

export interface AgentDecision {
  ticket_id: string;
  ticket_number: string;
  outcome: AuditOutcome;
  action: ActionType | 'human_verification';
  confidence: number | null;
  reasoning: string;
  customer_reply: string;
  policy_refs: string[];
  escalation_reason: string | null;
  hard_rule_fired: HardRule | null;
  llm_provider: string | null;
}

export interface SSEEvent {
  type: 'start' | 'stage' | 'result' | 'complete' | 'error';
  ticket_id?: string;
  ticket_number?: string;
  stage?: 'understanding' | 'reasoning' | 'decision' | 'action' | 'done';
  message?: string;
  decision?: AgentDecision;
  error?: string;
}

export interface ImpactStats {
  total_tickets: number;
  autonomous_count: number;
  escalated_count: number;
  human_resolved_count: number;
  autonomy_rate: number;
  escalation_rate: number;
  hours_saved: number;
  revenue_recovered: number;
}

export interface ChatMessage {
  role: 'user' | 'nova';
  content: string;
  timestamp: string;
}

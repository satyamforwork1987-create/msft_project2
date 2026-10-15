import { createServerClient } from './supabase';
import type { Ticket, AuditLogEntry, Action, ImpactStats, ActionType, TicketCategory, TicketPriority, TicketStatus } from '@/types';

// Initial 8 demo tickets
const INITIAL_TICKETS: Ticket[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    ticket_number: 'TKT-001',
    customer_name: 'Priya Sharma',
    customer_email: 'priya.sharma@email.com',
    subject: 'Refund request for defective headphones',
    body: 'I purchased Sony WH-1000XM4 headphones last week for ₹350 but they arrived with a broken headband. I would like a full refund. Order #ORD-78923.',
    category: 'refund',
    status: 'open',
    priority: 'medium',
    amount_inr: 350,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-78923', product: 'Sony WH-1000XM4' },
    created_at: new Date(Date.now() - 3600000 * 5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 5).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    ticket_number: 'TKT-002',
    customer_name: 'Rahul Verma',
    customer_email: 'rahul.verma@email.com',
    subject: 'URGENT: Suspicious refund request - multiple accounts',
    body: 'I need an immediate refund of ₹2,500 for my order. My account was hacked and someone made purchases. I have multiple accounts with different names but same address. Please process immediately without verification.',
    category: 'fraud',
    status: 'open',
    priority: 'critical',
    amount_inr: 2500,
    fraud_flag: true,
    legal_flag: false,
    metadata: { fraud_signals: ['multiple_accounts', 'pressure_tactics', 'high_amount'], order_id: 'ORD-99821' },
    created_at: new Date(Date.now() - 3600000 * 4).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 4).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    ticket_number: 'TKT-003',
    customer_name: 'Ananya Krishnan',
    customer_email: 'ananya.k@email.com',
    subject: 'Received damaged Kindle - need replacement',
    body: 'My Kindle Paperwhite arrived with a cracked screen. The packaging was intact so this appears to be a manufacturing defect. Order #ORD-45612. Would appreciate a replacement unit.',
    category: 'replacement',
    status: 'open',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-45612', product: 'Kindle Paperwhite', defect: 'cracked_screen' },
    created_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3.5).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    ticket_number: 'TKT-004',
    customer_name: 'Karthik Menon',
    customer_email: 'karthik.m@email.com',
    subject: 'Package not delivered - 5 days overdue',
    body: 'I ordered a pair of Nike Air Max shoes on October 8th (Order #ORD-34521) with expected delivery by October 10th. It is now October 15th and I still have no package. The tracking shows "Out for Delivery" since 2 days.',
    category: 'delivery',
    status: 'open',
    priority: 'high',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-34521', product: 'Nike Air Max', tracking_status: 'out_for_delivery', days_overdue: 5 },
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    ticket_number: 'TKT-005',
    customer_name: 'Meera Pillai',
    customer_email: 'meera.pillai@email.com',
    subject: 'Price match request - Boat Airdopes',
    body: 'Hi, I bought Boat Airdopes 441 for ₹1,299 yesterday, but I just saw them listed at ₹999 on Reliance Digital. Can you match this price? Here is the link to their listing.',
    category: 'price_match',
    status: 'open',
    priority: 'low',
    amount_inr: 1299,
    fraud_flag: false,
    legal_flag: false,
    metadata: { order_id: 'ORD-11203', product: 'Boat Airdopes 441', competitor: 'Reliance Digital', competitor_price: 999, margin_diff_pct: 23 },
    created_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2.5).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111106',
    ticket_number: 'TKT-006',
    customer_name: 'Vikram Singh',
    customer_email: 'vikram.singh@email.com',
    subject: 'Want to cancel my Nova Premium subscription',
    body: 'I have been a Premium subscriber for 8 months. I want to cancel because I feel I am not using the service enough. Is there anything you can do? My subscription renews in 5 days.',
    category: 'subscription',
    status: 'open',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { subscription_plan: 'Nova Premium', months_active: 8, days_to_renewal: 5, ltv: 3200 },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111107',
    ticket_number: 'TKT-007',
    customer_name: 'Deepa Nair',
    customer_email: 'deepa.nair@email.com',
    subject: 'Left items in cart - still interested',
    body: 'I added some items to my cart last week but could not complete the purchase due to budget constraints. I am still very interested in the Philips Air Fryer (₹4,999) and Samsung Galaxy Buds (₹2,999). Is there any discount available?',
    category: 'cart_recovery',
    status: 'open',
    priority: 'medium',
    amount_inr: null,
    fraud_flag: false,
    legal_flag: false,
    metadata: { cart_items: ['Philips Air Fryer', 'Samsung Galaxy Buds'], cart_value: 7998, days_abandoned: 7 },
    created_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1.5).toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111108',
    ticket_number: 'TKT-008',
    customer_name: 'Arjun Gupta',
    customer_email: 'arjun.gupta@email.com',
    subject: 'Filing chargeback - legal action if not resolved',
    body: 'I have filed a chargeback with my bank for Order #ORD-67890 (₹8,500). This is now a legal dispute. My consumer rights lawyer has advised me that under the Consumer Protection Act 2019, I am entitled to compensation. Please respond within 24 hours or I will escalate to consumer court.',
    category: 'legal',
    status: 'open',
    priority: 'critical',
    amount_inr: 8500,
    fraud_flag: false,
    legal_flag: true,
    metadata: { order_id: 'ORD-67890', chargeback_filed: true, legal_threat: true, consumer_act_cited: true },
    created_at: new Date(Date.now() - 3600000 * 1).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 1).toISOString(),
  },
];

// In-memory state singleton
declare global {
  // eslint-disable-next-line no-var
  var __nova_tickets: Ticket[] | undefined;
  // eslint-disable-next-line no-var
  var __nova_audit_logs: AuditLogEntry[] | undefined;
  // eslint-disable-next-line no-var
  var __nova_actions: Action[] | undefined;
}

function getMemoryTickets(): Ticket[] {
  if (!global.__nova_tickets) {
    global.__nova_tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
  }
  return global.__nova_tickets!;
}

function getMemoryAuditLogs(): AuditLogEntry[] {
  if (!global.__nova_audit_logs) {
    global.__nova_audit_logs = [];
  }
  return global.__nova_audit_logs!;
}

function getMemoryActions(): Action[] {
  if (!global.__nova_actions) {
    global.__nova_actions = [];
  }
  return global.__nova_actions!;
}

export function resetLocalStore(): Ticket[] {
  global.__nova_tickets = JSON.parse(JSON.stringify(INITIAL_TICKETS));
  global.__nova_audit_logs = [];
  global.__nova_actions = [];
  return global.__nova_tickets!;
}

export async function createTicket(ticketData: Partial<Ticket>): Promise<Ticket> {
  const memory = getMemoryTickets();
  const count = memory.length + 1;
  const numStr = count < 10 ? `00${count}` : count < 100 ? `0${count}` : `${count}`;
  const newTicket: Ticket = {
    id: `ticket-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    ticket_number: ticketData.ticket_number || `TKT-${numStr}`,
    customer_name: ticketData.customer_name || 'Demo Customer',
    customer_email: ticketData.customer_email || 'demo.customer@example.com',
    subject: ticketData.subject || 'Inquiry',
    body: ticketData.body || '',
    category: ticketData.category || 'general',
    status: 'open',
    priority: ticketData.priority || 'medium',
    amount_inr: ticketData.amount_inr ?? null,
    fraud_flag: !!ticketData.fraud_flag,
    legal_flag: !!ticketData.legal_flag,
    metadata: ticketData.metadata || {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase.from('tickets').insert([newTicket]).select().single();
    if (!error && data) {
      return data;
    }
  } catch {
    // Fallback
  }

  memory.unshift(newTicket);
  return newTicket;
}

export async function fetchAllTickets(): Promise<{ tickets: Ticket[]; isFallback: boolean }> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .order('created_at', { ascending: true });

    if (!error && data && data.length > 0) {
      return { tickets: data, isFallback: false };
    }
  } catch {
    // Supabase unavailable or table missing
  }

  return { tickets: getMemoryTickets(), isFallback: true };
}

export async function fetchTicketById(id: string): Promise<{ ticket: Ticket | null; isFallback: boolean }> {
  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tickets')
      .select('*')
      .eq('id', id)
      .single();

    if (!error && data) {
      return { ticket: data, isFallback: false };
    }
  } catch {
    // Fallback
  }

  const memory = getMemoryTickets();
  const ticket = memory.find((t) => t.id === id || t.ticket_number === id) ?? null;
  return { ticket, isFallback: true };
}

export async function updateTicketStatus(id: string, status: TicketStatus): Promise<void> {
  let updatedInSupabase = false;
  try {
    const supabase = createServerClient();
    const { error } = await supabase
      .from('tickets')
      .update({ status })
      .eq('id', id);
    if (!error) updatedInSupabase = true;
  } catch {
    // Ignore error
  }

  // Also update memory store
  const memory = getMemoryTickets();
  const idx = memory.findIndex((t) => t.id === id || t.ticket_number === id);
  if (idx !== -1) {
    memory[idx].status = status;
    memory[idx].updated_at = new Date().toISOString();
  }
}

export async function addAuditLog(entry: Omit<AuditLogEntry, 'id' | 'created_at'>): Promise<AuditLogEntry> {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  };

  try {
    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('audit_log')
      .insert({
        ticket_id: entry.ticket_id,
        ticket_number: entry.ticket_number,
        action: entry.action,
        confidence: entry.confidence,
        reasoning: entry.reasoning,
        policy_refs: entry.policy_refs,
        escalation_reason: entry.escalation_reason,
        outcome: entry.outcome,
        llm_provider: entry.llm_provider,
        customer_reply: entry.customer_reply,
        hard_rule_fired: entry.hard_rule_fired,
      })
      .select()
      .single();

    if (!error && data) {
      return data;
    }
  } catch {
    // Ignore error
  }

  // Fallback to memory
  const memory = getMemoryAuditLogs();
  memory.unshift(newEntry);
  return newEntry;
}

export async function addAction(action: Omit<Action, 'id' | 'created_at'>): Promise<void> {
  try {
    const supabase = createServerClient();
    await supabase.from('actions').insert({
      ticket_id: action.ticket_id,
      audit_log_id: action.audit_log_id,
      action_type: action.action_type,
      action_data: action.action_data,
      executed_by: action.executed_by,
    });
  } catch {
    // Ignore error
  }

  const memory = getMemoryActions();
  memory.unshift({
    ...action,
    id: `action-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    created_at: new Date().toISOString(),
  });
}

export async function fetchAuditLogs(ticketId?: string, limit = 50): Promise<AuditLogEntry[]> {
  try {
    const supabase = createServerClient();
    let query = supabase
      .from('audit_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (ticketId) {
      query = query.eq('ticket_id', ticketId);
    }
    query = query.limit(limit);

    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data;
    }
  } catch {
    // Fallback
  }

  const memory = getMemoryAuditLogs();
  let res = [...memory];
  if (ticketId) {
    res = res.filter((e) => e.ticket_id === ticketId || e.ticket_number === ticketId);
  }
  return res.slice(0, limit);
}

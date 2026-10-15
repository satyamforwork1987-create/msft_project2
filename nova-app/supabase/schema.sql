-- Nova Agent: Supabase Schema
-- Run this entire file in the Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ===========================================
-- TICKETS TABLE
-- ===========================================
CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number TEXT UNIQUE NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT NOT NULL,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN (
    'refund', 'replacement', 'delivery', 'price_match',
    'subscription', 'cart_recovery', 'legal', 'fraud', 'general'
  )),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN (
    'open', 'processing', 'autonomous', 'escalated', 'human_resolved', 'closed'
  )),
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  amount_inr NUMERIC(10, 2),
  fraud_flag BOOLEAN NOT NULL DEFAULT FALSE,
  legal_flag BOOLEAN NOT NULL DEFAULT FALSE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- AUDIT LOG TABLE (append-only, NO UPDATE/DELETE)
-- ===========================================
CREATE TABLE IF NOT EXISTS audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  ticket_number TEXT NOT NULL,
  action TEXT NOT NULL,
  confidence NUMERIC(4, 2),
  reasoning TEXT NOT NULL,
  policy_refs TEXT[] DEFAULT '{}',
  escalation_reason TEXT,
  outcome TEXT NOT NULL CHECK (outcome IN (
    'autonomous', 'escalated', 'human_resolved', 'demo_replay'
  )),
  llm_provider TEXT,
  customer_reply TEXT,
  hard_rule_fired TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- CRITICAL: Disable DELETE and UPDATE on audit_log via RLS
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_log_insert_only" ON audit_log
  FOR INSERT WITH CHECK (TRUE);

CREATE POLICY "audit_log_select_all" ON audit_log
  FOR SELECT USING (TRUE);

-- No UPDATE or DELETE policies = those operations are blocked

-- ===========================================
-- ACTIONS TABLE (tracks executed actions)
-- ===========================================
CREATE TABLE IF NOT EXISTS actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
  audit_log_id UUID REFERENCES audit_log(id),
  action_type TEXT NOT NULL CHECK (action_type IN (
    'refund', 'replace', 'check_delivery', 'price_match',
    'save_subscription', 'recover_cart', 'update_ticket',
    'draft_reply', 'human_verification'
  )),
  action_data JSONB DEFAULT '{}',
  executed_by TEXT NOT NULL DEFAULT 'nova_agent',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ===========================================
-- ENABLE RLS ON ALL TABLES
-- ===========================================
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE actions ENABLE ROW LEVEL SECURITY;

-- Allow all for now (service role bypasses RLS anyway)
CREATE POLICY "tickets_all" ON tickets FOR ALL USING (TRUE) WITH CHECK (TRUE);
CREATE POLICY "actions_all" ON actions FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- ===========================================
-- TRIGGER: auto-update updated_at on tickets
-- ===========================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER tickets_updated_at
  BEFORE UPDATE ON tickets
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- INDEXES for performance
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_audit_log_ticket_id ON audit_log(ticket_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actions_ticket_id ON actions(ticket_id);

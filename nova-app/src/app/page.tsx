'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import type { Ticket, AuditLogEntry, SSEEvent, AgentDecision, ChatMessage, ImpactStats } from '@/types';
import { ConfidenceDial } from '@/components/ConfidenceDial';
import { ImpactTab } from '@/components/ImpactTab';
import { TicketInspectionModal } from '@/components/TicketInspectionModal';
import { NewTicketModal } from '@/components/NewTicketModal';

// ================================================
// UTILITY: Fetch wrapper
// ================================================
async function apiFetch<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, options);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? res.statusText);
  }
  return res.json();
}

// ================================================
// UTILITY: Format helpers
// ================================================
function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function categoryLabel(cat: string) {
  const map: Record<string, string> = {
    refund: 'Refund', replacement: 'Replacement', delivery: 'Delivery',
    price_match: 'Price Match', subscription: 'Subscription', cart_recovery: 'Cart Recovery',
    legal: 'Legal', fraud: 'Fraud', general: 'General',
  };
  return map[cat] ?? cat;
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    refund: 'Refund Processed', replace: 'Replacement Sent', check_delivery: 'Delivery Checked',
    price_match: 'Price Matched', save_subscription: 'Subscription Saved', recover_cart: 'Cart Recovered',
    update_ticket: 'Ticket Updated', draft_reply: 'Reply Drafted', human_verification: 'Human Review',
  };
  return map[action] ?? action;
}

// ================================================
// SUB-COMPONENTS
// ================================================

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    open: 'Open', processing: 'Processing', autonomous: 'Autonomous',
    escalated: 'Escalated', human_resolved: 'Resolved', closed: 'Closed',
  };
  return (
    <span className={`badge badge-${status}`}>
      {status === 'processing' && <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-current mr-0.5" />}
      {labels[status] ?? status}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`badge badge-${priority}`}>{priority}</span>;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    autonomous: { label: '✓ Autonomous', cls: 'badge-autonomous' },
    escalated: { label: '↑ Escalated', cls: 'badge-escalated' },
    human_resolved: { label: '✓ Human Resolved', cls: 'badge-human_resolved' },
    demo_replay: { label: '▶ Demo Replay', cls: 'badge-autonomous' },
  };
  const c = cfg[outcome] ?? { label: outcome, cls: 'badge-open' };
  return <span className={`badge ${c.cls}`}>{c.label}</span>;
}

// Pipeline stage component
function PipelineStages({
  stages,
  activeStage,
}: {
  stages: { key: string; label: string }[];
  activeStage: string | null;
}) {
  return (
    <div className="flex gap-1 items-center mt-2 flex-wrap">
      {stages.map((s, i) => {
        const stageOrder = stages.findIndex((x) => x.key === activeStage);
        const thisOrder = i;
        const isDone = stageOrder > thisOrder;
        const isActive = s.key === activeStage;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              className={`pipeline-stage text-xs px-2 py-0.5 rounded transition-all ${
                isActive ? 'active' : isDone ? 'done' : 'pending'
              }`}
            >
              {isDone && <span>✓</span>}
              {isActive && <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-current" />}
              {!isDone && !isActive && <span>○</span>}
              <span className="ml-1">{s.label}</span>
            </div>
            {i < stages.length - 1 && <span className="text-faint text-xs">→</span>}
          </div>
        );
      })}
    </div>
  );
}

// Dark mode toggle
function DarkModeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5"
      title="Toggle dark mode"
    >
      <span>{dark ? '☀' : '◑'}</span>
      <span>{dark ? 'Light' : 'Dark'}</span>
    </button>
  );
}

// Quick Prompt Chips
const PROMPT_CHIPS = [
  'Why was TKT-002 escalated?',
  'What decision was made for TKT-001?',
  'Which tickets violated policy guardrails?',
  'How many tickets were handled autonomously?',
];

// ================================================
// MAIN COMPONENT
// ================================================
const PIPELINE_STAGES = [
  { key: 'understanding', label: 'Understanding' },
  { key: 'reasoning', label: 'Reasoning' },
  { key: 'decision', label: 'Decision' },
  { key: 'action', label: 'Action' },
  { key: 'done', label: 'Done' },
];

export default function NovaConsole() {
  const [activeTab, setActiveTab] = useState<'tickets' | 'handoff' | 'audit' | 'impact'>('tickets');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
  const [running, setRunning] = useState(false);
  const [streamLog, setStreamLog] = useState<string[]>([]);
  const [ticketStages, setTicketStages] = useState<Record<string, string>>({});
  const [decisions, setDecisions] = useState<Record<string, AgentDecision>>({});
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [dark, setDark] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [healthStatus, setHealthStatus] = useState<Record<string, { status: string; message: string }> | null>(null);

  // Interactive UI state
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [inspectingTicket, setInspectingTicket] = useState<Ticket | null>(null);
  const [isNewTicketModalOpen, setIsNewTicketModalOpen] = useState(false);
  const [processingTickets, setProcessingTickets] = useState<Record<string, boolean>>({});
  const [handoffNotes, setHandoffNotes] = useState<Record<string, string>>({});
  const [auditSearchQuery, setAuditSearchQuery] = useState('');
  const [auditOutcomeFilter, setAuditOutcomeFilter] = useState<string>('all');

  const streamRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLDivElement>(null);

  // Load data
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [ticketsRes, auditRes] = await Promise.all([
        apiFetch<{ tickets?: Ticket[] }>('/api/tickets'),
        apiFetch<{ entries: AuditLogEntry[] }>('/api/audit'),
      ]);
      setTickets(ticketsRes.tickets ?? []);
      setAuditLog(auditRes.entries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    // Check health on mount
    fetch('/api/health')
      .then((r) => r.json())
      .then((d) => setHealthStatus(d.checks))
      .catch(() => null);
  }, [loadData]);

  // Dark mode
  useEffect(() => {
    document.body.classList.toggle('dark', dark);
  }, [dark]);

  // Auto-scroll stream
  useEffect(() => {
    if (streamRef.current) {
      streamRef.current.scrollTop = streamRef.current.scrollHeight;
    }
  }, [streamLog]);

  // Auto-scroll chat
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [chat]);

  // =============================================
  // RUN ALL — SSE
  // =============================================
  const runAll = async () => {
    setRunning(true);
    setStreamLog([]);
    setTicketStages({});
    toast.info('Starting Nova batch pipeline...');

    try {
      const response = await fetch('/api/agent/run-all');
      if (!response.body) throw new Error('No response stream');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          try {
            const event: SSEEvent = JSON.parse(line.slice(6));
            handleSSEEvent(event);
          } catch {
            // skip malformed
          }
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Stream failed';
      setStreamLog((prev) => [...prev, `❌ Error: ${msg}`]);
      toast.error(`Run All Error: ${msg}`);
    } finally {
      setRunning(false);
      setTimeout(loadData, 500);
    }
  };

  // =============================================
  // RUN SINGLE TICKET
  // =============================================
  const runSingleTicket = async (ticketId: string) => {
    setProcessingTickets((prev) => ({ ...prev, [ticketId]: true }));
    const targetTicket = tickets.find((t) => t.id === ticketId);
    toast.info(`Running Nova on ${targetTicket?.ticket_number || ticketId}...`);

    try {
      const res = await apiFetch<{
        success: boolean;
        decision: AgentDecision;
        audit_id?: string;
      }>('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId }),
      });

      if (res.decision) {
        setDecisions((prev) => ({ ...prev, [res.decision.ticket_number]: res.decision }));
        if (res.decision.outcome === 'autonomous') {
          toast.success(`Autonomous: ${res.decision.ticket_number}`, {
            description: `${actionLabel(res.decision.action)} · Conf: ${((res.decision.confidence ?? 0) * 100).toFixed(0)}%`,
          });
        } else {
          toast.warning(`Escalated: ${res.decision.ticket_number}`, {
            description: res.decision.escalation_reason || 'Guardrail intercepted to human handoff',
          });
        }
      }

      await loadData();
    } catch (err) {
      toast.error(`Failed to process ticket: ${err instanceof Error ? err.message : 'Error'}`);
    } finally {
      setProcessingTickets((prev) => ({ ...prev, [ticketId]: false }));
    }
  };

  // =============================================
  // RESET DEMO
  // =============================================
  const resetDemo = async () => {
    try {
      setLoading(true);
      await fetch('/api/tickets', { method: 'POST', body: JSON.stringify({ action: 'reset' }) });
      await loadData();
      setStreamLog([]);
      setTicketStages({});
      setDecisions({});
      toast.success('All demo tickets reset to initial open state');
    } catch (err) {
      console.error('Reset failed:', err);
      toast.error('Failed to reset demo tickets');
    } finally {
      setLoading(false);
    }
  };

  // =============================================
  // CREATE SIMULATION TICKET
  // =============================================
  const handleCreateTicket = async (ticketData: Partial<Ticket>) => {
    try {
      const res = await apiFetch<{ success: boolean; ticket: Ticket }>('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: ticketData }),
      });
      toast.success(`Simulation ticket injected: ${res.ticket.ticket_number}`);
      await loadData();
    } catch (err) {
      toast.error(`Failed to inject ticket: ${err instanceof Error ? err.message : 'Error'}`);
    }
  };

  function handleSSEEvent(event: SSEEvent) {
    switch (event.type) {
      case 'start':
        setStreamLog((prev) => [...prev, `▶ ${event.message}`]);
        break;
      case 'stage':
        if (event.ticket_number && event.stage) {
          setTicketStages((prev) => ({ ...prev, [event.ticket_number!]: event.stage! }));
          setStreamLog((prev) => [
            ...prev,
            `  ${event.ticket_number} → ${event.stage?.toUpperCase()} — ${event.message}`,
          ]);
        }
        break;
      case 'result':
        if (event.decision && event.ticket_number) {
          setDecisions((prev) => ({ ...prev, [event.ticket_number!]: event.decision! }));
          setTicketStages((prev) => ({ ...prev, [event.ticket_number!]: 'done' }));
          const d = event.decision;
          setStreamLog((prev) => [
            ...prev,
            `  ✓ ${event.ticket_number} → ${d.outcome.toUpperCase()} | ${d.action} | conf: ${d.confidence ? (d.confidence * 100).toFixed(0) + '%' : 'N/A'}`,
          ]);
          if (d.outcome === 'autonomous') {
            toast.success(`Resolved ${event.ticket_number}: ${actionLabel(d.action)}`);
          } else {
            toast.warning(`Escalated ${event.ticket_number}: ${d.escalation_reason?.slice(0, 50)}...`);
          }
        }
        break;
      case 'complete':
        setStreamLog((prev) => [...prev, `✅ ${event.message}`]);
        toast.success('Batch processing completed!');
        break;
      case 'error':
        setStreamLog((prev) => [...prev, `❌ ${event.error}`]);
        toast.error(`Error: ${event.error}`);
        break;
    }
  }

  // =============================================
  // CHAT
  // =============================================
  const sendChat = async (overrideQuery?: string) => {
    const question = (overrideQuery ?? chatInput).trim();
    if (!question || chatLoading) return;
    setChatInput('');
    const userMsg: ChatMessage = { role: 'user', content: question, timestamp: new Date().toISOString() };
    setChat((prev) => [...prev, userMsg]);
    setChatLoading(true);

    try {
      const res = await apiFetch<{ answer: string }>('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      const novaMsg: ChatMessage = { role: 'nova', content: res.answer, timestamp: new Date().toISOString() };
      setChat((prev) => [...prev, novaMsg]);
    } catch (err) {
      const novaMsg: ChatMessage = {
        role: 'nova',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to get answer'}`,
        timestamp: new Date().toISOString(),
      };
      setChat((prev) => [...prev, novaMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  // =============================================
  // HANDOFF ACTIONS
  // =============================================
  const handleHandoff = async (ticketId: string, resolution: 'approved' | 'rejected') => {
    const notes = handoffNotes[ticketId] || '';
    const ticket = tickets.find((t) => t.id === ticketId);
    try {
      await apiFetch('/api/handoff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticketId, resolution, notes }),
      });
      if (resolution === 'approved') {
        toast.success(`Ticket ${ticket?.ticket_number || ticketId} approved by human`);
      } else {
        toast.error(`Ticket ${ticket?.ticket_number || ticketId} rejected by human`);
      }
      setHandoffNotes((prev) => {
        const next = { ...prev };
        delete next[ticketId];
        return next;
      });
      await loadData();
    } catch (err) {
      toast.error(`Error: ${err instanceof Error ? err.message : 'Failed to process'}`);
    }
  };

  // =============================================
  // COMPUTED & FILTERED DATA
  // =============================================
  const escalatedTickets = useMemo(() => {
    return tickets.filter((t) => t.status === 'escalated');
  }, [tickets]);

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const match =
          t.ticket_number.toLowerCase().includes(q) ||
          t.customer_name.toLowerCase().includes(q) ||
          t.customer_email.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.body.toLowerCase().includes(q);
        if (!match) return false;
      }
      // Status filter
      if (statusFilter !== 'all') {
        if (statusFilter === 'fraud' && !t.fraud_flag) return false;
        else if (statusFilter === 'legal' && !t.legal_flag) return false;
        else if (statusFilter !== 'fraud' && statusFilter !== 'legal' && t.status !== statusFilter) return false;
      }
      // Category filter
      if (categoryFilter !== 'all' && t.category !== categoryFilter) {
        return false;
      }
      return true;
    });
  }, [tickets, searchQuery, statusFilter, categoryFilter]);

  const filteredAuditLogs = useMemo(() => {
    return auditLog.filter((entry) => {
      if (auditSearchQuery.trim()) {
        const q = auditSearchQuery.toLowerCase();
        const match =
          entry.ticket_number.toLowerCase().includes(q) ||
          entry.action.toLowerCase().includes(q) ||
          entry.reasoning.toLowerCase().includes(q);
        if (!match) return false;
      }
      if (auditOutcomeFilter !== 'all' && entry.outcome !== auditOutcomeFilter) {
        return false;
      }
      return true;
    });
  }, [auditLog, auditSearchQuery, auditOutcomeFilter]);

  const stats: ImpactStats = useMemo(() => {
    const total = auditLog.length;
    const autoCount = auditLog.filter((a) => a.outcome === 'autonomous' || a.outcome === 'demo_replay').length;
    const escCount = auditLog.filter((a) => a.outcome === 'escalated').length;
    const humanCount = auditLog.filter((a) => a.outcome === 'human_resolved').length;
    return {
      total_tickets: total,
      autonomous_count: autoCount,
      escalated_count: escCount,
      human_resolved_count: humanCount,
      autonomy_rate: total > 0 ? (autoCount / total) * 100 : 0,
      escalation_rate: total > 0 ? (escCount / total) * 100 : 0,
      hours_saved: autoCount * (7 / 60),
      revenue_recovered: auditLog
        .filter((a) => (a.outcome === 'autonomous' || a.outcome === 'demo_replay') && (a.action === 'recover_cart' || a.action === 'save_subscription'))
        .reduce((acc) => acc + 2500, 0),
      avg_confidence:
        auditLog.filter((a) => a.confidence !== null).length > 0
          ? auditLog.filter((a) => a.confidence !== null).reduce((sum, a) => sum + (a.confidence ?? 0), 0) /
            auditLog.filter((a) => a.confidence !== null).length
          : 0,
      hard_rules_triggered: auditLog.filter((a) => a.hard_rule_fired !== null).length,
    };
  }, [auditLog]);

  return (
    <div className={`min-h-screen ${dark ? 'dark' : ''}`}>
      {/* JUDGE LIVE STORE LINK BANNER */}
      <div className="bg-[#1E1812] text-amber-200 text-xs py-2 px-6 border-b border-amber-900/40 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="bg-amber-500 text-black text-[10px] font-bold px-2 py-0.5 rounded uppercase font-mono">
            Demo Showcase
          </span>
          <span>
            Connected to Live Customer Storefront: <strong>Aura Electronics</strong>
          </span>
        </div>
        <Link
          href="/store"
          className="inline-flex items-center gap-1 font-semibold text-amber-400 hover:text-amber-300 transition-colors underline underline-offset-2"
        >
          <span>🛍️ Open Customer Storefront & Live Support Widget</span>
          <span>➔</span>
        </Link>
      </div>

      {/* HEADER */}
      <header className="paper-card rounded-none border-x-0 border-t-0 sticky top-0 z-40 backdrop-blur-md bg-opacity-90">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl">🌌</span>
                <h1 className="font-display text-2xl tracking-tight" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                  Nova
                </h1>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-bold uppercase tracking-wider">
                  v2.0 Guardrails
                </span>
              </div>
              <p className="text-xs mt-0.5" style={{ color: 'var(--ink-faint)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Autonomous AI Agent Console
              </p>
            </div>

            {/* Health indicators */}
            {healthStatus && (
              <div className="hidden md:flex items-center gap-3 ml-4 pl-4" style={{ borderLeft: '1px solid var(--card-border)' }}>
                {Object.entries(healthStatus).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5 text-xs" title={val.message}>
                    <span
                      style={{
                        width: 7,
                        height: 7,
                        borderRadius: '50%',
                        background: val.status === 'ok' ? 'var(--success)' : 'var(--danger)',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: 'var(--ink-faint)', textTransform: 'capitalize' }}>{key}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <Link
              href="/store"
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-700/10 text-amber-700 dark:text-amber-400 border border-amber-700/20 hover:bg-amber-700/20 transition-all flex items-center gap-1.5"
            >
              <span>🛍️ Storefront</span>
            </Link>
            <button
              onClick={() => setIsNewTicketModalOpen(true)}
              className="px-3 py-1.5 text-xs font-medium rounded border transition-all flex items-center gap-1.5 hover:border-amber-600/50"
              style={{
                borderColor: 'var(--card-border)',
                color: dark ? 'var(--dark-text)' : 'var(--ink)',
                background: dark ? 'var(--dark-surface)' : 'white',
              }}
              title="Inject a simulation ticket"
            >
              <span>+</span>
              <span>Simulate Ticket</span>
            </button>
            <button
              onClick={resetDemo}
              disabled={running || loading}
              className="px-3 py-1.5 text-xs font-mono tracking-wider rounded border transition-colors flex items-center gap-1.5 hover:bg-black/5 dark:hover:bg-white/5"
              style={{
                borderColor: 'var(--card-border)',
                color: dark ? 'var(--dark-muted)' : 'var(--ink-light)',
                background: dark ? 'var(--dark-surface)' : 'white',
              }}
              title="Reset all demo tickets back to initial open state"
            >
              ↺ Reset
            </button>
            <button
              onClick={runAll}
              disabled={running || loading}
              className="btn-primary"
              id="run-all-btn"
            >
              {running ? (
                <>
                  <span className="pulse-dot inline-block w-2 h-2 rounded-full bg-current" />
                  Processing Batch...
                </>
              ) : (
                <>
                  <span>▶</span>
                  Run All
                </>
              )}
            </button>
            <DarkModeToggle dark={dark} onToggle={() => setDark(!dark)} />
          </div>
        </div>

        {/* TAB BAR */}
        <div className="max-w-7xl mx-auto px-6">
          <div className="tab-bar">
            {[
              { key: 'tickets', label: 'Tickets', count: tickets.length },
              { key: 'handoff', label: 'Human Handoff', count: escalatedTickets.length },
              { key: 'audit', label: 'Audit Log', count: auditLog.length },
              { key: 'impact', label: 'Impact' },
            ].map((tab) => (
              <button
                key={tab.key}
                className={`tab-item ${activeTab === tab.key ? 'active' : ''}`}
                onClick={() => setActiveTab(tab.key as typeof activeTab)}
                id={`tab-${tab.key}`}
              >
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span
                    className="ml-1.5 text-xs px-1.5 py-0.5 rounded-full transition-colors"
                    style={{
                      background: activeTab === tab.key ? 'var(--ink)' : 'var(--cream-darker, #d5cec4)',
                      color: activeTab === tab.key ? 'var(--cream)' : 'var(--ink-muted)',
                    }}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* MAIN CONTENT */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {error && (
          <div className="paper-card p-4 mb-4 border-l-4" style={{ borderLeftColor: 'var(--danger)' }}>
            <p className="text-danger text-sm font-medium">Error: {error}</p>
            <button onClick={loadData} className="btn-outline text-xs mt-2">Retry</button>
          </div>
        )}

        {/* ===== TICKETS TAB ===== */}
        {activeTab === 'tickets' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Ticket list column */}
            <div className="lg:col-span-2 space-y-4">
              {/* Interactive Search & Filter Toolbar */}
              <div className="paper-card p-3.5 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search tickets by #, customer, subject..."
                      className="input-editorial w-full text-xs pl-8 pr-3 py-1.5"
                    />
                    <span className="absolute left-2.5 top-1.5 text-xs text-muted">🔍</span>
                    {searchQuery && (
                      <button
                        onClick={() => setSearchQuery('')}
                        className="absolute right-2.5 top-1.5 text-xs text-muted hover:text-ink"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="input-editorial text-xs py-1.5"
                  >
                    <option value="all">All Categories</option>
                    <option value="refund">Refunds</option>
                    <option value="replacement">Replacements</option>
                    <option value="delivery">Delivery</option>
                    <option value="price_match">Price Match</option>
                    <option value="subscription">Subscription</option>
                    <option value="cart_recovery">Cart Recovery</option>
                    <option value="fraud">Fraud</option>
                    <option value="legal">Legal</option>
                  </select>
                </div>

                {/* Status Pills */}
                <div className="flex items-center gap-1.5 flex-wrap text-xs">
                  <span className="text-muted font-mono text-[11px] uppercase mr-1">Filter:</span>
                  {[
                    { key: 'all', label: `All (${tickets.length})` },
                    { key: 'open', label: `Open (${tickets.filter((t) => t.status === 'open').length})` },
                    { key: 'autonomous', label: `Autonomous (${tickets.filter((t) => t.status === 'autonomous').length})` },
                    { key: 'escalated', label: `Escalated (${tickets.filter((t) => t.status === 'escalated').length})` },
                    { key: 'fraud', label: '🚨 Fraud' },
                    { key: 'legal', label: '⚖️ Legal' },
                  ].map((p) => (
                    <button
                      key={p.key}
                      onClick={() => setStatusFilter(p.key)}
                      className={`px-2 py-0.5 rounded-full border transition-all text-[11px] ${
                        statusFilter === p.key
                          ? 'bg-amber-600 text-white border-amber-600 font-medium'
                          : 'border-transparent bg-black/5 dark:bg-white/5 text-muted hover:text-ink'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  {(searchQuery || statusFilter !== 'all' || categoryFilter !== 'all') && (
                    <button
                      onClick={() => {
                        setSearchQuery('');
                        setStatusFilter('all');
                        setCategoryFilter('all');
                      }}
                      className="ml-auto text-[11px] text-amber-600 dark:text-amber-400 hover:underline"
                    >
                      Reset filters
                    </button>
                  )}
                </div>
              </div>

              {/* Tickets list */}
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="ticket-slip p-4 animate-pulse">
                      <div className="h-4 rounded mb-2" style={{ background: 'var(--cream-dark)', width: '60%' }} />
                      <div className="h-3 rounded" style={{ background: 'var(--cream-dark)', width: '40%' }} />
                    </div>
                  ))}
                </div>
              ) : filteredTickets.length === 0 ? (
                <div className="paper-card p-8 text-center">
                  <p className="font-display text-lg mb-1" style={{ color: 'var(--ink-muted)' }}>No matching tickets</p>
                  <p className="text-xs text-faint">Try adjusting your search or filter criteria.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredTickets.map((ticket, idx) => {
                    const stage = ticketStages[ticket.ticket_number];
                    const decision = decisions[ticket.ticket_number];
                    const isProcessing = processingTickets[ticket.id];

                    return (
                      <div
                        key={ticket.id}
                        className={`ticket-slip p-4 fade-in-up transition-all hover:shadow-md cursor-pointer`}
                        style={{ animationDelay: `${idx * 40}ms` }}
                        onClick={() => setInspectingTicket(ticket)}
                        id={`ticket-${ticket.ticket_number}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className="text-xs font-mono font-semibold" style={{ color: 'var(--ink-faint)' }}>
                                {ticket.ticket_number}
                              </span>
                              <StatusBadge status={ticket.status} />
                              <PriorityBadge priority={ticket.priority} />
                              {ticket.fraud_flag && <span className="badge badge-fraud">🚨 Fraud</span>}
                              {ticket.legal_flag && <span className="badge badge-legal">⚖ Legal</span>}
                            </div>
                            <h3 className="text-sm font-semibold mb-0.5 truncate" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                              {ticket.subject}
                            </h3>
                            <div className="flex items-center gap-2 text-xs flex-wrap" style={{ color: 'var(--ink-faint)' }}>
                              <span className="font-medium text-ink">{ticket.customer_name}</span>
                              <span>·</span>
                              <span>{categoryLabel(ticket.category)}</span>
                              {ticket.amount_inr && (
                                <>
                                  <span>·</span>
                                  <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                                    ₹{ticket.amount_inr}
                                  </span>
                                </>
                              )}
                              <span>·</span>
                              <span>{formatDate(ticket.created_at)}</span>
                            </div>
                          </div>

                          {/* Confidence dial or interactive run button */}
                          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                            {decision && decision.confidence !== null && decision.confidence !== undefined && (
                              <ConfidenceDial value={decision.confidence} size={48} />
                            )}
                            {ticket.status === 'open' && (
                              <button
                                onClick={() => runSingleTicket(ticket.id)}
                                disabled={isProcessing || running}
                                className="btn-primary text-xs px-2.5 py-1.5 flex items-center gap-1 shadow-sm hover:scale-[1.02] transition-transform"
                                title="Run Nova on this ticket"
                              >
                                {isProcessing ? (
                                  <>
                                    <span className="pulse-dot inline-block w-1.5 h-1.5 rounded-full bg-current" />
                                    Processing...
                                  </>
                                ) : (
                                  <>
                                    <span>⚡</span>
                                    <span>Run Nova</span>
                                  </>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Body preview */}
                        <p className="text-xs mt-2 line-clamp-2" style={{ color: 'var(--ink-muted)' }}>
                          {ticket.body}
                        </p>

                        {/* Pipeline stages during run */}
                        {stage && stage !== 'done' && (
                          <PipelineStages stages={PIPELINE_STAGES} activeStage={stage} />
                        )}

                        {/* Decision result */}
                        {decision && (
                          <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--card-border)' }}>
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <OutcomeBadge outcome={decision.outcome} />
                              <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                                {actionLabel(decision.action)}
                              </span>
                              {decision.llm_provider && (
                                <span className="text-xs px-1.5 py-0.5 rounded font-mono" style={{ background: 'var(--cream-dark)', color: 'var(--ink-faint)' }}>
                                  {decision.llm_provider}
                                </span>
                              )}
                            </div>
                            <p className="text-xs mt-1" style={{ color: 'var(--ink-muted)' }}>
                              {decision.reasoning}
                            </p>
                            {decision.customer_reply && (
                              <div className="mt-2 p-2 rounded text-xs italic" style={{ background: 'var(--cream-dark)', color: 'var(--ink-muted)', borderLeft: '2px solid var(--accent)' }}>
                                &ldquo;{decision.customer_reply.slice(0, 160)}{decision.customer_reply.length > 160 ? '...' : ''}&rdquo;
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Stream log + Chat panel column */}
            <div className="space-y-4">
              {/* Live stream log */}
              <div className="paper-card p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display text-sm font-semibold" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                    Agent Pipeline Stream
                  </h3>
                  <span className="text-[10px] font-mono uppercase text-muted">SSE Live</span>
                </div>
                <div
                  ref={streamRef}
                  className="h-52 overflow-y-auto font-mono text-xs space-y-0.5 pr-1"
                  style={{ color: 'var(--ink-muted)' }}
                  id="stream-log"
                >
                  {streamLog.length === 0 ? (
                    <div className="text-center py-8 text-faint">
                      <p className="text-sm mb-1">Pipeline Idle</p>
                      <p className="text-xs">Click &ldquo;Run All&rdquo; or &ldquo;Run Nova&rdquo; on any ticket to stream steps live.</p>
                    </div>
                  ) : (
                    streamLog.map((line, i) => (
                      <div
                        key={i}
                        className="stream-line py-0.5"
                        style={{
                          color: line.startsWith('✅')
                            ? 'var(--success)'
                            : line.startsWith('❌')
                            ? 'var(--danger)'
                            : line.startsWith('▶')
                            ? 'var(--ink)'
                            : 'var(--ink-muted)',
                        }}
                      >
                        {line}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Chat panel */}
              <div className="paper-card p-4 flex flex-col" style={{ minHeight: 360 }}>
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-display text-sm font-semibold" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                    Ask Nova Audit Assistant
                  </h3>
                  <span className="text-[10px] font-mono uppercase text-muted">Context-Grounded</span>
                </div>
                <p className="text-[11px] mb-2.5" style={{ color: 'var(--ink-faint)' }}>
                  Ask questions strictly grounded in append-only audit records.
                </p>

                {/* Quick suggestion chips */}
                <div className="flex flex-wrap gap-1 mb-2.5">
                  {PROMPT_CHIPS.map((chip) => (
                    <button
                      key={chip}
                      onClick={() => sendChat(chip)}
                      disabled={chatLoading}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-card text-muted hover:text-ink hover:border-amber-600/40 transition-colors text-left"
                    >
                      💡 {chip}
                    </button>
                  ))}
                </div>

                <div
                  ref={chatRef}
                  className="flex-1 overflow-y-auto space-y-2 pr-1 h-44"
                  id="chat-log"
                >
                  {chat.length === 0 ? (
                    <div className="text-xs py-4 text-center" style={{ color: 'var(--ink-faint)' }}>
                      Ask me anything about ticket decisions, guardrail escalations, or refunds...
                    </div>
                  ) : (
                    chat.map((msg, i) => (
                      <div
                        key={i}
                        className={`text-xs p-2.5 rounded-lg ${msg.role === 'user' ? 'ml-4' : 'mr-4'}`}
                        style={{
                          background: msg.role === 'user' ? 'var(--ink)' : 'var(--cream-dark)',
                          color: msg.role === 'user' ? 'var(--cream)' : 'var(--ink)',
                          borderRadius: msg.role === 'user' ? '10px 10px 2px 10px' : '10px 10px 10px 2px',
                        }}
                      >
                        {msg.content}
                      </div>
                    ))
                  )}
                  {chatLoading && (
                    <div className="text-xs p-2.5 mr-4" style={{ background: 'var(--cream-dark)', borderRadius: '10px 10px 10px 2px', color: 'var(--ink-faint)' }}>
                      <span className="pulse-dot">Thinking</span>
                      <span className="pulse-dot">.</span>
                      <span className="pulse-dot">.</span>
                      <span className="pulse-dot">.</span>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-3 pt-2.5" style={{ borderTop: '1px solid var(--card-border)' }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                    placeholder="Ask about any decision..."
                    className="input-editorial flex-1 text-xs"
                    id="chat-input"
                  />
                  <button
                    onClick={() => sendChat()}
                    disabled={chatLoading || !chatInput.trim()}
                    className="btn-primary text-xs px-3 py-1.5"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===== HUMAN HANDOFF TAB ===== */}
        {activeTab === 'handoff' && (
          <div className="max-w-4xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-semibold" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                  Human Handoff Review Queue
                </h2>
                <p className="text-xs text-muted">
                  Tickets flagged by safety guardrails or below the 75% confidence threshold.
                </p>
              </div>
              <span className="badge badge-escalated font-mono">
                {escalatedTickets.length} pending human review
              </span>
            </div>

            {escalatedTickets.length === 0 ? (
              <div className="paper-card p-10 text-center">
                <p className="text-3xl mb-2">🎉</p>
                <p className="font-display text-xl mb-1" style={{ color: 'var(--success)' }}>Queue All Clear</p>
                <p className="text-xs text-faint">No tickets currently require human intervention.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {escalatedTickets.map((ticket) => {
                  const auditEntry = auditLog.find((a) => a.ticket_id === ticket.id);
                  const currentNotes = handoffNotes[ticket.id] || '';

                  return (
                    <div
                      key={ticket.id}
                      className={`ticket-slip p-5 ${ticket.fraud_flag ? 'ticket-fraud' : ticket.legal_flag ? 'ticket-legal' : 'ticket-escalated'}`}
                      id={`handoff-${ticket.ticket_number}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className="text-xs font-mono font-bold" style={{ color: 'var(--ink)' }}>{ticket.ticket_number}</span>
                            {ticket.fraud_flag && <span className="badge badge-fraud">🚨 Fraud Signal</span>}
                            {ticket.legal_flag && <span className="badge badge-legal">⚖ Legal Dispute</span>}
                            <PriorityBadge priority={ticket.priority} />
                            {ticket.amount_inr && (
                              <span className="font-mono text-xs font-semibold text-amber-600 dark:text-amber-400">
                                ₹{ticket.amount_inr}
                              </span>
                            )}
                          </div>
                          <h3 className="font-semibold text-sm mb-1" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                            {ticket.subject}
                          </h3>
                          <p className="text-xs mb-2" style={{ color: 'var(--ink-muted)' }}>
                            {ticket.customer_name} ({ticket.customer_email})
                          </p>
                          <div className="text-xs p-2.5 rounded bg-black/5 dark:bg-white/5 mb-3 leading-relaxed">
                            {ticket.body}
                          </div>

                          {auditEntry && (
                            <div className="p-3 rounded text-xs mb-3 border-l-2 border-amber-600 bg-amber-500/5">
                              <div className="font-semibold mb-1" style={{ color: 'var(--ink)' }}>
                                Nova Guardrail Assessment:
                              </div>
                              {auditEntry.hard_rule_fired && (
                                <div className="mb-1 text-danger font-medium">
                                  ⚠️ Hard Rule Fired: {auditEntry.hard_rule_fired}
                                </div>
                              )}
                              <div style={{ color: 'var(--ink-muted)' }}>{auditEntry.escalation_reason || auditEntry.reasoning}</div>
                            </div>
                          )}

                          {/* Quick note preset tags */}
                          <div className="space-y-1.5 pt-1">
                            <div className="flex items-center gap-1.5 flex-wrap text-[11px] text-muted">
                              <span>Quick override tags:</span>
                              {[
                                'Customer identity verified via call',
                                'Store credit exception granted',
                                'Confirmed fraud - block customer',
                                'Legal team reviewing claim',
                              ].map((preset) => (
                                <button
                                  key={preset}
                                  onClick={() => setHandoffNotes((prev) => ({ ...prev, [ticket.id]: preset }))}
                                  className="px-2 py-0.5 rounded border border-card bg-black/5 dark:bg-white/5 hover:bg-amber-500/10 transition-colors"
                                >
                                  + {preset}
                                </button>
                              ))}
                            </div>

                            <input
                              type="text"
                              value={currentNotes}
                              onChange={(e) => setHandoffNotes({ ...handoffNotes, [ticket.id]: e.target.value })}
                              placeholder="Add human resolution notes (logged to audit)..."
                              className="input-editorial w-full text-xs"
                            />
                          </div>
                        </div>

                        {auditEntry?.confidence !== null && auditEntry?.confidence !== undefined && (
                          <div className="flex-shrink-0 text-center">
                            <ConfidenceDial value={auditEntry.confidence} size={64} />
                            <span className="text-[10px] font-mono text-muted block mt-1">Confidence</span>
                          </div>
                        )}
                      </div>

                      <div className="flex gap-2.5 mt-4 pt-3 border-t border-card">
                        <button
                          className="btn-primary btn-approve text-xs px-4 py-1.5 font-medium shadow-sm hover:scale-[1.02] transition-transform"
                          onClick={() => handleHandoff(ticket.id, 'approved')}
                          id={`approve-${ticket.ticket_number}`}
                        >
                          ✓ Approve Override
                        </button>
                        <button
                          className="btn-primary btn-reject text-xs px-4 py-1.5 font-medium shadow-sm hover:scale-[1.02] transition-transform"
                          onClick={() => handleHandoff(ticket.id, 'rejected')}
                          id={`reject-${ticket.ticket_number}`}
                        >
                          ✗ Reject Request
                        </button>
                        <button
                          onClick={() => setInspectingTicket(ticket)}
                          className="btn-outline text-xs px-3 py-1.5 ml-auto"
                        >
                          Inspect Details →
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ===== AUDIT LOG TAB ===== */}
        {activeTab === 'audit' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div>
                <h2 className="font-display text-lg font-semibold" style={{ color: dark ? 'var(--dark-text)' : 'var(--ink)' }}>
                  Chronological Audit Log
                </h2>
                <p className="text-xs text-muted">
                  Append-only immutable record enforced by Postgres Row Level Security.
                </p>
              </div>

              {/* Search & Filter Toolbar */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  placeholder="Search audit entries..."
                  className="input-editorial text-xs py-1 px-2.5"
                />
                <select
                  value={auditOutcomeFilter}
                  onChange={(e) => setAuditOutcomeFilter(e.target.value)}
                  className="input-editorial text-xs py-1"
                >
                  <option value="all">All Outcomes</option>
                  <option value="autonomous">Autonomous</option>
                  <option value="escalated">Escalated</option>
                  <option value="human_resolved">Human Resolved</option>
                </select>
              </div>
            </div>

            {filteredAuditLogs.length === 0 ? (
              <div className="paper-card p-10 text-center">
                <p className="text-sm text-faint">No audit entries matching the current filter.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredAuditLogs.map((entry, idx) => (
                  <div
                    key={entry.id}
                    className="paper-card p-4 fade-in-up hover:border-amber-600/30 transition-all"
                    style={{ animationDelay: `${Math.min(idx * 25, 250)}ms` }}
                    id={`audit-${entry.id.slice(0, 8)}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-xs font-mono font-bold" style={{ color: 'var(--ink)' }}>
                            {entry.ticket_number}
                          </span>
                          <OutcomeBadge outcome={entry.outcome} />
                          <span className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>
                            {actionLabel(entry.action)}
                          </span>
                          {entry.hard_rule_fired && (
                            <span className="badge badge-fraud text-xs font-mono">Rule: {entry.hard_rule_fired}</span>
                          )}
                          {entry.llm_provider && (
                            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ background: 'var(--cream-dark)', color: 'var(--ink-faint)' }}>
                              {entry.llm_provider}
                            </span>
                          )}
                        </div>
                        <p className="text-xs leading-relaxed" style={{ color: 'var(--ink-muted)' }}>{entry.reasoning}</p>
                        {entry.escalation_reason && (
                          <p className="text-xs mt-1 font-medium" style={{ color: 'var(--accent)' }}>
                            ↑ {entry.escalation_reason}
                          </p>
                        )}
                        {entry.customer_reply && (
                          <div className="mt-2 p-2 rounded text-xs italic bg-black/5 dark:bg-white/5 text-muted border-l-2 border-amber-600">
                            &ldquo;{entry.customer_reply}&rdquo;
                          </div>
                        )}
                        {entry.policy_refs.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {entry.policy_refs.map((ref) => (
                              <span
                                key={ref}
                                className="text-[10px] font-mono px-1.5 py-0.5 rounded"
                                style={{ background: 'var(--cream-deeper, #d5cec4)', color: 'var(--ink-faint)' }}
                              >
                                {ref}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {entry.confidence !== null && entry.confidence !== undefined && (
                          <ConfidenceDial value={entry.confidence} size={44} />
                        )}
                        <div className="text-[11px] mt-1 font-mono" style={{ color: 'var(--ink-faint)' }}>
                          {formatDate(entry.created_at)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== IMPACT TAB ===== */}
        {activeTab === 'impact' && (
          <ImpactTab stats={stats} auditLog={auditLog} dark={dark} />
        )}
      </main>

      {/* TICKET INSPECTION MODAL */}
      <TicketInspectionModal
        ticket={inspectingTicket}
        decision={inspectingTicket ? decisions[inspectingTicket.ticket_number] : null}
        isOpen={!!inspectingTicket}
        onClose={() => setInspectingTicket(null)}
        onRunTicket={async (id) => {
          await runSingleTicket(id);
          const updated = tickets.find((t) => t.id === id);
          if (updated) setInspectingTicket(updated);
        }}
        isRunning={!!(inspectingTicket && processingTickets[inspectingTicket.id])}
        dark={dark}
      />

      {/* NEW SIMULATION TICKET MODAL */}
      <NewTicketModal
        isOpen={isNewTicketModalOpen}
        onClose={() => setIsNewTicketModalOpen(false)}
        onCreateTicket={handleCreateTicket}
        dark={dark}
      />

      {/* FOOTER */}
      <footer className="max-w-7xl mx-auto px-6 py-6 mt-8" style={{ borderTop: '1px solid var(--card-border)' }}>
        <div className="flex items-center justify-between text-xs flex-wrap gap-2" style={{ color: 'var(--ink-faint)' }}>
          <div>Nova · Autonomous AI Agent · Team Server Hack · SIH 2026</div>
          <div className="flex items-center gap-3">
            <Link href="/store" className="hover:underline text-amber-700 dark:text-amber-400 font-semibold">
              Visit Customer Storefront ➔
            </Link>
            <span>·</span>
            <div>Safety guardrails active · Dual AI Fallback · Append-only Audit Trail</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import React, { useState } from 'react';
import type { Ticket, AgentDecision } from '@/types';
import { ConfidenceDial } from './ConfidenceDial';

interface TicketInspectionModalProps {
  ticket: Ticket | null;
  decision?: AgentDecision | null;
  isOpen: boolean;
  onClose: () => void;
  onRunTicket: (ticketId: string) => Promise<void>;
  isRunning: boolean;
  dark?: boolean;
}

export function TicketInspectionModal({
  ticket,
  decision,
  isOpen,
  onClose,
  onRunTicket,
  isRunning,
  dark = false,
}: TicketInspectionModalProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'policy' | 'metadata'>('overview');

  if (!isOpen || !ticket) return null;

  const handleCopyReply = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const bgModal = dark ? 'bg-[#1E1A16] text-[#E8E0D5] border-[#38312B]' : 'bg-[#FEFCF8] text-[#2B2118] border-[#E8DFD5]';
  const bgSubtle = dark ? 'bg-[#28221D]' : 'bg-[#F4EFE6]';
  const borderSubtle = dark ? 'border-[#38312B]' : 'border-[#E8DFD5]';
  const textMuted = dark ? 'text-[#9B8B7A]' : 'text-[#7A6B5C]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-2xl max-h-[90vh] flex flex-col rounded-lg border shadow-2xl overflow-hidden ${bgModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 border-b ${borderSubtle} flex items-center justify-between`}>
          <div className="flex items-center gap-3">
            <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
              {ticket.ticket_number}
            </span>
            <span className="text-xs uppercase tracking-wider font-medium text-muted">
              {ticket.category}
            </span>
            {ticket.fraud_flag && (
              <span className="badge badge-fraud text-xs">🚨 Fraud Signal</span>
            )}
            {ticket.legal_flag && (
              <span className="badge badge-legal text-xs">⚖️ Legal Dispute</span>
            )}
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${textMuted}`}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        {/* Sub-header navigation */}
        <div className={`flex border-b px-5 text-xs font-medium ${borderSubtle} gap-4`}>
          {[
            { key: 'overview', label: 'Ticket & Decision' },
            { key: 'policy', label: 'Policy Checks' },
            { key: 'metadata', label: 'Raw Metadata' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as typeof activeTab)}
              className={`py-3 border-b-2 transition-all ${
                activeTab === tab.key
                  ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
                  : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Body content */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-sm">
          {activeTab === 'overview' && (
            <>
              {/* Customer & Subject info */}
              <div className={`p-4 rounded-md border ${borderSubtle} ${bgSubtle} space-y-2`}>
                <div className="flex justify-between items-baseline">
                  <h3 className="font-semibold text-base">{ticket.subject}</h3>
                  {ticket.amount_inr && (
                    <span className="font-mono font-bold text-amber-600 dark:text-amber-400">
                      ₹{ticket.amount_inr.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>
                <div className={`flex flex-wrap gap-4 text-xs ${textMuted}`}>
                  <div><strong>Customer:</strong> {ticket.customer_name} ({ticket.customer_email})</div>
                  <div><strong>Status:</strong> <span className="capitalize">{ticket.status}</span></div>
                  <div><strong>Priority:</strong> <span className="capitalize">{ticket.priority}</span></div>
                </div>
              </div>

              {/* Message body */}
              <div>
                <h4 className="text-xs uppercase font-mono tracking-wider mb-1 text-muted">Customer Message</h4>
                <div className={`p-3.5 rounded border ${borderSubtle} text-xs leading-relaxed whitespace-pre-wrap ${bgSubtle}`}>
                  {ticket.body}
                </div>
              </div>

              {/* Decision Section if processed */}
              {decision ? (
                <div className={`p-4 rounded-md border ${borderSubtle} space-y-3`}>
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-mono uppercase tracking-wider text-muted">Nova Outcome</span>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`badge ${decision.outcome === 'autonomous' ? 'badge-autonomous' : 'badge-escalated'}`}>
                          {decision.outcome === 'autonomous' ? '✓ Resolved Autonomously' : '↑ Escalated to Human'}
                        </span>
                        <span className="text-xs font-medium">Action: <strong>{decision.action}</strong></span>
                      </div>
                    </div>
                    {decision.confidence !== null && (
                      <div className="flex items-center gap-2">
                        <ConfidenceDial value={decision.confidence} size={48} />
                      </div>
                    )}
                  </div>

                  {decision.hard_rule_fired && (
                    <div className="p-2.5 rounded bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-xs">
                      <strong>Guardrail Intercepted:</strong> {decision.hard_rule_fired}
                    </div>
                  )}

                  <div>
                    <div className="text-xs font-medium mb-1">Reasoning:</div>
                    <p className={`text-xs ${textMuted} leading-relaxed`}>{decision.reasoning}</p>
                  </div>

                  {decision.customer_reply && (
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">Generated Customer Reply:</span>
                        <button
                          onClick={() => handleCopyReply(decision.customer_reply!)}
                          className="text-xs text-amber-600 dark:text-amber-400 hover:underline flex items-center gap-1"
                        >
                          {copied ? '✓ Copied' : '⧉ Copy Reply'}
                        </button>
                      </div>
                      <div className="p-3 rounded text-xs italic border-l-2 border-amber-600 bg-amber-500/5 text-muted">
                        &ldquo;{decision.customer_reply}&rdquo;
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className={`p-4 text-center rounded border border-dashed ${borderSubtle} ${bgSubtle}`}>
                  <p className="text-xs text-muted mb-3">This ticket has not been processed by Nova yet.</p>
                  <button
                    onClick={() => onRunTicket(ticket.id)}
                    disabled={isRunning}
                    className="btn-primary text-xs px-4 py-2 inline-flex items-center gap-2"
                  >
                    {isRunning ? 'Processing...' : '⚡ Run Nova on this ticket'}
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'policy' && (
            <div className="space-y-3">
              <p className={`text-xs ${textMuted}`}>
                Nova evaluates deterministic policy guardrails before consulting any LLM:
              </p>

              <div className={`p-3 rounded border ${ticket.fraud_flag ? 'border-red-500/40 bg-red-500/10' : `${borderSubtle} ${bgSubtle}`}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold">§2A-1 Fraud Zero-Tolerance Rule</span>
                  <span className={ticket.fraud_flag ? 'text-red-600 font-bold' : 'text-emerald-600'}>
                    {ticket.fraud_flag ? 'FAIL (BLOCKED)' : 'PASS'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Tickets flagged for fraud are immediately blocked from any automated payout.
                </p>
              </div>

              <div className={`p-3 rounded border ${ticket.legal_flag ? 'border-red-500/40 bg-red-500/10' : `${borderSubtle} ${bgSubtle}`}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold">§2A-2 Legal & Chargeback Threat Rule</span>
                  <span className={ticket.legal_flag ? 'text-red-600 font-bold' : 'text-emerald-600'}>
                    {ticket.legal_flag ? 'FAIL (BLOCKED)' : 'PASS'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Legal threats or chargebacks are strictly routed to the legal review queue.
                </p>
              </div>

              <div className={`p-3 rounded border ${ticket.category === 'refund' && (ticket.amount_inr ?? 0) > 500 ? 'border-red-500/40 bg-red-500/10' : `${borderSubtle} ${bgSubtle}`}`}>
                <div className="flex justify-between items-center text-xs">
                  <span className="font-semibold">§3-B Refund Cap Guardrail (Max ₹500)</span>
                  <span className={ticket.category === 'refund' && (ticket.amount_inr ?? 0) > 500 ? 'text-red-600 font-bold' : 'text-emerald-600'}>
                    {ticket.category === 'refund' && (ticket.amount_inr ?? 0) > 500 ? 'FAIL (EXCEEDS ₹500)' : 'PASS'}
                  </span>
                </div>
                <p className="text-xs text-muted mt-1">
                  Ticket refund amount: ₹{ticket.amount_inr ?? 0} (Limit: ₹500 for autonomous resolution).
                </p>
              </div>
            </div>
          )}

          {activeTab === 'metadata' && (
            <div>
              <div className="text-xs font-mono uppercase tracking-wider mb-2 text-muted">Ticket Payload</div>
              <pre className={`p-3 rounded border text-xs font-mono overflow-x-auto ${borderSubtle} ${bgSubtle}`}>
                {JSON.stringify(ticket, null, 2)}
              </pre>
            </div>
          )}
        </div>

        {/* Footer controls */}
        <div className={`p-4 border-t ${borderSubtle} flex items-center justify-between`}>
          <div className="text-xs text-muted">
            Status: <span className="capitalize font-medium">{ticket.status}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className={`px-3 py-1.5 text-xs rounded border ${borderSubtle} hover:bg-black/5 dark:hover:bg-white/5 transition-colors`}
            >
              Close
            </button>
            {ticket.status === 'open' && (
              <button
                onClick={() => onRunTicket(ticket.id)}
                disabled={isRunning}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5"
              >
                {isRunning ? 'Processing...' : '⚡ Process with Nova'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

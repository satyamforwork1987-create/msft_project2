'use client';

import React, { useState } from 'react';
import type { Ticket, TicketCategory, TicketPriority } from '@/types';

interface NewTicketModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateTicket: (ticket: Partial<Ticket>) => Promise<void>;
  dark?: boolean;
}

const PRESETS: Array<{
  name: string;
  icon: string;
  desc: string;
  ticket: Partial<Ticket>;
}> = [
  {
    name: 'Defective Product (Auto-Refund)',
    icon: '🎧',
    desc: '₹350 refund under ₹500 cap — expected to pass autonomously',
    ticket: {
      subject: 'Damaged USB-C hub out of box',
      customer_name: 'Rohit Mehta',
      customer_email: 'rohit.mehta@example.com',
      body: 'The USB-C hub I received has bent pins and cannot connect to my laptop. Requesting a full refund for ₹350. Order #ORD-44910.',
      category: 'refund',
      priority: 'medium',
      amount_inr: 350,
      fraud_flag: false,
      legal_flag: false,
      metadata: { order_id: 'ORD-44910', defect: 'bent_pins' },
    },
  },
  {
    name: 'High-Value Refund (Cap Violation)',
    icon: '💳',
    desc: '₹1,800 refund exceeds ₹500 cap — triggers guardrail escalation',
    ticket: {
      subject: 'Return and refund for gaming chair',
      customer_name: 'Simran Kaur',
      customer_email: 'simran.k@example.com',
      body: 'I am requesting a refund of ₹1,800 for the ergonomic cushion set. The color does not match my office chair. Order #ORD-88219.',
      category: 'refund',
      priority: 'medium',
      amount_inr: 1800,
      fraud_flag: false,
      legal_flag: false,
      metadata: { order_id: 'ORD-88219', product: 'Cushion Set' },
    },
  },
  {
    name: 'Fraud Account Attack',
    icon: '🚨',
    desc: 'Multiple fake accounts detected — triggers FRAUD_FLAG hard rule',
    ticket: {
      subject: 'URGENT: Issue refund without OTP',
      customer_name: 'Alok Nath',
      customer_email: 'alok99@tempmail.org',
      body: 'My wallet balance was deducted. Please refund ₹4,000 to my alternative bank account right now. Do not send OTP to registered mobile.',
      category: 'fraud',
      priority: 'critical',
      amount_inr: 4000,
      fraud_flag: true,
      legal_flag: false,
      metadata: { fraud_signals: ['disposable_email', 'otp_bypass_attempt'], order_id: 'ORD-00912' },
    },
  },
  {
    name: 'Legal Dispute / Chargeback',
    icon: '⚖️',
    desc: 'Lawyer / consumer court threat — triggers LEGAL_FLAG hard rule',
    ticket: {
      subject: 'Notice of Legal Action — Consumer Forum Complaint',
      customer_name: 'Harsh Vardhan',
      customer_email: 'h.vardhan@legalchambers.in',
      body: 'Take notice that my counsel has drafted a complaint for the National Consumer Disputes Redressal Commission regarding Order #ORD-99120. We will proceed with a chargeback dispute if ₹6,500 is not credited in 24 hours.',
      category: 'legal',
      priority: 'critical',
      amount_inr: 6500,
      fraud_flag: false,
      legal_flag: true,
      metadata: { order_id: 'ORD-99120', chargeback_threat: true },
    },
  },
  {
    name: 'Aggressive Price Match',
    icon: '🏷️',
    desc: '25% margin loss request — triggers price match margin rule',
    ticket: {
      subject: 'Price match for Wireless Earbuds',
      customer_name: 'Tanvi Shah',
      customer_email: 'tanvi.shah@example.com',
      body: 'I bought these earbuds for ₹2,000, but a competitor site is offering them for ₹1,500. Can you refund the ₹500 difference under your price guarantee?',
      category: 'price_match',
      priority: 'low',
      amount_inr: 2000,
      fraud_flag: false,
      legal_flag: false,
      metadata: { competitor: 'QuickCart', competitor_price: 1500, margin_diff_pct: 25 },
    },
  },
];

export function NewTicketModal({
  isOpen,
  onClose,
  onCreateTicket,
  dark = false,
}: NewTicketModalProps) {
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [submitting, setSubmitting] = useState(false);

  // Custom ticket form fields
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<TicketCategory>('refund');
  const [priority, setPriority] = useState<TicketPriority>('medium');
  const [amountInr, setAmountInr] = useState<number | ''>(350);
  const [fraudFlag, setFraudFlag] = useState(false);
  const [legalFlag, setLegalFlag] = useState(false);

  if (!isOpen) return null;

  const handleApplyPreset = async (presetTicket: Partial<Ticket>) => {
    setSubmitting(true);
    try {
      await onCreateTicket(presetTicket);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleCustomSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim() || !customerName.trim()) return;

    setSubmitting(true);
    try {
      await onCreateTicket({
        customer_name: customerName,
        customer_email: customerEmail || `${customerName.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        subject,
        body,
        category,
        priority,
        amount_inr: amountInr === '' ? null : Number(amountInr),
        fraud_flag: fraudFlag,
        legal_flag: legalFlag,
        metadata: { custom_simulation: true },
      });
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const bgModal = dark ? 'bg-[#1E1A16] text-[#E8E0D5] border-[#38312B]' : 'bg-[#FEFCF8] text-[#2B2118] border-[#E8DFD5]';
  const bgSubtle = dark ? 'bg-[#28221D]' : 'bg-[#F4EFE6]';
  const borderSubtle = dark ? 'border-[#38312B]' : 'border-[#E8DFD5]';
  const textMuted = dark ? 'text-[#9B8B7A]' : 'text-[#7A6B5C]';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className={`relative w-full max-w-xl max-h-[90vh] flex flex-col rounded-lg border shadow-2xl overflow-hidden ${bgModal}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-5 border-b ${borderSubtle} flex items-center justify-between`}>
          <div>
            <h3 className="font-semibold text-base">Simulate Customer Ticket</h3>
            <p className={`text-xs ${textMuted} mt-0.5`}>
              Inject a test scenario to test Nova&rsquo;s safety guardrails in real time
            </p>
          </div>
          <button
            onClick={onClose}
            className={`p-1.5 rounded-md hover:bg-black/10 dark:hover:bg-white/10 transition-colors ${textMuted}`}
          >
            ✕
          </button>
        </div>

        {/* Tab switcher */}
        <div className={`flex border-b px-5 text-xs font-medium ${borderSubtle} gap-4`}>
          <button
            onClick={() => setMode('preset')}
            className={`py-3 border-b-2 transition-all ${
              mode === 'preset'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            ⚡ Quick Presets (Recommended)
          </button>
          <button
            onClick={() => setMode('custom')}
            className={`py-3 border-b-2 transition-all ${
              mode === 'custom'
                ? 'border-amber-600 text-amber-600 dark:text-amber-400 font-semibold'
                : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            ✏️ Custom Ticket Form
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          {mode === 'preset' ? (
            <div className="space-y-2.5">
              {PRESETS.map((p) => (
                <div
                  key={p.name}
                  className={`p-3.5 rounded-md border ${borderSubtle} ${bgSubtle} hover:border-amber-600/50 transition-all cursor-pointer flex items-start justify-between gap-3`}
                  onClick={() => !submitting && handleApplyPreset(p.ticket)}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">{p.icon}</span>
                    <div>
                      <h4 className="font-semibold text-xs">{p.name}</h4>
                      <p className={`text-xs ${textMuted} mt-0.5`}>{p.desc}</p>
                      <div className="text-[11px] font-mono mt-1 opacity-75">
                        Category: {p.ticket.category} {p.ticket.amount_inr ? `· ₹${p.ticket.amount_inr}` : ''}
                      </div>
                    </div>
                  </div>
                  <button
                    disabled={submitting}
                    className="btn-primary text-xs px-2.5 py-1 flex-shrink-0"
                  >
                    {submitting ? 'Adding...' : 'Inject →'}
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <form onSubmit={handleCustomSubmit} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium mb-1">Customer Name</label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="e.g. Aarti Mehta"
                    className="input-editorial w-full text-xs"
                  />
                </div>
                <div>
                  <label className="block font-medium mb-1">Customer Email</label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="aarti@example.com"
                    className="input-editorial w-full text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g. Requesting replacement for broken item"
                  className="input-editorial w-full text-xs"
                />
              </div>

              <div>
                <label className="block font-medium mb-1">Customer Body / Inquiry</label>
                <textarea
                  required
                  rows={3}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write customer message here..."
                  className="input-editorial w-full text-xs resize-none"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-medium mb-1">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as TicketCategory)}
                    className="input-editorial w-full text-xs"
                  >
                    <option value="refund">Refund</option>
                    <option value="replacement">Replacement</option>
                    <option value="delivery">Delivery</option>
                    <option value="price_match">Price Match</option>
                    <option value="subscription">Subscription</option>
                    <option value="cart_recovery">Cart Recovery</option>
                    <option value="legal">Legal</option>
                    <option value="fraud">Fraud</option>
                    <option value="general">General</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Priority</label>
                  <select
                    value={priority}
                    onChange={(e) => setPriority(e.target.value as TicketPriority)}
                    className="input-editorial w-full text-xs"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block font-medium mb-1">Amount (₹)</label>
                  <input
                    type="number"
                    value={amountInr}
                    onChange={(e) => setAmountInr(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 500"
                    className="input-editorial w-full text-xs"
                  />
                </div>
              </div>

              <div className="flex gap-4 pt-1">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={fraudFlag}
                    onChange={(e) => setFraudFlag(e.target.checked)}
                    className="rounded border-amber-500"
                  />
                  <span>🚨 Trigger Fraud Signal</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={legalFlag}
                    onChange={(e) => setLegalFlag(e.target.checked)}
                    className="rounded border-amber-500"
                  />
                  <span>⚖️ Trigger Legal Threat Flag</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={onClose}
                  className={`px-3 py-1.5 rounded border ${borderSubtle}`}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary px-4 py-1.5"
                >
                  {submitting ? 'Creating...' : 'Create Simulation Ticket'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

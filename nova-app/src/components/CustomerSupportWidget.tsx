'use client';

import React, { useState, useRef, useEffect } from 'react';
import type { AgentDecision, TicketCategory } from '@/types';

interface Message {
  id: string;
  sender: 'user' | 'nova';
  text: string;
  time: string;
  decision?: AgentDecision;
  ticketNumber?: string;
  stage?: string;
}

const PRESET_QUERIES = [
  {
    label: '🎧 Defective Sony Headphones (Refund)',
    name: 'Priya Sharma',
    email: 'priya.sharma@email.com',
    subject: 'Refund request for defective headphones',
    orderId: 'ORD-78923',
    amount: 350,
    category: 'refund' as TicketCategory,
    message: 'My Sony headphones arrived with a broken headband. Order #ORD-78923. I would like a refund of ₹350 please.',
  },
  {
    label: '🚨 High-Value Refund (Cap Guardrail)',
    name: 'Rohit Gupta',
    email: 'rohit.g@example.com',
    subject: 'Refund request for ₹2,400',
    orderId: 'ORD-55412',
    amount: 2400,
    category: 'refund' as TicketCategory,
    message: 'I want an immediate refund of ₹2,400 for my soundbar order #ORD-55412 without returning it.',
  },
  {
    label: '📦 Overdue Package Delivery',
    name: 'Karthik Menon',
    email: 'karthik.m@email.com',
    subject: 'Package overdue by 5 days',
    orderId: 'ORD-34521',
    amount: null,
    category: 'delivery' as TicketCategory,
    message: 'My Nike Air Max shoes (Order #ORD-34521) were supposed to arrive 5 days ago. Tracking has been stuck on Out for Delivery.',
  },
  {
    label: '🏷️ Price Match Boat Airdopes',
    name: 'Meera Pillai',
    email: 'meera.pillai@email.com',
    subject: 'Price match request for Boat Airdopes',
    orderId: 'ORD-11203',
    amount: 1299,
    category: 'price_match' as TicketCategory,
    message: 'I bought Boat Airdopes for ₹1,299 but found them for ₹999 elsewhere. Can you match the price?',
  },
];

export function CustomerSupportWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      sender: 'nova',
      text: 'Hello! I am Nova, your AI support specialist. How can I help you with your orders or products today?',
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [orderId, setOrderId] = useState('');
  const [customerName, setCustomerName] = useState('Priya Sharma');
  const [customerEmail, setCustomerEmail] = useState('priya.sharma@email.com');
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStage, setCurrentStage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, currentStage]);

  const handleSendMessage = async (customMessage?: string, preset?: typeof PRESET_QUERIES[0]) => {
    const textToSend = customMessage || inputText;
    if (!textToSend.trim() || isProcessing) return;

    setInputText('');
    const userMsgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    setMessages((prev) => [
      ...prev,
      {
        id: `user-${Date.now()}`,
        sender: 'user',
        text: textToSend,
        time: userMsgTime,
      },
    ]);

    setIsProcessing(true);
    setCurrentStage('Understanding inquiry & retrieving policy guidelines...');

    try {
      // 1. Create a ticket in Nova
      const name = preset?.name || customerName || 'Store Customer';
      const email = preset?.email || customerEmail || 'customer@store.com';
      const cat = preset?.category || 'general';
      const amount = preset?.amount ?? null;
      const oId = preset?.orderId || orderId || 'ORD-STORE';

      await new Promise((r) => setTimeout(r, 600));
      setCurrentStage('Evaluating safety guardrails (§2A-1 Fraud, §2A-2 Legal, §3-B Refund Cap)...');

      const ticketRes = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ticket: {
            customer_name: name,
            customer_email: email,
            subject: preset?.subject || textToSend.slice(0, 50),
            body: textToSend,
            category: cat,
            amount_inr: amount,
            priority: 'medium',
            metadata: { order_id: oId, storefront_source: true },
          },
        }),
      });

      const { ticket } = await ticketRes.json();

      await new Promise((r) => setTimeout(r, 700));
      setCurrentStage('Consulting AI layer & checking confidence gate (threshold: 75%)...');

      // 2. Process with Nova Agent
      const runRes = await fetch('/api/agent/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_id: ticket.id }),
      });

      const { decision } = await runRes.json();

      await new Promise((r) => setTimeout(r, 400));
      setCurrentStage(null);

      const novaMsgTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setMessages((prev) => [
        ...prev,
        {
          id: `nova-${Date.now()}`,
          sender: 'nova',
          text: decision.customer_reply || decision.reasoning,
          time: novaMsgTime,
          decision,
          ticketNumber: decision.ticket_number,
        },
      ]);
    } catch {
      setCurrentStage(null);
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          sender: 'nova',
          text: 'I apologize, but our support agent experienced a temporary connection delay. Please try again or visit our help desk.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      {/* Floating Toggle Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            className="flex items-center gap-2.5 px-4 py-3 rounded-full bg-gradient-to-r from-amber-600 to-orange-600 text-white font-medium shadow-xl hover:shadow-2xl hover:scale-105 active:scale-95 transition-all text-sm group"
          >
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <span>⚡ Support with Nova AI</span>
            <span className="bg-white/20 text-xs px-2 py-0.5 rounded-full font-mono">Live</span>
          </button>
        ) : null}
      </div>

      {/* Floating Chat Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-full max-w-[420px] h-[640px] max-h-[85vh] bg-[#FEFCF8] dark:bg-[#1E1A16] border border-[#E8DFD5] dark:border-[#38312B] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-5 duration-200">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white flex items-center justify-between shadow-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center text-lg shadow-inner">
                🌌
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="font-semibold text-sm">Nova AI Support</h3>
                  <span className="text-[10px] bg-white/25 px-1.5 py-0.2 rounded font-mono font-bold">Autonomous</span>
                </div>
                <p className="text-[11px] text-amber-100 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 inline-block"></span>
                  Grounded in safety guardrails
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="/"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] bg-white/20 hover:bg-white/30 text-white px-2 py-1 rounded transition-colors"
                title="View Admin Console"
              >
                Console ↗
              </a>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-full hover:bg-white/20 transition-colors text-lg leading-none"
              >
                ✕
              </button>
            </div>
          </div>

          {/* Quick Scenario Preset Chips */}
          <div className="p-2.5 bg-amber-500/10 dark:bg-amber-950/20 border-b border-[#E8DFD5] dark:border-[#38312B] overflow-x-auto">
            <span className="text-[10px] font-mono uppercase tracking-wider text-amber-800 dark:text-amber-300 font-semibold block mb-1.5 px-1">
              Interactive Test Scenarios for Judges:
            </span>
            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
              {PRESET_QUERIES.map((preset) => (
                <button
                  key={preset.label}
                  disabled={isProcessing}
                  onClick={() => handleSendMessage(preset.message, preset)}
                  className="text-[11px] whitespace-nowrap px-2.5 py-1 rounded-full bg-white dark:bg-[#2A241F] border border-amber-300 dark:border-amber-700/50 hover:border-amber-600 text-stone-800 dark:text-stone-200 transition-all flex-shrink-0 shadow-xs hover:bg-amber-50 dark:hover:bg-amber-900/30"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Messages Log */}
          <div className="flex-1 p-4 overflow-y-auto space-y-3.5 bg-[#FAF7F2] dark:bg-[#181411]">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    msg.sender === 'user'
                      ? 'bg-amber-600 text-white rounded-br-xs shadow-sm'
                      : 'bg-white dark:bg-[#25201B] text-stone-800 dark:text-stone-200 border border-[#E8DFD5] dark:border-[#38312B] rounded-bl-xs shadow-sm'
                  }`}
                >
                  {msg.text}

                  {/* Decision info card for judges */}
                  {msg.decision && (
                    <div className="mt-3 pt-2.5 border-t border-stone-200 dark:border-stone-700/60 text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-mono font-semibold">
                        <span className="text-amber-600 dark:text-amber-400">
                          {msg.ticketNumber}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] ${
                            msg.decision.outcome === 'autonomous'
                              ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
                          }`}
                        >
                          {msg.decision.outcome === 'autonomous' ? '✓ Autonomous Action' : '↑ Guardrail Escalated'}
                        </span>
                      </div>
                      {msg.decision.confidence !== null && (
                        <div className="text-[10px] text-stone-500 dark:text-stone-400">
                          Confidence Score: <strong>{(msg.decision.confidence * 100).toFixed(0)}%</strong> (threshold: 75%)
                        </div>
                      )}
                      {msg.decision.hard_rule_fired && (
                        <div className="text-[10px] text-red-600 dark:text-red-400 font-semibold">
                          ⚠️ Guardrail Triggered: {msg.decision.hard_rule_fired}
                        </div>
                      )}
                      <a
                        href={`/?tab=tickets`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-amber-600 dark:text-amber-400 hover:underline block pt-1 font-medium"
                      >
                        Inspect in Nova Console & Audit Log ➔
                      </a>
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-stone-400 dark:text-stone-500 mt-1 px-1">
                  {msg.time}
                </span>
              </div>
            ))}

            {/* Live processing indicator */}
            {isProcessing && currentStage && (
              <div className="flex flex-col items-start space-y-1">
                <div className="bg-white dark:bg-[#25201B] border border-amber-500/30 p-3 rounded-2xl rounded-bl-xs text-xs text-stone-700 dark:text-stone-300 shadow-sm animate-pulse flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full bg-amber-500 animate-ping"></span>
                  <span>{currentStage}</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Footer */}
          <div className="p-3 bg-white dark:bg-[#1E1A16] border-t border-[#E8DFD5] dark:border-[#38312B] space-y-2">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Ask Nova about refunds, orders, returns..."
                className="flex-1 text-xs px-3 py-2.5 rounded-lg border border-[#E8DFD5] dark:border-[#38312B] bg-[#FAF7F2] dark:bg-[#26211C] focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
              <button
                disabled={isProcessing || !inputText.trim()}
                onClick={() => handleSendMessage()}
                className="px-3.5 py-2.5 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
              >
                Send
              </button>
            </div>
            <div className="flex items-center justify-between text-[10px] text-stone-400 dark:text-stone-500 px-1">
              <span>Autonomous resolution limit: ₹500</span>
              <span>Audit trail logged to Postgres</span>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

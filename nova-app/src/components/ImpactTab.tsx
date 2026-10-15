'use client';

import { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts';
import type { ImpactStats, AuditLogEntry } from '@/types';

interface ImpactTabProps {
  stats: ImpactStats;
  auditLog: AuditLogEntry[];
  dark: boolean;
}

// Animated counter hook
function useCountUp(target: number, duration = 1200, decimals = 0) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = Date.now();
    const timer = setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(parseFloat((eased * target).toFixed(decimals)));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration, decimals]);

  return value;
}

function KPICard({
  label, value, suffix = '', prefix = '', note, accent = false, dark,
}: {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  note?: string;
  accent?: boolean;
  dark: boolean;
}) {
  const animated = useCountUp(value, 1400, suffix === '%' || value < 100 ? 1 : 0);

  return (
    <div
      className="paper-card p-5"
      style={{
        borderLeft: accent ? '3px solid var(--accent)' : undefined,
        background: dark ? 'var(--dark-surface)' : undefined,
      }}
    >
      <p className="text-xs uppercase tracking-widest mb-2" style={{ color: 'var(--ink-faint)', letterSpacing: '0.08em' }}>
        {label}
      </p>
      <p className="font-display text-3xl kpi-value" style={{ color: accent ? 'var(--accent)' : 'var(--ink)', letterSpacing: '-0.02em' }}>
        {prefix}{typeof animated === 'number' ? animated.toFixed(suffix === '%' ? 1 : 0) : animated}{suffix}
      </p>
      {note && <p className="text-xs mt-1" style={{ color: 'var(--ink-faint)' }}>{note}</p>}
    </div>
  );
}

const OUTCOME_COLORS: Record<string, string> = {
  autonomous: '#2D6A3F',
  demo_replay: '#2D6A3F',
  escalated: '#C4530E',
  human_resolved: '#1E3A2F',
};

export function ImpactTab({ stats, auditLog, dark }: ImpactTabProps) {
  const textColor = dark ? 'var(--dark-text)' : 'var(--ink)';
  const mutedColor = dark ? 'var(--dark-muted)' : 'var(--ink-faint)';
  const gridColor = dark ? 'rgba(247,243,236,0.06)' : 'rgba(43,33,24,0.06)';

  // Bar chart data: action distribution
  const actionCounts: Record<string, number> = {};
  auditLog.forEach((entry) => {
    const key = entry.action;
    actionCounts[key] = (actionCounts[key] ?? 0) + 1;
  });

  const barData = Object.entries(actionCounts)
    .map(([action, count]) => ({
      action: action.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }))
    .sort((a, b) => b.count - a.count);

  // Pie chart data: outcomes
  const outcomeCounts: Record<string, number> = {};
  auditLog.forEach((entry) => {
    const key = entry.outcome === 'demo_replay' ? 'autonomous' : entry.outcome;
    outcomeCounts[key] = (outcomeCounts[key] ?? 0) + 1;
  });

  const pieData = Object.entries(outcomeCounts).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1).replace('_', ' '),
    value,
    color: OUTCOME_COLORS[name] ?? '#9B8B7A',
  }));

  // Timeline: tickets by outcome over time
  const timelineData = auditLog
    .slice()
    .reverse()
    .map((entry, idx) => ({
      idx: idx + 1,
      outcome: entry.outcome === 'demo_replay' ? 'autonomous' : entry.outcome,
      confidence: entry.confidence ?? 0,
    }));

  return (
    <div className="space-y-8">
      <h2 className="font-display text-lg" style={{ color: textColor }}>
        Impact Dashboard
      </h2>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard
          label="Autonomy Rate"
          value={stats.autonomy_rate}
          suffix="%"
          accent={true}
          note={`${stats.autonomous_count} of ${stats.total_tickets} tickets`}
          dark={dark}
        />
        <KPICard
          label="Hours Saved"
          value={stats.hours_saved}
          suffix="h"
          note="@ 7 min per auto-ticket"
          dark={dark}
        />
        <KPICard
          label="Revenue Recovered"
          value={stats.revenue_recovered}
          prefix="₹"
          note="Cart + subscription saves"
          dark={dark}
        />
        <KPICard
          label="Escalation Rate"
          value={stats.escalation_rate}
          suffix="%"
          note={`${stats.escalated_count} escalated`}
          dark={dark}
        />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard label="Total Processed" value={stats.total_tickets} dark={dark} />
        <KPICard label="Auto-Resolved" value={stats.autonomous_count} dark={dark} />
        <KPICard label="Escalated" value={stats.escalated_count} dark={dark} />
        <KPICard label="Human Resolved" value={stats.human_resolved_count} dark={dark} />
      </div>

      {/* Charts row */}
      {auditLog.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Outcome Pie */}
          <div className="paper-card p-5" style={{ background: dark ? 'var(--dark-surface)' : undefined }}>
            <h3 className="font-display text-sm mb-4" style={{ color: textColor }}>
              Decision Outcomes
            </h3>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={90}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {pieData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    background: dark ? 'var(--dark-surface)' : '#FEFCF8',
                    border: '1px solid var(--card-border)',
                    borderRadius: 2,
                    fontSize: 12,
                    color: textColor,
                  }}
                />
                <Legend
                  formatter={(value) => (
                    <span style={{ color: mutedColor, fontSize: 12 }}>{value}</span>
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Action Bar Chart */}
          {barData.length > 0 && (
            <div className="paper-card p-5" style={{ background: dark ? 'var(--dark-surface)' : undefined }}>
              <h3 className="font-display text-sm mb-4" style={{ color: textColor }}>
                Actions Taken
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={barData} layout="vertical" margin={{ left: 8 }}>
                  <CartesianGrid horizontal={false} stroke={gridColor} />
                  <XAxis type="number" tick={{ fontSize: 11, fill: mutedColor }} />
                  <YAxis type="category" dataKey="action" tick={{ fontSize: 11, fill: mutedColor }} width={110} />
                  <Tooltip
                    contentStyle={{
                      background: dark ? 'var(--dark-surface)' : '#FEFCF8',
                      border: '1px solid var(--card-border)',
                      borderRadius: 2,
                      fontSize: 12,
                      color: textColor,
                    }}
                  />
                  <Bar dataKey="count" fill="var(--accent)" radius={[0, 2, 2, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Confidence distribution */}
      {timelineData.length > 0 && (
        <div className="paper-card p-5" style={{ background: dark ? 'var(--dark-surface)' : undefined }}>
          <h3 className="font-display text-sm mb-1" style={{ color: textColor }}>
            Confidence Scores
          </h3>
          <p className="text-xs mb-4" style={{ color: mutedColor }}>
            Agent confidence per processed ticket (threshold: 75%)
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={timelineData}>
              <CartesianGrid vertical={false} stroke={gridColor} />
              <XAxis dataKey="idx" tick={{ fontSize: 10, fill: mutedColor }} label={{ value: 'Ticket #', position: 'insideBottom', offset: -2, fill: mutedColor, fontSize: 10 }} />
              <YAxis domain={[0, 1]} tickFormatter={(v) => `${(v * 100).toFixed(0)}%`} tick={{ fontSize: 10, fill: mutedColor }} />
              <Tooltip
                formatter={(val: unknown) => [`${((Number(val) || 0) * 100).toFixed(0)}%`, 'Confidence']}
                contentStyle={{
                  background: dark ? 'var(--dark-surface)' : '#FEFCF8',
                  border: '1px solid var(--card-border)',
                  borderRadius: 2,
                  fontSize: 12,
                  color: textColor,
                }}
              />
              {/* Threshold line */}
              <Bar dataKey="confidence" radius={[2, 2, 0, 0]}>
                {timelineData.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.confidence >= 0.75 ? '#2D6A3F' : entry.confidence >= 0.5 ? '#9A6400' : '#B91C1C'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Guardrails summary */}
      <div className="paper-card p-5" style={{ background: dark ? 'var(--dark-surface)' : undefined }}>
        <h3 className="font-display text-sm mb-3" style={{ color: textColor }}>
          Safety Guardrails Active
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { rule: 'FRAUD_FLAG', label: 'Fraud Detection', count: auditLog.filter((a) => a.hard_rule_fired === 'FRAUD_FLAG').length, color: 'var(--danger)' },
            { rule: 'LEGAL_FLAG', label: 'Legal Escalation', count: auditLog.filter((a) => a.hard_rule_fired === 'LEGAL_FLAG').length, color: 'var(--warning)' },
            { rule: 'REFUND_CAP', label: 'Refund Cap (₹500)', count: auditLog.filter((a) => a.hard_rule_fired === 'REFUND_CAP').length, color: 'var(--accent)' },
            { rule: 'PRICE_MATCH', label: 'Price Match Guard', count: auditLog.filter((a) => a.hard_rule_fired === 'PRICE_MATCH_INELIGIBLE').length, color: 'var(--accent-forest)' },
          ].map((item) => (
            <div key={item.rule} className="p-3 rounded text-center" style={{ background: 'var(--cream-dark)' }}>
              <div className="font-display text-2xl" style={{ color: item.color }}>{item.count}</div>
              <div className="text-xs mt-1" style={{ color: mutedColor }}>{item.label}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 text-xs" style={{ color: mutedColor }}>
          Confidence gate fired: {auditLog.filter((a) => a.outcome === 'escalated' && !a.hard_rule_fired).length} times
        </div>
      </div>
    </div>
  );
}

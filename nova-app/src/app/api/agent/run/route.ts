import { NextRequest, NextResponse } from 'next/server';
import { fetchTicketById, updateTicketStatus, addAuditLog, addAction } from '@/lib/data-store';
import { decide } from '@/lib/ai-layer';

export async function POST(req: NextRequest) {
  try {
    const { ticket_id } = await req.json();

    if (!ticket_id) {
      return NextResponse.json({ error: 'ticket_id is required' }, { status: 400 });
    }

    // Fetch ticket
    const { ticket } = await fetchTicketById(ticket_id);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Mark as processing
    await updateTicketStatus(ticket.id, 'processing');

    // Run the agent decision
    const decision = await decide(ticket);

    // §2-E: Write to audit_log BEFORE replying
    const auditEntry = await addAuditLog({
      ticket_id: decision.ticket_id,
      ticket_number: decision.ticket_number,
      action: decision.action,
      confidence: decision.confidence,
      reasoning: decision.reasoning,
      policy_refs: decision.policy_refs,
      escalation_reason: decision.escalation_reason,
      outcome: decision.outcome,
      llm_provider: decision.llm_provider,
      customer_reply: decision.customer_reply,
      hard_rule_fired: decision.hard_rule_fired,
    });

    // Record the action
    if (decision.action !== 'human_verification') {
      await addAction({
        ticket_id: decision.ticket_id,
        audit_log_id: auditEntry?.id ?? null,
        action_type: decision.action,
        action_data: {
          reasoning: decision.reasoning,
          confidence: decision.confidence,
        },
        executed_by: 'nova_agent',
      });
    }

    // Update ticket status
    const newStatus =
      decision.outcome === 'autonomous' || decision.outcome === 'demo_replay'
        ? 'autonomous'
        : 'escalated';

    await updateTicketStatus(ticket.id, newStatus);

    return NextResponse.json({
      success: true,
      decision,
      audit_id: auditEntry?.id,
    });
  } catch (err) {
    console.error('[Nova] /api/agent/run error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

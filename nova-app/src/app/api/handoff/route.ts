import { NextRequest, NextResponse } from 'next/server';
import { fetchTicketById, updateTicketStatus, addAuditLog } from '@/lib/data-store';

export async function POST(req: NextRequest) {
  try {
    const { ticket_id, resolution, notes } = await req.json();

    if (!ticket_id || !resolution) {
      return NextResponse.json(
        { error: 'ticket_id and resolution are required' },
        { status: 400 }
      );
    }

    if (!['approved', 'rejected'].includes(resolution)) {
      return NextResponse.json(
        { error: 'resolution must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    // Fetch the ticket
    const { ticket } = await fetchTicketById(ticket_id);

    if (!ticket) {
      return NextResponse.json({ error: 'Ticket not found' }, { status: 404 });
    }

    // Write human resolution to audit log (§2-F)
    const auditEntry = await addAuditLog({
      ticket_id: ticket.id,
      ticket_number: ticket.ticket_number,
      action: resolution === 'approved' ? 'update_ticket' : 'draft_reply',
      confidence: 1.0,
      reasoning: `Human override: ${resolution}. ${notes ?? ''}`.trim(),
      policy_refs: ['§2F-HUMAN_OVERRIDE'],
      escalation_reason: null,
      outcome: 'human_resolved',
      llm_provider: 'human',
      customer_reply:
        resolution === 'approved'
          ? `Your request has been reviewed and approved by our team. We will process it immediately.`
          : `After careful review, we are unable to fulfill this specific request. Please contact us for alternatives.`,
      hard_rule_fired: null,
    });

    // Update ticket status to human_resolved
    await updateTicketStatus(ticket.id, 'human_resolved');

    return NextResponse.json({
      success: true,
      resolution,
      ticket_number: ticket.ticket_number,
      audit_id: auditEntry?.id,
    });
  } catch (err) {
    console.error('[Nova] /api/handoff error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

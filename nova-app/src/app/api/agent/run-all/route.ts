import { NextResponse } from 'next/server';
import { fetchAllTickets, updateTicketStatus, addAuditLog, addAction } from '@/lib/data-store';
import { decide } from '@/lib/ai-layer';
import type { SSEEvent } from '@/types';

export const maxDuration = 120; // 2 minute timeout for SSE

function sseMessage(event: SSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET() {
  const { tickets: allTickets } = await fetchAllTickets();
  const tickets = (allTickets ?? []).filter(
    (t) => t.status === 'open' || t.status === 'processing'
  );

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      function send(event: SSEEvent) {
        controller.enqueue(encoder.encode(sseMessage(event)));
      }

      try {
        send({ type: 'start', message: `Processing ${tickets.length} tickets...` });

        for (const ticket of tickets) {
          // Stage: Understanding
          send({
            type: 'stage',
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            stage: 'understanding',
            message: `Reading ticket ${ticket.ticket_number}: "${ticket.subject.slice(0, 60)}..."`,
          });
          await sleep(400);

          // Update status to processing
          await updateTicketStatus(ticket.id, 'processing');

          // Stage: Reasoning
          send({
            type: 'stage',
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            stage: 'reasoning',
            message: `Applying policy checks for ${ticket.category} ticket...`,
          });
          await sleep(600);

          // Stage: Decision
          send({
            type: 'stage',
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            stage: 'decision',
            message: 'Evaluating confidence gate and generating response...',
          });

          // Run the agent
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

          // Record action if autonomous
          if (decision.action !== 'human_verification') {
            await addAction({
              ticket_id: decision.ticket_id,
              audit_log_id: auditEntry?.id ?? null,
              action_type: decision.action,
              action_data: { reasoning: decision.reasoning, confidence: decision.confidence },
              executed_by: 'nova_agent',
            });
          }

          // Update ticket status
          const newStatus =
            decision.outcome === 'autonomous' || decision.outcome === 'demo_replay'
              ? 'autonomous'
              : 'escalated';

          await updateTicketStatus(ticket.id, newStatus);

          // Stage: Action/Handoff
          send({
            type: 'stage',
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            stage: 'action',
            message:
              decision.outcome === 'escalated'
                ? `Escalating to Human Handoff: ${decision.escalation_reason?.slice(0, 80)}...`
                : `Executing: ${decision.action}`,
          });
          await sleep(300);

          // Result
          send({
            type: 'result',
            ticket_id: ticket.id,
            ticket_number: ticket.ticket_number,
            stage: 'done',
            decision,
          });

          await sleep(200);
        }

        send({ type: 'complete', message: 'All tickets processed.' });
      } catch (err) {
        send({
          type: 'error',
          error: err instanceof Error ? err.message : 'Unknown error during processing',
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

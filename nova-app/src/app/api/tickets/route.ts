import { NextRequest, NextResponse } from 'next/server';
import { fetchAllTickets, resetLocalStore, createTicket } from '@/lib/data-store';

export async function GET() {
  try {
    const { tickets, isFallback } = await fetchAllTickets();
    return NextResponse.json({ tickets: tickets ?? [], isFallback });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === 'reset' || Object.keys(body).length === 0) {
      const tickets = resetLocalStore();
      return NextResponse.json({ success: true, tickets });
    }

    // Creating new simulation ticket
    const newTicket = await createTicket(body.ticket || body);
    return NextResponse.json({ success: true, ticket: newTicket }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

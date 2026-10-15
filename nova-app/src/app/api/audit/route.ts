import { NextRequest, NextResponse } from 'next/server';
import { fetchAuditLogs } from '@/lib/data-store';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const ticketId = searchParams.get('ticket_id') ?? undefined;
  const limit = parseInt(searchParams.get('limit') ?? '50');

  try {
    const entries = await fetchAuditLogs(ticketId, limit);
    return NextResponse.json({ entries: entries ?? [] });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

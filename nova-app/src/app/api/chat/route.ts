import { NextRequest, NextResponse } from 'next/server';
import { fetchAuditLogs } from '@/lib/data-store';

export async function POST(req: NextRequest) {
  try {
    const { question } = await req.json();

    if (!question || typeof question !== 'string') {
      return NextResponse.json({ error: 'question is required' }, { status: 400 });
    }

    // Fetch recent audit logs for context
    const auditLogs = await fetchAuditLogs(undefined, 20);

    // Build context from audit logs
    const context = (auditLogs ?? [])
      .map(
        (entry) =>
          `[${entry.ticket_number}] ${new Date(entry.created_at).toLocaleString('en-IN')} | Action: ${entry.action} | Outcome: ${entry.outcome} | Confidence: ${entry.confidence ?? 'N/A'} | Reasoning: ${entry.reasoning}${entry.escalation_reason ? ` | Escalation: ${entry.escalation_reason}` : ''}${entry.hard_rule_fired ? ` | Hard Rule: ${entry.hard_rule_fired}` : ''}`
      )
      .join('\n');

    // Use Gemini to answer from audit context only
    try {
      const { GoogleGenerativeAI } = await import('@google/generative-ai');
      const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
      const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });

      const prompt = `You are Nova's audit assistant. Answer questions ONLY using the provided audit log context. Never invent history. If the answer is not in the context, say "I don't have that information in the audit log."

AUDIT LOG CONTEXT:
${context}

USER QUESTION: ${question}

Answer concisely in 2-4 sentences, referencing specific ticket numbers when relevant.`;

      const result = await model.generateContent(prompt);
      const answer = result.response.text().trim();

      return NextResponse.json({ answer });
    } catch {
      // Try Groq fallback
      try {
        const Groq = (await import('groq-sdk')).default;
        const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
        const completion = await groq.chat.completions.create({
          model: 'openai/gpt-oss-120b',
          messages: [
            {
              role: 'system',
              content: `You are Nova's audit assistant. Answer questions ONLY using the provided audit log context. Never invent history. If the answer is not in the context, say "I don't have that information in the audit log."\n\nAUDIT LOG CONTEXT:\n${context}`,
            },
            { role: 'user', content: question },
          ],
          max_tokens: 250,
          temperature: 0.2,
        });

        const groqAnswer = completion.choices[0]?.message?.content?.trim();
        if (groqAnswer) {
          return NextResponse.json({ answer: groqAnswer });
        }
      } catch {
        // Fallback: answer from context regex
      }

      // Static context matching fallback
      const ticketMentioned = question.match(/TKT-\d+|ticket\s*#?\s*(\d+)/i);
      if (ticketMentioned) {
        const relevantLogs = (auditLogs ?? []).filter(
          (l) => l.ticket_number.includes(ticketMentioned[0]) || question.includes(l.ticket_number)
        );

        if (relevantLogs.length > 0) {
          const log = relevantLogs[0];
          const answer = `${log.ticket_number} was ${log.outcome}. Action taken: ${log.action}. Reasoning: ${log.reasoning}${log.escalation_reason ? ` Escalated because: ${log.escalation_reason}` : ''}`;
          return NextResponse.json({ answer });
        }
      }

      return NextResponse.json({
        answer: 'I can only answer questions based on the audit log. ' + (context ? context.slice(0, 200) : 'No audit entries found yet.'),
      });
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

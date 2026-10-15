import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function GET() {
  const results: Record<string, { status: 'ok' | 'error'; message: string }> = {};

  // Check Supabase
  try {
    const supabase = createServerClient();
    const { count, error } = await supabase
      .from('tickets')
      .select('*', { count: 'exact', head: true });

    if (error) throw error;
    results.supabase = { status: 'ok', message: `Connected — ${count ?? 0} tickets in DB` };
  } catch (err) {
    results.supabase = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Supabase connection failed',
    };
  }

  // Check Gemini
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY not set');

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-3.8-flash' });
    const result = await model.generateContent('Reply with exactly: "Nova health check OK"');
    const text = result.response.text().trim();
    results.gemini = { status: 'ok', message: `Gemini responded: "${text.slice(0, 50)}"` };
  } catch (err) {
    results.gemini = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Gemini connection failed',
    };
  }

  // Check Groq
  try {
    const Groq = (await import('groq-sdk')).default;
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) throw new Error('GROQ_API_KEY not set');

    const groq = new Groq({ apiKey });
    const completion = await groq.chat.completions.create({
      model: 'openai/gpt-oss-120b',
      messages: [{ role: 'user', content: 'Reply with exactly: "Nova health check OK"' }],
      max_tokens: 20,
    });
    const text = completion.choices[0]?.message?.content ?? '';
    results.groq = { status: 'ok', message: `Groq responded: "${text.slice(0, 50)}"` };
  } catch (err) {
    results.groq = {
      status: 'error',
      message: err instanceof Error ? err.message : 'Groq connection failed',
    };
  }

  const allOk = Object.values(results).every((r) => r.status === 'ok');
  const status = allOk ? 200 : 207;

  return NextResponse.json(
    {
      status: allOk ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      demo_mode: process.env.DEMO_MODE === 'true',
      checks: results,
    },
    { status }
  );
}

# 🌌 NOVA — Autonomous AI Agent System

> **A production-grade, guardrail-first Autonomous AI Customer Support Agent** built with Next.js 16 (App Router), TypeScript, Tailwind CSS, Supabase, Google Gemini 3.8 Flash, and Groq SDK.

---

## ⚡ Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │              Customer Ticket           │
                      └───────────────────┬────────────────────┘
                                          │
                                          ▼
                      ┌────────────────────────────────────────┐
                      │      Deterministic Policy Engine       │
                      │   (Fraud / Legal / Refund / Margin)    │
                      └───────┬────────────────────────┬───────┘
                     BLOCKED  │                        │  CLEAN
                              ▼                        ▼
               ┌──────────────────────┐    ┌──────────────────────┐
               │ Human Handoff Queue  │    │  Dual AI Fallback    │
               │ (Zero Auto-Action)   │    │  1. Gemini 3.8 Flash │
               └──────────────────────┘    │  2. Groq Fallback    │
                                           │  3. Demo Replay      │
                                           └──────────┬───────────┘
                                                      │
                                                      ▼
                                           ┌──────────────────────┐
                                           │   Confidence Gate    │
                                           │   (Threshold ≥ 75%)  │
                                           └────┬─────────────┬───┘
                                      < 75%     │             │ ≥ 75%
                                                ▼             ▼
                                        ┌────────────┐   ┌────────────┐
                                        │  Escalate  │   │ Autonomous │
                                        │  to Human  │   │ Execution  │
                                        └────────────┘   └────────────┘
                                                │             │
                                                ▼             ▼
                                        ┌─────────────────────────────┐
                                        │   Append-Only Audit Log     │
                                        │  (Postgres RLS Enforced)    │
                                        └─────────────────────────────┘
```

---

## 🛡️ Safety Guardrails (Zero-Tolerance)

Nova prioritizes **safety over autonomy**:

1. **Deterministic Rule Engine Before AI**:
   - **Fraud Flag**: Immediate escalation (`confidence: 0`, `hard_rule_fired: 'FRAUD_FLAG'`).
   - **Legal Threats**: Chargeback / attorney mentions automatically blocked and routed to Legal.
   - **Refund Cap**: Autonomous refunds strictly capped at **₹500**. Any refund request exceeding ₹500 is escalated to human review.
   - **Price Match Threshold**: Competitor price matches resulting in **>15% margin erosion** are escalated for commercial approval.
2. **Confidence Gate**:
   - Any LLM decision with confidence score `< 0.75` is blocked from autonomous resolution and routed to Human Handoff.
3. **Immutable Audit Trail**:
   - Database Row Level Security (RLS) blocks all `UPDATE` and `DELETE` queries on the `audit_log` table.
4. **Context-Grounded Audit Assistant**:
   - Audit chat uses retrieval grounded solely in audit logs — never invents history.

---

## 🚀 Run Checklist

### 1. Install Dependencies
```bash
cd nova-app
npm install
```

### 2. Configure Environment (`.env.local`)
Create `.env.local` in `nova-app/`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://jlloovqjgpsbrhyevdxc.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbG9vdnFqZ3BzYnJoeWV2ZHhjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIwMzg0MzAsImV4cCI6MjEwNzYxNDQzMH0.6ZnmiaV6qDIJgjgGF8JA2pdMdDVag31p3tQ4KIB0mXs
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsbG9vdnFqZ3BzYnJoeWV2ZHhjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MjAzODQzMCwiZXhwIjoyMTA3NjE0NDMwfQ.9GVpUo0xFcoVrXsUiazmfRUxK9c5fCXQACXwrDXwpGE
GEMINI_API_KEY=your_gemini_api_key
GROQ_API_KEY=your_groq_api_key
DEMO_MODE=false
```

### 3. Database Setup (Supabase)
1. Open your Supabase SQL Editor:
   [https://supabase.com/dashboard/project/jlloovqjgpsbrhyevdxc/sql/new](https://supabase.com/dashboard/project/jlloovqjgpsbrhyevdxc/sql/new)
2. Paste the contents of `supabase/schema.sql` and click **Run**.
3. Seed the 8 realistic demo tickets:
   ```bash
   npm run seed
   ```
> *Note: Nova also includes a built-in fallback data store, meaning the full app, UI, agent runs, and SSE pipelines work out-of-the-box even prior to running schema.sql!*

### 4. Run Policy Engine Tests
Run the 31 comprehensive unit tests:
```bash
npm test
```

### 5. Launch Development Server
```bash
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

---

## 🎯 Demo Walkthrough

1. **Tickets Console**:
   - Review 8 pre-seeded tickets representing different tiers (Defective item, Fraud, Replacement, Overdue delivery, Price match, Subscription retention, Cart abandonment, Legal dispute).
2. **Execute Single Ticket**:
   - Click "Run Nova" on `TKT-001` (Defective headphones ₹350) ➔ Autonomous full refund with customer reply.
   - Click "Run Nova" on `TKT-002` (Fraud attempt) ➔ Intercepted by Hard Rule `FRAUD_FLAG`, zero payout, escalated to Human Handoff.
3. **Execute All (Live SSE Streaming)**:
   - Click **▶ Run All** at top right.
   - Watch the live SSE terminal stream tickets through:
     `Understanding` ➔ `Reasoning` ➔ `Decision` ➔ `Action`.
4. **Human Handoff Tab**:
   - Review escalated tickets with reasons and confidence needles.
   - Approve or reject with human resolution notes.
5. **Audit Log Tab & AI Assistant**:
   - View chronological, immutable audit records.
   - Use the Nova Audit Assistant to ask questions (e.g. *"Why was ticket TKT-002 escalated?"*).
6. **Impact Dashboard**:
   - View animated KPIs, category distribution charts, and confidence distribution graphs.
7. **Reset Demo**:
   - Click **↺ Reset** anytime in the header to restart the demo from scratch.

---

## 🛠️ API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/health` | Comprehensive health check for Supabase, Gemini, and Groq |
| `GET` | `/api/tickets` | Returns all tickets |
| `POST` | `/api/tickets` | Resets all demo tickets back to initial state |
| `POST` | `/api/agent/run` | Runs Nova agent decision on a specific ticket |
| `GET` | `/api/agent/run-all` | Server-Sent Events (SSE) live pipeline stream |
| `GET` | `/api/audit` | Retrieves append-only audit logs |
| `POST` | `/api/handoff` | Human agent override approval or rejection |
| `POST` | `/api/chat` | Context-grounded audit query assistant |

---

## 🧪 Testing Summary

- **Framework**: Vitest 5.0
- **Test File**: `src/lib/__tests__/policy-engine.test.ts`
- **Result**: `31 passed (100%)`
  - Fraud rule tests (4)
  - Legal rule tests (5)
  - Refund cap tests (6)
  - Price match margin tests (4)
  - Master priority resolution tests (4)
  - Confidence gate threshold tests (6)
  - Action whitelist tests (2)

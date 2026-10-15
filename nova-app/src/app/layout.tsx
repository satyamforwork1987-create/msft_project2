import type { Metadata } from 'next';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata: Metadata = {
  title: 'Nova — Autonomous AI Agent Console',
  description:
    'Nova is a confidence-gated autonomous AI agent for e-commerce support and sales. Processes tickets with safety guardrails, full audit trail, and human-in-the-loop escalation.',
  keywords: 'AI agent, autonomous, e-commerce, support, safety guardrails, audit log',
  authors: [{ name: 'Team Server Hack' }],
  openGraph: {
    title: 'Nova — Autonomous AI Agent',
    description: 'Confidence-gated autonomous AI agent with safety guardrails',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#F7F3EC" />
      </head>
      <body>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </body>
    </html>
  );
}

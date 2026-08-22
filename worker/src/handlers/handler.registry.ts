export interface JobHandlerContext {
  jobId: string;
  attemptNumber: number;
  log: (level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string) => Promise<void>;
}

export type JobHandlerFunction = (payload: any, context: JobHandlerContext) => Promise<any>;

class HandlerRegistry {
  private handlers = new Map<string, JobHandlerFunction>();

  register(handlerType: string, fn: JobHandlerFunction) {
    this.handlers.set(handlerType, fn);
  }

  get(handlerType: string): JobHandlerFunction | undefined {
    return this.handlers.get(handlerType);
  }
}

export const registry = new HandlerRegistry();

// 1. Ledger Settlement Handler
registry.register('LEDGER_SETTLEMENT', async (payload, ctx) => {
  await ctx.log('INFO', `Validating ledger settlement for account ${payload.account || 'DEFAULT'}`);
  await new Promise((r) => setTimeout(r, 400));
  const amount = Number(payload.amount || 100);
  await ctx.log('INFO', `Debited $${amount} from source ledger, transaction settled with auth code TX_${Date.now()}`);
  return {
    settled: true,
    amount,
    currency: payload.currency || 'USD',
    settlementTimestamp: new Date().toISOString(),
  };
});

// 2. Notification / Email Handler
registry.register('SEND_NOTIFICATION', async (payload, ctx) => {
  await ctx.log('INFO', `Dispatching notification to ${payload.recipient || 'system@acme.com'}`);
  await new Promise((r) => setTimeout(r, 300));
  await ctx.log('INFO', 'Notification successfully delivered via SMTP bridge');
  return { delivered: true, recipient: payload.recipient, timestamp: new Date().toISOString() };
});

registry.register('SEND_EMAIL', async (payload, ctx) => {
  await ctx.log('INFO', `Sending transactional email to ${payload.to || 'user@example.com'}`);
  await new Promise((r) => setTimeout(r, 300));
  await ctx.log('INFO', `Template "${payload.template || 'default'}" rendered and transmitted (250 OK)`);
  return { sent: true, to: payload.to, messageId: `msg_${Date.now()}` };
});

// 3. KYC Verification Handler
registry.register('KYC_VERIFY', async (payload, ctx) => {
  await ctx.log('INFO', `Starting automated KYC background check for user ${payload.userId}`);
  await new Promise((r) => setTimeout(r, 500));
  await ctx.log('INFO', `Sanctions list and passport checks passed for user ${payload.userId}`);
  return {
    verified: true,
    userId: payload.userId,
    status: 'APPROVED',
    riskScore: 0.02,
    verifiedAt: new Date().toISOString(),
  };
});

// 4. Batch Parent Orchestrator
registry.register('BATCH_PARENT_ORCHESTRATOR', async (payload, ctx) => {
  await ctx.log('INFO', `Parent orchestrator initialized for batch "${payload.batchName}" (${payload.batchSize} items)`);
  return { status: 'INITIALIZED', batchSize: payload.batchSize };
});

// 5. PDF Generation (DAG Step 2)
registry.register('GENERATE_PDF', async (payload, ctx) => {
  await ctx.log('INFO', `Rendering PDF receipt using template "${payload.template}"`);
  await new Promise((r) => setTimeout(r, 450));
  await ctx.log('INFO', 'PDF binary generated (142 KB), uploaded to S3 bucket');
  return { pdfUrl: `https://storage.acme.corp/invoices/inv_${Date.now()}.pdf`, sizeBytes: 145408 };
});

// 6. System Health Check Handler
registry.register('SYSTEM_HEALTH_CHECK', async (_payload, ctx) => {
  await ctx.log('INFO', 'Probing PostgreSQL cluster and disk capacity');
  await new Promise((r) => setTimeout(r, 200));
  await ctx.log('INFO', 'System healthy: PostgreSQL latency < 2ms, disk 42% free');
  return { healthy: true, latencyMs: 1.8, memoryUsagePct: 35.4 };
});

// 7. Hourly Reconciliation Handler
registry.register('HOURLY_RECON', async (payload, ctx) => {
  await ctx.log('INFO', `Running reconciliation audit on ledger "${payload.ledger || 'primary'}"`);
  await new Promise((r) => setTimeout(r, 600));
  await ctx.log('INFO', 'Audit complete: 0 discrepancy detected across 1,420 ledger rows');
  return { ledger: payload.ledger, matched: true, discrepancyCount: 0 };
});

// 8. HTTP Webhook Handler
registry.register('HTTP_WEBHOOK', async (payload, ctx) => {
  const url = payload.url || payload.endpoint;
  if (!url) {
    throw new Error('HTTP webhook requires "url" or "endpoint" in payload');
  }
  await ctx.log('INFO', `Dispatching POST request to webhook endpoint: ${url}`);
  // In simulated environment, complete webhook request
  await new Promise((r) => setTimeout(r, 350));
  await ctx.log('INFO', `Webhook delivered to ${url} with status 200 OK`);
  return { statusCode: 200, response: 'OK' };
});

// 9. Deterministic Failing Task for Retry/DLQ Testing
registry.register('FAILING_TASK', async (payload, ctx) => {
  await ctx.log('WARN', `Attempting task execution (Attempt #${ctx.attemptNumber})`);
  const shouldFail = payload.failUntilAttempt ? ctx.attemptNumber < payload.failUntilAttempt : true;
  if (shouldFail) {
    const errorMsg = payload.errorMessage || `Simulated failure on attempt #${ctx.attemptNumber}`;
    await ctx.log('ERROR', errorMsg);
    throw new Error(errorMsg);
  }
  await ctx.log('INFO', `Task recovered and succeeded on attempt #${ctx.attemptNumber}!`);
  return { recovered: true, finalAttempt: ctx.attemptNumber };
});

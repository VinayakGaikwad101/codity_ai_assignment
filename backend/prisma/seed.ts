import 'dotenv/config';
import { PrismaClient, UserRole, RetryStrategy, JobType, JobStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('[Seed] Starting database seeding...');

  // 1. Create Organization
  const org = await prisma.organization.upsert({
    where: { slug: 'acme-corp' },
    update: {},
    create: {
      name: 'Acme Corporation',
      slug: 'acme-corp',
    },
  });
  console.log(`[Seed] Created organization: ${org.name} (${org.id})`);

  // 2. Create Users
  const passwordHash = await bcrypt.hash('Admin@12345', 10);

  const admin = await prisma.user.upsert({
    where: { email: 'admin@acme.com' },
    update: { passwordHash },
    create: {
      organizationId: org.id,
      email: 'admin@acme.com',
      name: 'Vinayak Gaikwad (Admin)',
      passwordHash,
      role: UserRole.ADMIN,
    },
  });

  const operator = await prisma.user.upsert({
    where: { email: 'operator@acme.com' },
    update: { passwordHash },
    create: {
      organizationId: org.id,
      email: 'operator@acme.com',
      name: 'Operations Lead',
      passwordHash,
      role: UserRole.OPERATOR,
    },
  });
  console.log(`[Seed] Created users: ${admin.email}, ${operator.email}`);

  // 3. Create Project
  const project = await prisma.project.upsert({
    where: {
      organizationId_slug: {
        organizationId: org.id,
        slug: 'core-scheduler',
      },
    },
    update: {},
    create: {
      organizationId: org.id,
      name: 'Core Platform Scheduler',
      slug: 'core-scheduler',
      description: 'Primary distributed asynchronous queue cluster',
    },
  });
  console.log(`[Seed] Created project: ${project.name} (${project.id})`);

  // 4. Create API Key
  const rawKey = 'djs_live_a1b2c3d4e5f6789012345678abcdef';
  const keyPrefix = rawKey.substring(0, 12);
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  await prisma.apiKey.upsert({
    where: { keyHash },
    update: {},
    create: {
      organizationId: org.id,
      projectId: project.id,
      name: 'Production Ingestion API Key',
      keyPrefix,
      keyHash,
      role: UserRole.OPERATOR,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  console.log(`[Seed] Created machine API key: ${keyPrefix}...`);

  // 5. Create Retry Policies
  const expPolicy = await prisma.retryPolicy.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'Standard Exponential Backoff',
      },
    },
    update: {},
    create: {
      projectId: project.id,
      name: 'Standard Exponential Backoff',
      strategy: RetryStrategy.EXPONENTIAL,
      maxRetries: 3,
      initialIntervalMs: 1000,
      maxIntervalMs: 30000,
      backoffMultiplier: 2.0,
      useJitter: true,
    },
  });

  const linearPolicy = await prisma.retryPolicy.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'Linear Backoff Retry',
      },
    },
    update: {},
    create: {
      projectId: project.id,
      name: 'Linear Backoff Retry',
      strategy: RetryStrategy.LINEAR,
      maxRetries: 4,
      initialIntervalMs: 2000,
      maxIntervalMs: 15000,
      backoffMultiplier: 1.0,
      useJitter: false,
    },
  });

  const fixedPolicy = await prisma.retryPolicy.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'Fixed 5-Second Delay',
      },
    },
    update: {},
    create: {
      projectId: project.id,
      name: 'Fixed 5-Second Delay',
      strategy: RetryStrategy.FIXED,
      maxRetries: 2,
      initialIntervalMs: 5000,
      maxIntervalMs: 5000,
      backoffMultiplier: 1.0,
      useJitter: false,
    },
  });
  console.log(`[Seed] Created retry policies: ${expPolicy.name}, ${linearPolicy.name}, ${fixedPolicy.name}`);

  // 6. Create Queues
  const emailQueue = await prisma.queue.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'high-priority-emails',
      },
    },
    update: {},
    create: {
      projectId: project.id,
      name: 'high-priority-emails',
      description: 'Critical transactional emails and password resets',
      priority: 90,
      concurrencyLimit: 15,
      rateLimitPerMin: 500,
      retryPolicyId: expPolicy.id,
    },
  });

  const defaultQueue = await prisma.queue.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'default-processing',
      },
    },
    update: {},
    create: {
      projectId: project.id,
      name: 'default-processing',
      description: 'Standard background processing tasks',
      priority: 50,
      concurrencyLimit: 10,
      rateLimitPerMin: 300,
      retryPolicyId: expPolicy.id,
    },
  });

  const analyticsQueue = await prisma.queue.upsert({
    where: {
      projectId_name: {
        projectId: project.id,
        name: 'heavy-analytics-reports',
      },
    },
    update: {},
    create: {
      projectId: project.id,
      name: 'heavy-analytics-reports',
      description: 'Resource-intensive analytical report generation',
      priority: 20,
      concurrencyLimit: 3,
      retryPolicyId: linearPolicy.id,
    },
  });
  console.log(`[Seed] Created queues: ${emailQueue.name}, ${defaultQueue.name}, ${analyticsQueue.name}`);

  // 7. Create Scheduled (Cron) Jobs
  await prisma.scheduledJob.createMany({
    data: [
      {
        projectId: project.id,
        queueId: defaultQueue.id,
        name: 'Hourly Health Check',
        handlerType: 'SYSTEM_HEALTH_CHECK',
        cronExpression: '0 * * * *',
        timezone: 'UTC',
        payload: { checkDatabase: true, checkDiskSpace: true },
        priority: 60,
        nextRunAt: new Date(Date.now() + 3600000),
        isActive: true,
      },
      {
        projectId: project.id,
        queueId: analyticsQueue.id,
        name: 'Nightly Aggregation Summary',
        handlerType: 'GENERATE_REPORT',
        cronExpression: '0 0 * * *',
        timezone: 'UTC',
        payload: { reportType: 'daily_metrics_rollup' },
        priority: 30,
        nextRunAt: new Date(Date.now() + 86400000),
        isActive: true,
      },
    ],
    skipDuplicates: true,
  });
  console.log('[Seed] Created scheduled cron jobs.');

  // 8. Seed sample completed jobs for historical throughput metrics
  const job1 = await prisma.job.create({
    data: {
      projectId: project.id,
      queueId: emailQueue.id,
      name: 'Welcome Email - user_101',
      handlerType: 'SEND_EMAIL',
      jobType: JobType.IMMEDIATE,
      status: JobStatus.COMPLETED,
      priority: 90,
      payload: { to: 'newuser@example.com', template: 'welcome' },
      result: { sent: true, messageId: 'msg_98765' },
      startedAt: new Date(Date.now() - 30000),
      completedAt: new Date(Date.now() - 28500),
    },
  });

  const job2 = await prisma.job.create({
    data: {
      projectId: project.id,
      queueId: defaultQueue.id,
      name: 'Sync Stripe Webhook Event evt_9981',
      handlerType: 'WEBHOOK_DISPATCH',
      jobType: JobType.IMMEDIATE,
      status: JobStatus.COMPLETED,
      priority: 50,
      payload: { event: 'invoice.payment_succeeded', amount: 4900 },
      result: { processed: true, balanceUpdated: true },
      startedAt: new Date(Date.now() - 60000),
      completedAt: new Date(Date.now() - 59100),
    },
  });

  // Seed sample execution logs for observability verification
  await prisma.jobLog.createMany({
    data: [
      {
        jobId: job1.id,
        level: 'INFO',
        message: 'Email dispatch initiated to newuser@example.com',
        timestamp: new Date(Date.now() - 29500),
      },
      {
        jobId: job1.id,
        level: 'INFO',
        message: 'SMTP handshake successful, email delivered (250 OK)',
        timestamp: new Date(Date.now() - 28500),
      },
      {
        jobId: job2.id,
        level: 'INFO',
        message: 'Received invoice.payment_succeeded webhook payload',
        timestamp: new Date(Date.now() - 59800),
      },
      {
        jobId: job2.id,
        level: 'INFO',
        message: 'Account ledger updated successfully',
        timestamp: new Date(Date.now() - 59100),
      },
    ],
  });

  console.log('[Seed] Database seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error('[Seed Error]:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

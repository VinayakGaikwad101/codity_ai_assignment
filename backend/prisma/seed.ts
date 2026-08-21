import { PrismaClient, UserRole, RetryStrategy, JobHandlerType, JobType, JobStatus } from '@prisma/client';
import bcrypt from 'bcrypt';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Clean existing data in reverse dependency order
  await prisma.jobLog.deleteMany();
  await prisma.jobExecution.deleteMany();
  await prisma.deadLetterQueueEntry.deleteMany();
  await prisma.jobDependency.deleteMany();
  await prisma.job.deleteMany();
  await prisma.scheduledJob.deleteMany();
  await prisma.workerHeartbeat.deleteMany();
  await prisma.worker.deleteMany();
  await prisma.queue.deleteMany();
  await prisma.retryPolicy.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.project.deleteMany();
  await prisma.organization.deleteMany();

  // 1. Create Organization
  const org = await prisma.organization.create({
    data: {
      name: 'Acme Cloud Platform',
      slug: 'acme-cloud',
    },
  });
  console.log(`✅ Organization created: ${org.name} (${org.id})`);

  // 2. Create Users (RBAC)
  const saltRounds = 10;
  const adminPasswordHash = await bcrypt.hash('Admin@12345', saltRounds);
  const operatorPasswordHash = await bcrypt.hash('Operator@12345', saltRounds);
  const viewerPasswordHash = await bcrypt.hash('Viewer@12345', saltRounds);

  const adminUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Vinayak Gaikwad (Admin)',
      email: 'admin@acme.com',
      passwordHash: adminPasswordHash,
      role: UserRole.ADMIN,
    },
  });

  const operatorUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Dev Ops Engineer',
      email: 'operator@acme.com',
      passwordHash: operatorPasswordHash,
      role: UserRole.OPERATOR,
    },
  });

  const viewerUser = await prisma.user.create({
    data: {
      organizationId: org.id,
      name: 'Auditor Viewer',
      email: 'viewer@acme.com',
      passwordHash: viewerPasswordHash,
      role: UserRole.VIEWER,
    },
  });
  console.log('✅ Users created with roles ADMIN, OPERATOR, VIEWER');

  // 3. Create Project
  const project = await prisma.project.create({
    data: {
      organizationId: org.id,
      name: 'Distributed Platform Core',
      slug: 'platform-core',
      description: 'Production distributed background scheduler environment',
    },
  });
  console.log(`✅ Project created: ${project.name} (${project.id})`);

  // 4. Create API Key for programmatic access
  const rawApiKey = 'djs_live_9a8b7c6d5e4f3a2b1c0d9e8f7a6b5c4d';
  const hashedApiKey = crypto.createHash('sha256').update(rawApiKey).digest('hex');

  await prisma.apiKey.create({
    data: {
      projectId: project.id,
      name: 'Production Ingest Key',
      keyPrefix: 'djs_live_9a8b',
      hashedKey: hashedApiKey,
    },
  });
  console.log(`✅ API Key created: ${rawApiKey}`);

  // 5. Create Retry Policies
  const expRetryPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: project.id,
      name: 'Standard Exponential Backoff',
      strategy: RetryStrategy.EXPONENTIAL,
      maxRetries: 3,
      baseDelayMs: 2000,
      maxDelayMs: 60000,
      jitter: true,
    },
  });

  const linearRetryPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: project.id,
      name: 'Aggressive Linear Backoff',
      strategy: RetryStrategy.LINEAR,
      maxRetries: 5,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      jitter: true,
    },
  });

  const fixedRetryPolicy = await prisma.retryPolicy.create({
    data: {
      projectId: project.id,
      name: 'Fixed 5-Second Interval',
      strategy: RetryStrategy.FIXED,
      maxRetries: 2,
      baseDelayMs: 5000,
      maxDelayMs: 5000,
      jitter: false,
    },
  });
  console.log('✅ Retry Policies created (Exponential, Linear, Fixed)');

  // 6. Create Queues
  const emailQueue = await prisma.queue.create({
    data: {
      projectId: project.id,
      name: 'high-priority-emails',
      description: 'Customer notification and transactional email dispatch',
      priority: 90,
      concurrencyLimit: 10,
      rateLimitPerMin: 120,
      isPaused: false,
      retryPolicyId: expRetryPolicy.id,
    },
  });

  const defaultQueue = await prisma.queue.create({
    data: {
      projectId: project.id,
      name: 'default-processing',
      description: 'General background data processing and webhook delivery',
      priority: 50,
      concurrencyLimit: 5,
      rateLimitPerMin: 60,
      isPaused: false,
      retryPolicyId: expRetryPolicy.id,
    },
  });

  const reportsQueue = await prisma.queue.create({
    data: {
      projectId: project.id,
      name: 'heavy-analytics-reports',
      description: 'Resource intensive data aggregation and PDF report generation',
      priority: 20,
      concurrencyLimit: 2,
      rateLimitPerMin: 10,
      isPaused: false,
      retryPolicyId: linearRetryPolicy.id,
    },
  });
  console.log('✅ Queues created: high-priority-emails, default-processing, heavy-analytics-reports');

  // 7. Create Recurring Scheduled Jobs (Cron)
  const cronJob1 = await prisma.scheduledJob.create({
    data: {
      projectId: project.id,
      queueId: defaultQueue.id,
      name: 'Hourly Database Health Check',
      handlerType: JobHandlerType.CUSTOM_COMPUTE,
      cronExpression: '0 * * * *',
      timezone: 'UTC',
      payload: { checkType: 'full_integrity', notifyOnFailure: true },
      priority: 60,
      timeoutMs: 30000,
      maxRetries: 2,
      retryPolicyId: fixedRetryPolicy.id,
      isActive: true,
      nextRunAt: new Date(Date.now() + 60 * 60 * 1000),
    },
  });

  const cronJob2 = await prisma.scheduledJob.create({
    data: {
      projectId: project.id,
      queueId: reportsQueue.id,
      name: 'Nightly Aggregation Summary',
      handlerType: JobHandlerType.SAMPLE_REPORT,
      cronExpression: '0 0 * * *',
      timezone: 'UTC',
      payload: { period: 'daily', format: 'pdf' },
      priority: 30,
      timeoutMs: 120000,
      maxRetries: 3,
      retryPolicyId: expRetryPolicy.id,
      isActive: true,
      nextRunAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
  });
  console.log('✅ Scheduled Jobs created (Hourly Health Check, Nightly Summary)');

  // 8. Create Initial Seed Jobs (Queued & Scheduled)
  await prisma.job.create({
    data: {
      projectId: project.id,
      queueId: emailQueue.id,
      name: 'Welcome Email - user_101',
      handlerType: JobHandlerType.SAMPLE_EMAIL,
      jobType: JobType.IMMEDIATE,
      status: JobStatus.QUEUED,
      priority: 90,
      payload: { recipient: 'john.doe@example.com', template: 'welcome_v1' },
      runAt: new Date(),
      timeoutMs: 15000,
      maxRetries: 3,
      retryPolicyId: expRetryPolicy.id,
    },
  });

  await prisma.job.create({
    data: {
      projectId: project.id,
      queueId: defaultQueue.id,
      name: 'Sync Stripe Webhook Event evt_9981',
      handlerType: JobHandlerType.HTTP_WEBHOOK,
      jobType: JobType.IMMEDIATE,
      status: JobStatus.QUEUED,
      priority: 50,
      payload: { eventId: 'evt_9981', endpoint: 'https://api.acme.com/webhooks/stripe' },
      runAt: new Date(),
      timeoutMs: 30000,
      maxRetries: 3,
      retryPolicyId: expRetryPolicy.id,
    },
  });

  console.log('🚀 Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

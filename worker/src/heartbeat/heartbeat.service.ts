import os from 'os';
import { prisma } from '../lib/prisma.js';
import { WorkerStatus } from '@scheduler/shared';

export class HeartbeatService {
  private workerDbId: string | null = null;
  private intervalTimer: NodeJS.Timeout | null = null;

  async registerWorker(concurrency: number): Promise<string> {
    const hostname = os.hostname();
    const pid = process.pid;

    const worker = await prisma.worker.create({
      data: {
        hostname: `${hostname}-${pid}`,
        ipAddress: this.getIpAddress(),
        status: WorkerStatus.HEALTHY,
        concurrencyLimit: concurrency,
        activeJobsCount: 0,
        lastHeartbeatAt: new Date(),
      },
    });

    this.workerDbId = worker.id;
    return worker.id;
  }

  startHeartbeat(getActiveJobsCount: () => number, intervalMs = 5000) {
    if (!this.workerDbId) {
      throw new Error('Worker must be registered before starting heartbeats');
    }

    this.intervalTimer = setInterval(async () => {
      if (!this.workerDbId) return;

      try {
        const activeJobs = getActiveJobsCount();
        const memoryUsage = (1 - os.freemem() / os.totalmem()) * 100;
        const cpuUsage = Math.min(100, os.loadavg()[0] * 10);

        await prisma.$transaction([
          prisma.worker.update({
            where: { id: this.workerDbId },
            data: {
              status: WorkerStatus.HEALTHY,
              activeJobsCount: activeJobs,
              lastHeartbeatAt: new Date(),
            },
          }),
          prisma.workerHeartbeat.create({
            data: {
              workerId: this.workerDbId,
              cpuUsage: Math.round(cpuUsage * 10) / 10,
              memoryUsage: Math.round(memoryUsage * 10) / 10,
              activeJobs,
            },
          }),
        ]);
      } catch (err) {
        console.error('[Heartbeat Ping Failed]:', err);
      }
    }, intervalMs);
  }

  async setDraining(): Promise<void> {
    if (this.intervalTimer) clearInterval(this.intervalTimer);
    if (this.workerDbId) {
      await prisma.worker.update({
        where: { id: this.workerDbId },
        data: { status: WorkerStatus.DRAINING },
      });
    }
  }

  async setOffline(): Promise<void> {
    if (this.workerDbId) {
      await prisma.worker.update({
        where: { id: this.workerDbId },
        data: { status: WorkerStatus.OFFLINE, activeJobsCount: 0 },
      });
    }
  }

  private getIpAddress(): string {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === 'IPv4' && !iface.internal) {
          return iface.address;
        }
      }
    }
    return '127.0.0.1';
  }
}

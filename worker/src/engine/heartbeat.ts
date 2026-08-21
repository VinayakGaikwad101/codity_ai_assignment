import os from 'os';
import { prisma } from '../lib/prisma.js';
import { WorkerStatus } from '@scheduler/shared';

export class HeartbeatManager {
  private timer: NodeJS.Timeout | null = null;
  private workerDbId: string | null = null;

  constructor(
    private hostname: string,
    private concurrencyLimit: number,
    private intervalMs: number,
    private getActiveJobsCount: () => number
  ) {}

  async registerWorker(): Promise<string> {
    const worker = await prisma.worker.create({
      data: {
        hostname: this.hostname,
        concurrencyLimit: this.concurrencyLimit,
        activeJobsCount: 0,
        status: WorkerStatus.HEALTHY,
        ipAddress: this.getIpAddress(),
        version: '1.0.0',
        registeredAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });

    this.workerDbId = worker.id;
    return worker.id;
  }

  startHeartbeat(workerId: string): void {
    this.workerDbId = workerId;
    this.timer = setInterval(async () => {
      await this.sendHeartbeat();
    }, this.intervalMs);
  }

  async sendHeartbeat(): Promise<void> {
    if (!this.workerDbId) return;

    try {
      const activeJobs = this.getActiveJobsCount();
      const cpus = os.cpus();
      const cpuUsage = cpus.length > 0 ? (os.loadavg()[0] || 0) : 0;
      const memoryUsage = Math.round((1 - os.freemem() / os.totalmem()) * 100);

      await prisma.$transaction([
        prisma.worker.update({
          where: { id: this.workerDbId },
          data: {
            lastHeartbeatAt: new Date(),
            activeJobsCount: activeJobs,
            status: WorkerStatus.HEALTHY,
          },
        }),
        prisma.workerHeartbeat.create({
          data: {
            workerId: this.workerDbId,
            cpuUsage,
            memoryUsage,
            activeJobs,
          },
        }),
      ]);
    } catch (error) {
      console.error('[HeartbeatManager] Error sending heartbeat:', error);
    }
  }

  async stopHeartbeat(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }

    if (this.workerDbId) {
      try {
        await prisma.worker.update({
          where: { id: this.workerDbId },
          data: {
            status: WorkerStatus.DEAD,
            activeJobsCount: 0,
          },
        });
      } catch (error) {
        console.error('[HeartbeatManager] Error setting worker status to DEAD on shutdown:', error);
      }
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

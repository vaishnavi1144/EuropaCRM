import { prisma } from '../lib/prisma.js';

let running = false;

export async function runBenchSchedulerOnce() {
  if (running) return;
  running = true;
  try {
    const today = new Date().toISOString().slice(0, 10);
    await prisma.benchOffer.updateMany({
      where: { offerExpiryDate: { lt: today }, status: { in: ['Draft', 'Pending', 'Released'] } },
      data: { status: 'Expired' },
    });

    const due = await prisma.activity.findMany({
      where: {
        dueDate: { lte: today },
        status: { in: ['Pending', 'Scheduled'] },
        relatedType: { in: ['Bench Interview', 'Bench Offer', 'Bench Consultant', 'Placement'] },
      },
    });

    for (const item of due) {
      if (!item.ownerId) continue;
      const existing = await prisma.notification.findFirst({
        where: { userId: item.ownerId, type: 'BENCH_REMINDER', entityId: item.id },
      });
      if (existing) {
        await prisma.notification.update({
          where: { id: existing.id },
          data: { title: item.activity, message: item.description ?? item.activity, readAt: null },
        });
      } else {
        await prisma.notification.create({
          data: {
            userId: item.ownerId,
            type: 'BENCH_REMINDER',
            title: item.activity,
            message: item.description ?? item.activity,
            entityType: item.relatedType,
            entityId: item.id,
          },
        });
      }
    }
  } catch (error) {
    // A temporary PostgreSQL outage must never terminate the API process.
    console.error('[Bench Scheduler] Run skipped because the database is unavailable or the scheduler failed:', error);
  } finally {
    running = false;
  }
}

export function startBenchScheduler() {
  void runBenchSchedulerOnce().catch((error) => console.error('[Bench Scheduler] Initial run failed:', error));
  const timer = setInterval(() => {
    void runBenchSchedulerOnce().catch((error) => console.error('[Bench Scheduler] Scheduled run failed:', error));
  }, 60 * 60 * 1000);
  timer.unref();
}

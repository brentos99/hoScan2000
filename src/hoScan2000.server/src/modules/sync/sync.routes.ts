import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

const pushSyncSchema = z.object({
  deviceId: z.string().uuid(),
  items: z.array(
    z.object({
      action: z.enum(['SCAN', 'DELETE_SCAN', 'UPDATE_SCAN', 'COMPLETE_AREA']),
      idempotencyKey: z.string(),
      payload: z.any(),
    })
  ),
});

export const syncRoutes: FastifyPluginAsync = async (server) => {
  // Push sync items from device (outbox pattern)
  server.post('/push', async (request, reply) => {
    const parsed = pushSyncSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { deviceId, items } = parsed.data;

    const results = {
      processed: 0,
      skipped: 0,
      failed: 0,
      errors: [] as { idempotencyKey: string; error: string }[],
    };

    for (const item of items) {
      try {
        // Check if already processed (idempotency)
        const existing = await prisma.syncLog.findFirst({
          where: {
            deviceId,
            action: `SYNC_${item.action}_${item.idempotencyKey}`,
            status: 'SUCCESS',
          },
        });

        if (existing) {
          results.skipped++;
          continue;
        }

        // Process based on action type
        switch (item.action) {
          case 'SCAN': {
            const scanData = item.payload as {
              localId: string;
              stocktakeId: string;
              areaId: string;
              barcode: string;
              quantity: number;
              isValid: boolean;
              validationMessage?: string;
              scannedAt: string;
            };

            await prisma.scan.upsert({
              where: { localId: scanData.localId },
              create: {
                localId: scanData.localId,
                stocktakeId: scanData.stocktakeId,
                areaId: scanData.areaId,
                deviceId,
                barcode: scanData.barcode,
                quantity: scanData.quantity,
                isValid: scanData.isValid,
                validationMessage: scanData.validationMessage,
                scannedAt: new Date(scanData.scannedAt),
              },
              update: {
                quantity: scanData.quantity,
                isValid: scanData.isValid,
                validationMessage: scanData.validationMessage,
              },
            });
            break;
          }

          case 'DELETE_SCAN': {
            const { localId } = item.payload as { localId: string };
            await prisma.scan.deleteMany({ where: { localId } });
            break;
          }

          case 'UPDATE_SCAN': {
            const updateData = item.payload as {
              localId: string;
              quantity?: number;
            };
            await prisma.scan.updateMany({
              where: { localId: updateData.localId },
              data: { quantity: updateData.quantity },
            });
            break;
          }

          case 'COMPLETE_AREA': {
            const completeData = item.payload as {
              stocktakeId: string;
              areaId: string;
            };

            // Verify device has this area claimed
            const session = await prisma.deviceSession.findFirst({
              where: {
                deviceId,
                stocktakeId: completeData.stocktakeId,
                claimedAreaId: completeData.areaId,
              },
            });

            // Update area status and release from device
            await prisma.$transaction([
              prisma.stocktakeArea.update({
                where: { id: completeData.areaId },
                data: {
                  status: 'COMPLETED',
                  completedAt: new Date(),
                },
              }),
              // Release the area from the device session (if claimed)
              ...(session
                ? [
                    prisma.deviceSession.update({
                      where: { id: session.id },
                      data: { claimedAreaId: null },
                    }),
                  ]
                : []),
            ]);
            break;
          }
        }

        // Log success
        await prisma.syncLog.create({
          data: {
            deviceId,
            action: `SYNC_${item.action}_${item.idempotencyKey}`,
            recordCount: 1,
            status: 'SUCCESS',
            completedAt: new Date(),
          },
        });

        results.processed++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          idempotencyKey: item.idempotencyKey,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return { results };
  });

  // Get sync status for device
  server.get<{ Params: { deviceId: string } }>('/status/:deviceId', async (request) => {
    const { deviceId } = request.params;

    const device = await prisma.device.findUnique({
      where: { id: deviceId },
      select: { lastSeenAt: true },
    });

    const recentLogs = await prisma.syncLog.findMany({
      where: { deviceId },
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    const pendingScans = await prisma.scan.count({
      where: { deviceId },
    });

    return {
      lastSeenAt: device?.lastSeenAt,
      recentSyncs: recentLogs,
      totalScansOnServer: pendingScans,
    };
  });

  // Get changes since timestamp (for pull sync)
  server.get<{
    Querystring: { since: string; stocktakeId?: string };
  }>('/pull', async (request) => {
    const { since, stocktakeId } = request.query;
    const sinceDate = new Date(since);

    // Return stocktake and area status changes
    const stocktakes = await prisma.stocktake.findMany({
      where: {
        updatedAt: { gt: sinceDate },
        ...(stocktakeId && { id: stocktakeId }),
      },
      select: {
        id: true,
        status: true,
        updatedAt: true,
      },
    });

    const areas = await prisma.stocktakeArea.findMany({
      where: {
        updatedAt: { gt: sinceDate },
        ...(stocktakeId && { stocktakeId }),
      },
      select: {
        id: true,
        stocktakeId: true,
        status: true,
        updatedAt: true,
      },
    });

    return {
      stocktakes,
      areas,
      serverTime: new Date().toISOString(),
    };
  });
};

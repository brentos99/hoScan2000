import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

const uploadScansSchema = z.object({
  deviceId: z.string().uuid(),
  scans: z.array(
    z.object({
      localId: z.string(),
      areaId: z.string().uuid(),
      barcode: z.string().min(1),
      quantity: z.number().int().positive().default(1),
      isValid: z.boolean().default(true),
      validationMessage: z.string().optional(),
      scannedAt: z.string().datetime(),
    })
  ),
});

export const scanRoutes: FastifyPluginAsync = async (server) => {
  // Upload scans (batch)
  server.post<{ Params: { id: string } }>('/:id/scans', async (request, reply) => {
    const { id } = request.params;

    const parsed = uploadScansSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { deviceId, scans } = parsed.data;

    // Verify stocktake is active
    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.status !== 'ACTIVE' && stocktake.status !== 'PAUSED') {
      return reply.status(400).send({ error: 'Stocktake is not accepting scans' });
    }

    // Process scans with deduplication (upsert by localId)
    const results = {
      created: 0,
      updated: 0,
      failed: 0,
      errors: [] as { localId: string; error: string }[],
    };

    for (const scan of scans) {
      try {
        await prisma.scan.upsert({
          where: { localId: scan.localId },
          create: {
            localId: scan.localId,
            stocktakeId: id,
            areaId: scan.areaId,
            deviceId,
            barcode: scan.barcode,
            quantity: scan.quantity,
            isValid: scan.isValid,
            validationMessage: scan.validationMessage,
            scannedAt: new Date(scan.scannedAt),
          },
          update: {
            quantity: scan.quantity,
            isValid: scan.isValid,
            validationMessage: scan.validationMessage,
          },
        });
        results.created++;
      } catch (error) {
        results.failed++;
        results.errors.push({
          localId: scan.localId,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    // Update device session scan count and activity
    await prisma.deviceSession.updateMany({
      where: { stocktakeId: id, deviceId },
      data: {
        lastActivityAt: new Date(),
        scansCount: { increment: results.created },
      },
    });

    // Log sync
    await prisma.syncLog.create({
      data: {
        deviceId,
        stocktakeId: id,
        action: 'UPLOAD_SCANS',
        recordCount: scans.length,
        status: results.failed > 0 ? 'PARTIAL' : 'SUCCESS',
        errorMessage: results.errors.length > 0 ? JSON.stringify(results.errors) : null,
        completedAt: new Date(),
      },
    });

    return { results };
  });

  // Get scans for stocktake (paginated)
  server.get<{
    Params: { id: string };
    Querystring: { areaId?: string; deviceId?: string; limit?: number; offset?: number };
  }>('/:id/scans', async (request) => {
    const { id } = request.params;
    const { areaId, deviceId, limit = 100, offset = 0 } = request.query;

    const where = {
      stocktakeId: id,
      ...(areaId && { areaId }),
      ...(deviceId && { deviceId }),
    };

    const [scans, total] = await Promise.all([
      prisma.scan.findMany({
        where,
        orderBy: { scannedAt: 'desc' },
        take: limit,
        skip: offset,
        include: {
          area: { select: { id: true, name: true, code: true } },
          device: { select: { id: true, name: true } },
        },
      }),
      prisma.scan.count({ where }),
    ]);

    return { scans, total, limit, offset };
  });

  // Get scan summary by area
  server.get<{ Params: { id: string } }>('/:id/scans/summary', async (request) => {
    const { id } = request.params;

    const areas = await prisma.stocktakeArea.findMany({
      where: { stocktakeId: id },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        status: true,
        _count: { select: { scans: true } },
      },
    });

    const totalScans = await prisma.scan.count({ where: { stocktakeId: id } });
    const uniqueBarcodes = await prisma.scan.groupBy({
      by: ['barcode'],
      where: { stocktakeId: id },
    });
    const invalidScans = await prisma.scan.count({
      where: { stocktakeId: id, isValid: false },
    });

    return {
      totalScans,
      uniqueBarcodes: uniqueBarcodes.length,
      invalidScans,
      byArea: areas.map((area) => ({
        id: area.id,
        name: area.name,
        code: area.code,
        status: area.status,
        scanCount: area._count.scans,
      })),
    };
  });

  // Delete scan
  server.delete<{ Params: { id: string; scanId: string } }>('/:id/scans/:scanId', async (request, reply) => {
    const { id, scanId } = request.params;

    const scan = await prisma.scan.findUnique({ where: { id: scanId } });
    if (!scan || scan.stocktakeId !== id) {
      return reply.status(404).send({ error: 'Scan not found' });
    }

    await prisma.scan.delete({ where: { id: scanId } });
    return reply.status(204).send();
  });

  // Export scans as CSV
  server.get<{ Params: { id: string } }>('/:id/export/csv', async (request, reply) => {
    const { id } = request.params;

    const scans = await prisma.scan.findMany({
      where: { stocktakeId: id },
      orderBy: [{ areaId: 'asc' }, { scannedAt: 'asc' }],
      include: {
        area: { select: { code: true, name: true } },
        device: { select: { name: true } },
      },
    });

    // Build CSV
    const headers = ['Barcode', 'Quantity', 'Area Code', 'Area Name', 'Device', 'Valid', 'Scanned At'];
    const rows = scans.map((s) => [
      s.barcode,
      s.quantity.toString(),
      s.area.code,
      s.area.name,
      s.device.name,
      s.isValid ? 'Yes' : 'No',
      s.scannedAt.toISOString(),
    ]);

    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

    reply.header('Content-Type', 'text/csv');
    reply.header('Content-Disposition', `attachment; filename="stocktake-${id}.csv"`);
    return reply.send(csv);
  });
};

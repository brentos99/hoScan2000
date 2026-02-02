import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

const createAreaSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const areaRoutes: FastifyPluginAsync = async (server) => {
  // List areas for stocktake
  server.get<{ Params: { id: string } }>('/:id/areas', async (request, reply) => {
    const { id } = request.params;

    const areas = await prisma.stocktakeArea.findMany({
      where: { stocktakeId: id },
      orderBy: { sortOrder: 'asc' },
      include: {
        claimedBy: {
          include: {
            device: { select: { id: true, name: true } },
          },
        },
        _count: { select: { scans: true } },
      },
    });

    return { areas };
  });

  // Create area
  server.post<{ Params: { id: string } }>('/:id/areas', async (request, reply) => {
    const { id } = request.params;

    const parsed = createAreaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Verify stocktake exists and is editable
    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.status === 'COMPLETED' || stocktake.status === 'CANCELLED') {
      return reply.status(400).send({ error: 'Cannot add areas to completed stocktake' });
    }

    const area = await prisma.stocktakeArea.create({
      data: {
        stocktakeId: id,
        ...parsed.data,
      },
    });

    return reply.status(201).send({ area });
  });

  // Bulk create areas
  server.post<{ Params: { id: string } }>('/:id/areas/bulk', async (request, reply) => {
    const { id } = request.params;

    const schema = z.object({
      areas: z.array(createAreaSchema),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    const areas = await prisma.stocktakeArea.createMany({
      data: parsed.data.areas.map((area, index) => ({
        stocktakeId: id,
        ...area,
        sortOrder: area.sortOrder ?? index,
      })),
    });

    return reply.status(201).send({ count: areas.count });
  });

  // Update area
  server.patch<{ Params: { id: string; areaId: string } }>('/:id/areas/:areaId', async (request, reply) => {
    const { id, areaId } = request.params;

    const schema = z.object({
      name: z.string().min(1).optional(),
      code: z.string().min(1).max(10).optional(),
      description: z.string().optional(),
      sortOrder: z.number().int().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const area = await prisma.stocktakeArea.update({
      where: { id: areaId, stocktakeId: id },
      data: parsed.data,
    });

    return { area };
  });

  // Claim area
  server.post<{ Params: { id: string; areaId: string } }>('/:id/areas/:areaId/claim', async (request, reply) => {
    const { id, areaId } = request.params;

    const schema = z.object({ deviceId: z.string().uuid() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    // Check if area is already claimed
    const area = await prisma.stocktakeArea.findUnique({
      where: { id: areaId },
      include: { claimedBy: true },
    });

    if (!area) {
      return reply.status(404).send({ error: 'Area not found' });
    }

    if (area.claimedBy && area.claimedBy.deviceId !== parsed.data.deviceId) {
      return reply.status(409).send({ error: 'Area already claimed by another device' });
    }

    // Find device session
    const session = await prisma.deviceSession.findUnique({
      where: {
        stocktakeId_deviceId: {
          stocktakeId: id,
          deviceId: parsed.data.deviceId,
        },
      },
    });

    if (!session) {
      return reply.status(400).send({ error: 'Device has not joined this stocktake' });
    }

    // Release any previously claimed area and claim new one
    await prisma.$transaction([
      prisma.deviceSession.update({
        where: { id: session.id },
        data: { claimedAreaId: areaId },
      }),
      prisma.stocktakeArea.update({
        where: { id: areaId },
        data: {
          status: 'IN_PROGRESS',
          startedAt: area.startedAt ?? new Date(),
        },
      }),
    ]);

    const updatedArea = await prisma.stocktakeArea.findUnique({
      where: { id: areaId },
      include: {
        claimedBy: {
          include: { device: { select: { id: true, name: true } } },
        },
      },
    });

    return { area: updatedArea };
  });

  // Release area
  server.post<{ Params: { id: string; areaId: string } }>('/:id/areas/:areaId/release', async (request, reply) => {
    const { id, areaId } = request.params;

    const schema = z.object({ deviceId: z.string().uuid() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const session = await prisma.deviceSession.findUnique({
      where: {
        stocktakeId_deviceId: {
          stocktakeId: id,
          deviceId: parsed.data.deviceId,
        },
      },
    });

    if (!session || session.claimedAreaId !== areaId) {
      return reply.status(400).send({ error: 'Device does not have this area claimed' });
    }

    await prisma.deviceSession.update({
      where: { id: session.id },
      data: { claimedAreaId: null },
    });

    return { message: 'Area released' };
  });

  // Mark area complete
  server.post<{ Params: { id: string; areaId: string } }>('/:id/areas/:areaId/complete', async (request, reply) => {
    const { id, areaId } = request.params;

    const schema = z.object({ deviceId: z.string().uuid() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    // Verify device has this area claimed
    const session = await prisma.deviceSession.findUnique({
      where: {
        stocktakeId_deviceId: {
          stocktakeId: id,
          deviceId: parsed.data.deviceId,
        },
      },
    });

    if (!session || session.claimedAreaId !== areaId) {
      return reply.status(400).send({ error: 'Device does not have this area claimed' });
    }

    // Mark area complete and release
    await prisma.$transaction([
      prisma.stocktakeArea.update({
        where: { id: areaId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      }),
      prisma.deviceSession.update({
        where: { id: session.id },
        data: { claimedAreaId: null },
      }),
    ]);

    return { message: 'Area marked complete' };
  });

  // Delete area (only if no scans)
  server.delete<{ Params: { id: string; areaId: string } }>('/:id/areas/:areaId', async (request, reply) => {
    const { id, areaId } = request.params;

    const scansCount = await prisma.scan.count({ where: { areaId } });
    if (scansCount > 0) {
      return reply.status(400).send({ error: 'Cannot delete area with scans' });
    }

    await prisma.stocktakeArea.delete({ where: { id: areaId, stocktakeId: id } });
    return reply.status(204).send();
  });
};

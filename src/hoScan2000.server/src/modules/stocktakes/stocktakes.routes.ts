import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';
import { createHash } from 'crypto';

const createStocktakeSchema = z.object({
  storeId: z.string().uuid(),
  name: z.string().min(1),
  pin: z.string().min(4).max(6).regex(/^\d+$/, 'PIN must be numeric'),
  scheduledDate: z.string().datetime().optional(),
  notes: z.string().optional(),
  areaIds: z.array(z.string().uuid()).optional(), // Store area IDs to include
});

const joinStocktakeSchema = z.object({
  pin: z.string().min(4).max(6),
  deviceId: z.string().uuid(),
});

export const stocktakeRoutes: FastifyPluginAsync = async (server) => {
  // List stocktakes (optionally filter by status or store)
  server.get<{ Querystring: { status?: string; storeId?: string } }>('/', async (request) => {
    const { status, storeId } = request.query;

    const stocktakes = await prisma.stocktake.findMany({
      where: {
        ...(status && { status: status as any }),
        ...(storeId && { storeId }),
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
        _count: { select: { areas: true, scans: true, sessions: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return { stocktakes };
  });

  // Get single stocktake with areas
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const stocktake = await prisma.stocktake.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, code: true } },
        areas: {
          orderBy: { sortOrder: 'asc' },
          include: {
            claimedBy: {
              include: {
                device: { select: { id: true, name: true } },
              },
            },
            _count: { select: { scans: true } },
          },
        },
        sessions: {
          where: { status: 'ACTIVE' },
          include: {
            device: { select: { id: true, name: true } },
          },
        },
        _count: { select: { scans: true } },
      },
    });

    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    // Don't expose PIN
    const { pin: _, ...safeStocktake } = stocktake;
    return { stocktake: safeStocktake };
  });

  // Create stocktake
  server.post('/', async (request, reply) => {
    const parsed = createStocktakeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { areaIds, ...stocktakeData } = parsed.data;

    // Verify store exists
    const store = await prisma.store.findUnique({ where: { id: stocktakeData.storeId } });
    if (!store) {
      return reply.status(400).send({ error: 'Store not found' });
    }

    // Get store areas to copy (if areaIds provided)
    let storeAreas: { name: string; code: string; description: string | null; sortOrder: number }[] = [];
    if (areaIds && areaIds.length > 0) {
      storeAreas = await prisma.storeArea.findMany({
        where: {
          id: { in: areaIds },
          storeId: stocktakeData.storeId,
          isActive: true,
        },
        orderBy: { sortOrder: 'asc' },
        select: { name: true, code: true, description: true, sortOrder: true },
      });
    }

    // Compute current master file version
    const masterItems = await prisma.barcodeMaster.findMany({
      where: { storeId: stocktakeData.storeId, isActive: true },
      select: { barcode: true },
    });
    const masterVersion = createHash('sha256')
      .update(masterItems.map((i) => i.barcode).sort().join(','))
      .digest('hex')
      .slice(0, 16);

    // Create stocktake with areas in a transaction
    const stocktake = await prisma.stocktake.create({
      data: {
        ...stocktakeData,
        scheduledDate: stocktakeData.scheduledDate ? new Date(stocktakeData.scheduledDate) : null,
        masterFileVersion: masterVersion,
        // Create stocktake areas from store area templates
        areas: storeAreas.length > 0
          ? {
              create: storeAreas.map((area, index) => ({
                name: area.name,
                code: area.code,
                description: area.description,
                sortOrder: area.sortOrder || index,
              })),
            }
          : undefined,
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
        areas: { orderBy: { sortOrder: 'asc' } },
        _count: { select: { areas: true } },
      },
    });

    return reply.status(201).send({ stocktake });
  });

  // Update stocktake
  server.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const schema = z.object({
      name: z.string().min(1).optional(),
      pin: z.string().min(4).max(6).regex(/^\d+$/).optional(),
      scheduledDate: z.string().datetime().optional(),
      notes: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const stocktake = await prisma.stocktake.update({
      where: { id },
      data: {
        ...parsed.data,
        scheduledDate: parsed.data.scheduledDate ? new Date(parsed.data.scheduledDate) : undefined,
      },
    });

    return { stocktake };
  });

  // Start stocktake (change status to ACTIVE)
  server.post<{ Params: { id: string } }>('/:id/start', async (request, reply) => {
    const { id } = request.params;

    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.status !== 'DRAFT' && stocktake.status !== 'PAUSED') {
      return reply.status(400).send({ error: 'Stocktake cannot be started from current status' });
    }

    const updated = await prisma.stocktake.update({
      where: { id },
      data: {
        status: 'ACTIVE',
        startedAt: stocktake.startedAt ?? new Date(),
      },
    });

    return { stocktake: updated };
  });

  // Pause stocktake
  server.post<{ Params: { id: string } }>('/:id/pause', async (request, reply) => {
    const { id } = request.params;

    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.status !== 'ACTIVE') {
      return reply.status(400).send({ error: 'Only active stocktakes can be paused' });
    }

    const updated = await prisma.stocktake.update({
      where: { id },
      data: { status: 'PAUSED' },
    });

    return { stocktake: updated };
  });

  // Complete stocktake
  server.post<{ Params: { id: string } }>('/:id/complete', async (request, reply) => {
    const { id } = request.params;

    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.status !== 'ACTIVE' && stocktake.status !== 'PAUSED') {
      return reply.status(400).send({ error: 'Stocktake cannot be completed from current status' });
    }

    const updated = await prisma.stocktake.update({
      where: { id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
      },
    });

    // Disconnect all sessions
    await prisma.deviceSession.updateMany({
      where: { stocktakeId: id, status: 'ACTIVE' },
      data: { status: 'COMPLETED', disconnectedAt: new Date() },
    });

    return { stocktake: updated };
  });

  // Join stocktake with PIN
  server.post<{ Params: { id: string } }>('/:id/join', async (request, reply) => {
    const { id } = request.params;

    const parsed = joinStocktakeSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const stocktake = await prisma.stocktake.findUnique({
      where: { id },
      include: {
        store: { select: { id: true, name: true, code: true } },
        areas: { orderBy: { sortOrder: 'asc' } },
      },
    });

    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.pin !== parsed.data.pin) {
      return reply.status(401).send({ error: 'Invalid PIN' });
    }

    if (stocktake.status !== 'ACTIVE') {
      return reply.status(400).send({ error: 'Stocktake is not active' });
    }

    // Create or update session
    const session = await prisma.deviceSession.upsert({
      where: {
        stocktakeId_deviceId: {
          stocktakeId: id,
          deviceId: parsed.data.deviceId,
        },
      },
      create: {
        stocktakeId: id,
        deviceId: parsed.data.deviceId,
        status: 'ACTIVE',
      },
      update: {
        status: 'ACTIVE',
        joinedAt: new Date(),
        lastActivityAt: new Date(),
        disconnectedAt: null,
      },
      include: {
        device: { select: { id: true, name: true } },
      },
    });

    // Return stocktake without PIN
    const { pin: _, ...safeStocktake } = stocktake;

    return {
      stocktake: safeStocktake,
      session,
      masterFileVersion: stocktake.masterFileVersion,
    };
  });

  // Leave stocktake
  server.post<{ Params: { id: string } }>('/:id/leave', async (request, reply) => {
    const { id } = request.params;

    const schema = z.object({ deviceId: z.string().uuid() });
    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    // Release any claimed area and update session
    await prisma.deviceSession.updateMany({
      where: {
        stocktakeId: id,
        deviceId: parsed.data.deviceId,
      },
      data: {
        status: 'DISCONNECTED',
        disconnectedAt: new Date(),
        claimedAreaId: null,
      },
    });

    return { message: 'Left stocktake' };
  });

  // Delete stocktake (only if DRAFT)
  server.delete<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const stocktake = await prisma.stocktake.findUnique({ where: { id } });
    if (!stocktake) {
      return reply.status(404).send({ error: 'Stocktake not found' });
    }

    if (stocktake.status !== 'DRAFT') {
      return reply.status(400).send({ error: 'Only draft stocktakes can be deleted' });
    }

    await prisma.stocktake.delete({ where: { id } });
    return reply.status(204).send();
  });
};

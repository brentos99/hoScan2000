import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

const createStoreSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  address: z.string().optional(),
  timezone: z.string().default('UTC'),
});

const createStoreAreaSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  description: z.string().optional(),
  sortOrder: z.number().int().default(0),
});

export const storeRoutes: FastifyPluginAsync = async (server) => {
  // List all stores
  server.get('/', async () => {
    const stores = await prisma.store.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        code: true,
        address: true,
        timezone: true,
        createdAt: true,
      },
    });
    return { stores };
  });

  // Get single store
  server.get<{ Params: { storeId: string } }>('/:storeId', async (request, reply) => {
    const { storeId } = request.params;
    const store = await prisma.store.findUnique({
      where: { id: storeId },
      include: {
        areas: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        _count: {
          select: {
            barcodeMaster: true,
            stocktakes: true,
            areas: true,
          },
        },
      },
    });

    if (!store) {
      return reply.status(404).send({ error: 'Store not found' });
    }

    return { store };
  });

  // Create store
  server.post('/', async (request, reply) => {
    const parsed = createStoreSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const store = await prisma.store.create({
      data: parsed.data,
    });

    return reply.status(201).send({ store });
  });

  // Update store
  server.patch<{ Params: { storeId: string } }>('/:storeId', async (request, reply) => {
    const { storeId } = request.params;
    const parsed = createStoreSchema.partial().safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const store = await prisma.store.update({
      where: { id: storeId },
      data: parsed.data,
    });

    return { store };
  });

  // Delete store
  server.delete<{ Params: { storeId: string } }>('/:storeId', async (request, reply) => {
    const { storeId } = request.params;
    await prisma.store.delete({ where: { id: storeId } });
    return reply.status(204).send();
  });

  // ============ Store Areas ============

  // List store areas
  server.get<{ Params: { storeId: string } }>('/:storeId/areas', async (request) => {
    const { storeId } = request.params;
    const areas = await prisma.storeArea.findMany({
      where: { storeId },
      orderBy: { sortOrder: 'asc' },
    });
    return { areas };
  });

  // Create store area
  server.post<{ Params: { storeId: string } }>('/:storeId/areas', async (request, reply) => {
    const { storeId } = request.params;
    const parsed = createStoreAreaSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    // Get next sort order
    const maxSort = await prisma.storeArea.findFirst({
      where: { storeId },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });

    const area = await prisma.storeArea.create({
      data: {
        ...parsed.data,
        storeId,
        sortOrder: parsed.data.sortOrder || (maxSort?.sortOrder ?? 0) + 1,
      },
    });

    return reply.status(201).send({ area });
  });

  // Update store area
  server.patch<{ Params: { storeId: string; areaId: string } }>(
    '/:storeId/areas/:areaId',
    async (request, reply) => {
      const { areaId } = request.params;
      const parsed = createStoreAreaSchema.partial().safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
      }

      const area = await prisma.storeArea.update({
        where: { id: areaId },
        data: parsed.data,
      });

      return { area };
    }
  );

  // Delete store area
  server.delete<{ Params: { storeId: string; areaId: string } }>(
    '/:storeId/areas/:areaId',
    async (request, reply) => {
      const { areaId } = request.params;
      await prisma.storeArea.delete({ where: { id: areaId } });
      return reply.status(204).send();
    }
  );
};

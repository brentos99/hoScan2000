import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

const createStoreSchema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(10),
  address: z.string().optional(),
  timezone: z.string().default('UTC'),
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
        _count: {
          select: {
            barcodeMaster: true,
            stocktakes: true,
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
};

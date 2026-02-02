import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';
import { createHash } from 'crypto';

const uploadMasterSchema = z.object({
  items: z.array(
    z.object({
      barcode: z.string().min(1),
      sku: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
    })
  ),
});

function computeMasterVersion(items: { barcode: string }[]): string {
  const barcodes = items.map((i) => i.barcode).sort().join(',');
  return createHash('sha256').update(barcodes).digest('hex').slice(0, 16);
}

export const masterRoutes: FastifyPluginAsync = async (server) => {
  // Get master file metadata (HEAD request for version check)
  server.head<{ Params: { storeId: string } }>('/:storeId/master', async (request, reply) => {
    const { storeId } = request.params;

    const items = await prisma.barcodeMaster.findMany({
      where: { storeId, isActive: true },
      select: { barcode: true },
    });

    const version = computeMasterVersion(items);
    const count = items.length;

    reply.header('X-Master-Version', version);
    reply.header('X-Master-Count', count.toString());
    return reply.status(200).send();
  });

  // Get master file info
  server.get<{ Params: { storeId: string } }>('/:storeId/master', async (request, reply) => {
    const { storeId } = request.params;

    const items = await prisma.barcodeMaster.findMany({
      where: { storeId, isActive: true },
      select: { barcode: true },
    });

    const version = computeMasterVersion(items);

    return {
      storeId,
      version,
      count: items.length,
      downloadUrl: `/api/v1/stores/${storeId}/master/download`,
    };
  });

  // Download full master file
  server.get<{ Params: { storeId: string } }>('/:storeId/master/download', async (request, reply) => {
    const { storeId } = request.params;

    const items = await prisma.barcodeMaster.findMany({
      where: { storeId, isActive: true },
      select: {
        barcode: true,
        sku: true,
        description: true,
        category: true,
      },
      orderBy: { barcode: 'asc' },
    });

    const version = computeMasterVersion(items);

    return {
      version,
      count: items.length,
      items,
    };
  });

  // Upload/replace master file
  server.post<{ Params: { storeId: string } }>('/:storeId/master', async (request, reply) => {
    const { storeId } = request.params;

    // Verify store exists
    const store = await prisma.store.findUnique({ where: { id: storeId } });
    if (!store) {
      return reply.status(404).send({ error: 'Store not found' });
    }

    const parsed = uploadMasterSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const { items } = parsed.data;

    // Replace all master entries for this store
    await prisma.$transaction(async (tx) => {
      // Mark all existing as inactive
      await tx.barcodeMaster.updateMany({
        where: { storeId },
        data: { isActive: false },
      });

      // Upsert new items
      for (const item of items) {
        await tx.barcodeMaster.upsert({
          where: { storeId_barcode: { storeId, barcode: item.barcode } },
          create: {
            storeId,
            barcode: item.barcode,
            sku: item.sku,
            description: item.description,
            category: item.category,
            isActive: true,
          },
          update: {
            sku: item.sku,
            description: item.description,
            category: item.category,
            isActive: true,
          },
        });
      }
    });

    const version = computeMasterVersion(items);

    return reply.status(201).send({
      message: 'Master file uploaded',
      version,
      count: items.length,
    });
  });

  // Add single barcode to master
  server.post<{ Params: { storeId: string } }>('/:storeId/master/items', async (request, reply) => {
    const { storeId } = request.params;

    const schema = z.object({
      barcode: z.string().min(1),
      sku: z.string().min(1),
      description: z.string().optional(),
      category: z.string().optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const item = await prisma.barcodeMaster.upsert({
      where: { storeId_barcode: { storeId, barcode: parsed.data.barcode } },
      create: {
        storeId,
        ...parsed.data,
        isActive: true,
      },
      update: {
        ...parsed.data,
        isActive: true,
      },
    });

    return reply.status(201).send({ item });
  });
};

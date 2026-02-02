import { FastifyPluginAsync } from 'fastify';
import { prisma } from '../../config/database.js';
import { z } from 'zod';

const registerDeviceSchema = z.object({
  deviceIdentifier: z.string().min(1),
  name: z.string().min(1),
  platform: z.enum(['android', 'ios']).default('android'),
});

export const deviceRoutes: FastifyPluginAsync = async (server) => {
  // Register device
  server.post('/register', async (request, reply) => {
    const parsed = registerDeviceSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input', details: parsed.error.flatten() });
    }

    const device = await prisma.device.upsert({
      where: { deviceIdentifier: parsed.data.deviceIdentifier },
      create: {
        deviceIdentifier: parsed.data.deviceIdentifier,
        name: parsed.data.name,
        platform: parsed.data.platform,
        lastSeenAt: new Date(),
      },
      update: {
        name: parsed.data.name,
        platform: parsed.data.platform,
        lastSeenAt: new Date(),
      },
    });

    return reply.status(201).send({ device });
  });

  // Get device by ID
  server.get<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        sessions: {
          orderBy: { joinedAt: 'desc' },
          take: 10,
          include: {
            stocktake: { select: { id: true, name: true, status: true } },
          },
        },
        _count: { select: { scans: true } },
      },
    });

    if (!device) {
      return reply.status(404).send({ error: 'Device not found' });
    }

    return { device };
  });

  // Update device
  server.patch<{ Params: { id: string } }>('/:id', async (request, reply) => {
    const { id } = request.params;

    const schema = z.object({
      name: z.string().min(1).optional(),
    });

    const parsed = schema.safeParse(request.body);
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Invalid input' });
    }

    const device = await prisma.device.update({
      where: { id },
      data: {
        ...parsed.data,
        lastSeenAt: new Date(),
      },
    });

    return { device };
  });

  // Heartbeat - update last seen
  server.post<{ Params: { id: string } }>('/:id/heartbeat', async (request) => {
    const { id } = request.params;

    await prisma.device.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });

    return { status: 'ok' };
  });

  // List all devices
  server.get('/', async (request) => {
    const devices = await prisma.device.findMany({
      orderBy: { lastSeenAt: 'desc' },
      select: {
        id: true,
        deviceIdentifier: true,
        name: true,
        platform: true,
        lastSeenAt: true,
        createdAt: true,
        _count: { select: { sessions: true, scans: true } },
      },
    });

    return { devices };
  });
};

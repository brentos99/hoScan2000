import Fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import compress from '@fastify/compress';
import rateLimit from '@fastify/rate-limit';
import { config } from './config/index.js';

// Import routes
import { storeRoutes } from './modules/stores/stores.routes.js';
import { masterRoutes } from './modules/master/master.routes.js';
import { stocktakeRoutes } from './modules/stocktakes/stocktakes.routes.js';
import { areaRoutes } from './modules/areas/areas.routes.js';
import { scanRoutes } from './modules/scans/scans.routes.js';
import { deviceRoutes } from './modules/devices/devices.routes.js';
import { syncRoutes } from './modules/sync/sync.routes.js';

export async function buildServer(): Promise<FastifyInstance> {
  const server = Fastify({
    logger: {
      level: config.log.level,
      transport:
        process.env.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                translateTime: 'HH:MM:ss Z',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    },
  });

  // Register plugins
  await server.register(cors, {
    origin: config.cors.origins.includes('*') ? true : config.cors.origins,
    credentials: true,
  });

  await server.register(compress);

  await server.register(rateLimit, {
    max: 1000,
    timeWindow: '1 minute',
  });

  // Health check
  server.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

  // API routes
  await server.register(
    async (api) => {
      await api.register(storeRoutes, { prefix: '/stores' });
      await api.register(masterRoutes, { prefix: '/stores' });
      await api.register(stocktakeRoutes, { prefix: '/stocktakes' });
      await api.register(areaRoutes, { prefix: '/stocktakes' });
      await api.register(scanRoutes, { prefix: '/stocktakes' });
      await api.register(deviceRoutes, { prefix: '/devices' });
      await api.register(syncRoutes, { prefix: '/sync' });
    },
    { prefix: '/api/v1' }
  );

  return server;
}

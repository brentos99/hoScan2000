import { config } from './config/index.js';
import { connectDatabase, disconnectDatabase } from './config/database.js';
import { buildServer } from './server.js';

async function main() {
  const server = await buildServer();

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    server.log.info(`Received ${signal}, shutting down...`);
    await server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    // Connect to database
    await connectDatabase();
    server.log.info('Connected to database');

    // Start server
    await server.listen({
      port: config.server.port,
      host: config.server.host,
    });

    server.log.info(`Server running at http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

main();

import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),
  CORS_ORIGINS: z.string().default('*'),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = {
  database: {
    url: parsed.data.DATABASE_URL,
  },
  server: {
    port: parsed.data.PORT,
    host: parsed.data.HOST,
  },
  cors: {
    origins: parsed.data.CORS_ORIGINS.split(',').map((o) => o.trim()),
  },
  log: {
    level: parsed.data.LOG_LEVEL,
  },
};

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    global._postgresPool = new Pool({
      host: process.env.SQL_HOST,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      database: process.env.SQL_DB_NAME,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10000,
    });

    global._postgresPool.on('error', (err: any) => {
      // Gracefully handle expected idle socket reclamation by Postgres server
      const isExpectedIdleClosure =
        err?.code === 'ECONNRESET' ||
        err?.message?.includes('Connection terminated unexpectedly') ||
        err?.message?.includes('socket has been ended');
      if (isExpectedIdleClosure) {
        // Safe transient idle socket reclamation, new queries will establish fresh connections
        return;
      }
      console.warn('[SQL Pool Notice]:', err?.message || err);
    });
  }
  return global._postgresPool;
};

const pool = createPool();

export const db = drizzle(pool, { schema });


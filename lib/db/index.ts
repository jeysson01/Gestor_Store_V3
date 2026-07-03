import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { createPoolConfig } from './pool-config';

const pool = new Pool(createPoolConfig(process.env.DATABASE_URL!));

export const db = drizzle(pool, { schema });

export type DB = typeof db;

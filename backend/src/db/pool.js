import dotenv from 'dotenv';
import pg from 'pg';

dotenv.config({ quiet: true });

const { Pool } = pg;
const connectionString = process.env.NEON_DATABASE_URL;

if (!connectionString) {
  throw new Error('NEON_DATABASE_URL is required to initialize the database pool');
}

export const pool = new Pool({
  connectionString,
});

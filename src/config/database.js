import 'dotenv/config';

let db;
let sql;

if (process.env.NODE_ENV === 'production') {
  // Real Neon Cloud: serverless HTTP/WebSocket driver.
  const { neon } = await import('@neondatabase/serverless');
  const { drizzle } = await import('drizzle-orm/neon-http');

  sql = neon(process.env.DATABASE_URL);
  db = drizzle(sql);
} else {
  // Neon Local (dev/test) is a plain TCP Postgres proxy, not the Neon
  // HTTP/WebSocket endpoint — use the regular node-postgres driver.
  const { Pool } = await import('pg');
  const { drizzle } = await import('drizzle-orm/node-postgres');

  // pg's ConnectionParameters merges the parsed connection string over the
  // explicit config, so a `sslmode=` query param would clobber the `ssl`
  // option below. Strip it and pass the self-signed-cert override directly —
  // Neon Local's proxy presents a self-signed cert for local dev/test.
  const url = new URL(process.env.DATABASE_URL);
  url.searchParams.delete('sslmode');

  sql = new Pool({
    connectionString: url.toString(),
    ssl: { rejectUnauthorized: false },
  });
  db = drizzle(sql);
}

export { db, sql };

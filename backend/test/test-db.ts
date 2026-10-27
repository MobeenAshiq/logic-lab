import 'dotenv/config';

/**
 * E2E tests never touch the dev database: they use TEST_DATABASE_URL, or the
 * dev DATABASE_URL with the database name suffixed with `_test`.
 */
export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const dev = process.env.DATABASE_URL;
  if (!dev) throw new Error('DATABASE_URL is not set');
  const url = new URL(dev);
  url.pathname = `${url.pathname.replace(/\/$/, '')}_test`;
  return url.toString();
}

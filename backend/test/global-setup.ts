import { execSync } from 'node:child_process';
import { testDatabaseUrl } from './test-db';

/** Runs once before all e2e files: creates (if needed) and migrates the test database. */
export default function globalSetup() {
  execSync('npx prisma migrate deploy', {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}

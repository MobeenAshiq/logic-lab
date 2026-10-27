// Loaded before each e2e file (jest-e2e.json "setupFiles"), so ConfigModule and
// Prisma see these values instead of the ones in .env.
import { testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl();

// Fake R2 credentials: presigning is computed locally, no request is sent to R2.
process.env.R2_ACCOUNT_ID ||= 'test-account';
process.env.R2_ACCESS_KEY_ID ||= 'test-key';
process.env.R2_SECRET_ACCESS_KEY ||= 'test-secret';
process.env.R2_BUCKET ||= 'logiclab-test';

// Tests must not depend on the developer's real Google OAuth keys.
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';

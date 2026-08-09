/** Ελάχιστο περιβάλλον ώστε να φορτώνει το `src/server/env.ts` στα tests. */
const testEnv = process.env as Record<string, string | undefined>;

testEnv.NODE_ENV ??= 'test';
testEnv.DATABASE_URL ??= 'postgresql://test:test@localhost:5432/test';
testEnv.AUTH_SECRET ??= 'test-secret-value-with-enough-length';
testEnv.APP_URL ??= 'http://localhost:3000';
testEnv.AI_PROVIDER = 'mock';
testEnv.UPLOAD_DIR ??= '/tmp/nutreluma-test-uploads';
testEnv.DEFAULT_TIMEZONE = 'Europe/Athens';
testEnv.LOG_LEVEL = 'error';

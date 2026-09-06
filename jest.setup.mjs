// Runs before the test framework and any test file is imported. Provides safe,
// deterministic defaults for env vars the app requires at module-load time
// (e.g. src/utils/jwt.js throws if JWT_SECRET is unset) so `npm test` works
// out of the box locally without a .env file. CI (tests.yml) sets its own
// real values for these, which take precedence since we only fill gaps.
process.env.NODE_ENV ??= 'test';
process.env.JWT_SECRET ??= 'test-only-jwt-secret-do-not-use-outside-tests';
process.env.DATABASE_URL ??=
  'postgresql://postgres:postgres@localhost:5432/acquisitions_test';

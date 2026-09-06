/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'node',

  // Pure native ESM: no Babel/TS transpilation involved.
  transform: {},

  setupFiles: ['<rootDir>/jest.setup.mjs'],

  // Jest's resolver doesn't follow package.json's "imports" field on its own,
  // so mirror every subpath alias defined there.
  moduleNameMapper: {
    '^#src/(.*)$': '<rootDir>/src/$1',
    '^#config/(.*)$': '<rootDir>/src/config/$1',
    '^#controllers/(.*)$': '<rootDir>/src/controllers/$1',
    '^#models/(.*)$': '<rootDir>/src/models/$1',
    '^#routes/(.*)$': '<rootDir>/src/routes/$1',
    '^#utils/(.*)$': '<rootDir>/src/utils/$1',
    '^#middleware/(.*)$': '<rootDir>/src/middleware/$1',
    '^#validations/(.*)$': '<rootDir>/src/validations/$1',
    '^#services/(.*)$': '<rootDir>/src/services/$1',
  },

  clearMocks: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageProvider: 'v8',
};

export default config;

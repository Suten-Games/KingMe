/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(png|jpg|jpeg|gif|svg|webp|mp4|webm|mov|lottie)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // Ignore React Native / Expo modules that can't run in Node
  transformIgnorePatterns: ['/node_modules/'],
  // Don't need to transform anything except our TS files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      diagnostics: false, // Skip type-checking source files (app has loose types)
      tsconfig: {
        // Override RN-specific settings for Node test env
        jsx: 'react',
        module: 'commonjs',
        target: 'ES2020',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: false,
        baseUrl: '.',
        paths: { '@/*': ['./src/*'] },
      },
    }],
  },
};

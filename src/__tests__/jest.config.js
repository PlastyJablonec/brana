/**
 * Jest Configuration for Firebase Testing
 * Konfigurace pro spuštění všech testů s správným setupem
 */

module.exports = {
  // Test environment
  testEnvironment: 'jsdom',
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/../setupTests.ts',
    '<rootDir>/setup/testSetup.ts'
  ],
  
  // Module name mapping for absolute imports
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^@components/(.*)$': '<rootDir>/src/components/$1',
    '^@contexts/(.*)$': '<rootDir>/src/contexts/$1',
    '^@services/(.*)$': '<rootDir>/src/services/$1',
    '^@utils/(.*)$': '<rootDir>/src/utils/$1',
    '^@types/(.*)$': '<rootDir>/src/types/$1'
  },
  
  // Transform files
  transform: {
    '^.+\\.(ts|tsx)$': 'ts-jest',
    '^.+\\.(js|jsx)$': 'babel-jest'
  },
  
  // File extensions to consider
  moduleFileExtensions: [
    'ts',
    'tsx',
    'js',
    'jsx',
    'json'
  ],
  
  // Test match patterns
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/__tests__/**/*.(ts|tsx|js|jsx)',
    '<rootDir>/src/**/?(*.)(spec|test).(ts|tsx|js|jsx)'
  ],
  
  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/index.tsx',
    '!src/reportWebVitals.ts',
    '!src/__tests__/**/*',
    '!src/**/test-data/**/*'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // Coverage reporters
  coverageReporters: [
    'text',
    'text-summary',
    'html',
    'lcov'
  ],
  
  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',
  
  // Ignore patterns
  testPathIgnorePatterns: [
    '<rootDir>/node_modules/',
    '<rootDir>/build/',
    '<rootDir>/dist/'
  ],
  
  // Module paths to ignore for transforms
  transformIgnorePatterns: [
    'node_modules/(?!(firebase|@firebase)/)'
  ],
  
  // Global test timeout
  testTimeout: 10000,
  
  // Clear mocks between tests
  clearMocks: true,
  
  // Restore mocks after each test
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Error handling
  errorOnDeprecated: true
};
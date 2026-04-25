'use strict'

module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.js'],
  forceExit: true,
  clearMocks: true,
  collectCoverageFrom: [
    'services/**/*.js',
    'middleware/**/*.js',
    '!**/*.map.js',
  ],
}

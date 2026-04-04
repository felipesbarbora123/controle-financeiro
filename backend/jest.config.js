/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  testMatch: ['**/*.test.js'],
  clearMocks: true,
  collectCoverageFrom: ['lib/**/*.js', 'middleware/**/*.js'],
  coveragePathIgnorePatterns: ['/node_modules/'],
};

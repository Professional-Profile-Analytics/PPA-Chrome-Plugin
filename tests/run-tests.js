#!/usr/bin/env node

/**
 * Test Runner for PPA Chrome Extension
 * 
 * This script provides a simple way to run tests with different configurations
 */

const { execSync } = require('child_process');
const path = require('path');

// Change to tests directory
process.chdir(__dirname);

console.log('🧪 Professional Profile Analytics - Chrome Extension Tests');
console.log('=' .repeat(60));

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0] || 'test';

try {
  switch (command) {
    case 'test':
      console.log('Running all tests...\n');
      execSync('npm test', { stdio: 'inherit' });
      break;
      
    case 'watch':
      console.log('Running tests in watch mode...\n');
      execSync('npm run test:watch', { stdio: 'inherit' });
      break;
      
    case 'coverage':
      console.log('Running tests with coverage report...\n');
      execSync('npm run test:coverage', { stdio: 'inherit' });
      break;
      
    case 'config':
      console.log('Running ConfigManager tests only...\n');
      execSync('npm run test:config', { stdio: 'inherit' });
      break;
      
    case 'analytics':
      console.log('Running Advanced Post Analytics tests only...\n');
      execSync('npx jest advancedPostAnalytics.test.js --verbose', { stdio: 'inherit' });
      break;
      
    case 'download':
      console.log('Running Download Tracking tests only...\n');
      execSync('npx jest downloadTracking.test.js --verbose', { stdio: 'inherit' });
      break;
      
    case 'install':
      console.log('Installing test dependencies...\n');
      execSync('npm install', { stdio: 'inherit' });
      console.log('\n✅ Test dependencies installed successfully!');
      console.log('\nNext steps:');
      console.log('  npm test                      - Run all tests');
      console.log('  npm run test:watch            - Run tests in watch mode');
      console.log('  npm run test:coverage         - Run tests with coverage');
      console.log('  node run-tests.js config      - Run ConfigManager tests');
      console.log('  node run-tests.js analytics   - Run Advanced Post Analytics tests');
      console.log('  node run-tests.js download    - Run Download Tracking tests');
      break;
      
    case 'help':
    default:
      console.log('Available commands:');
      console.log('  test      - Run all tests');
      console.log('  watch     - Run tests in watch mode');
      console.log('  coverage  - Run tests with coverage report');
      console.log('  config    - Run ConfigManager tests only');
      console.log('  analytics - Run Advanced Post Analytics tests only');
      console.log('  download  - Run Download Tracking tests only');
      console.log('  install   - Install test dependencies');
      console.log('  help      - Show this help message');
      break;
  }
} catch (error) {
  console.error('❌ Test execution failed:', error.message);
  process.exit(1);
}

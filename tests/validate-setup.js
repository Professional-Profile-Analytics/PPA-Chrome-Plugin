/**
 * Validation script to check if the test setup is correct
 */

const fs = require('fs');
const path = require('path');

console.log('🔍 Validating test setup...\n');

// Check required files
const requiredFiles = [
  'package.json',
  'setup/jest.setup.js',
  'configManager.test.js',
  'run-tests.js'
];

let allFilesExist = true;

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`✅ ${file} - Found`);
  } else {
    console.log(`❌ ${file} - Missing`);
    allFilesExist = false;
  }
});

// Check if background.js exists (parent directory)
const backgroundPath = path.join(__dirname, '..', 'background.js');
if (fs.existsSync(backgroundPath)) {
  console.log('✅ ../background.js - Found');
} else {
  console.log('❌ ../background.js - Missing (required for testing)');
  allFilesExist = false;
}

// Additional scenario: Check if contentScript.test.js exists
const contentScriptTestPath = path.join(__dirname, 'contentScript.test.js');
if (fs.existsSync(contentScriptTestPath)) {
  console.log('✅ contentScript.test.js - Found');
} else {
  console.log('❌ contentScript.test.js - Missing (recommended for content script testing)');
  allFilesExist = false;
}

// Additional scenario: Check if tests directory contains at least 5 test files
const testFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.js'));
if (testFiles.length >= 5) {
  console.log(`✅ ${testFiles.length} test files found in tests directory`);
} else {
  console.log(`❌ Only ${testFiles.length} test files found in tests directory (expected at least 5)`);
  allFilesExist = false;
}

// Additional scenario: Check if jest.setup.js contains basic setup (e.g., 'jest' in file)
try {
  const jestSetupContent = fs.readFileSync(path.join(__dirname, 'setup', 'jest.setup.js'), 'utf8');
  if (/jest/i.test(jestSetupContent)) {
    console.log('✅ jest.setup.js contains Jest setup');
  } else {
    console.log('❌ jest.setup.js does not appear to contain Jest setup');
  }
} catch (e) {
  console.log('❌ Could not read jest.setup.js:', e.message);
}

console.log('\n' + '='.repeat(50));

if (allFilesExist) {
  console.log('✅ All required files are present!');
  console.log('\nNext steps:');
  console.log('1. Install dependencies: node run-tests.js install');
  console.log('2. Run tests: node run-tests.js config');
} else {
  console.log('❌ Some required files are missing.');
  console.log('Please ensure all test files are created properly.');
}

// Check package.json content
try {
  const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
  console.log('\n📦 Package.json validation:');
  
  const requiredDeps = ['jest', 'jest-chrome', '@types/chrome', 'sinon'];
  const missingDeps = requiredDeps.filter(dep => !packageJson.devDependencies[dep]);
  
  if (missingDeps.length === 0) {
    console.log('✅ All required dependencies are listed');
  } else {
    console.log(`❌ Missing dependencies: ${missingDeps.join(', ')}`);
  }
  
  if (packageJson.scripts && packageJson.scripts.test) {
    console.log('✅ Test scripts are configured');
  } else {
    console.log('❌ Test scripts are missing');
  }
} catch (error) {
  console.log('❌ Error reading package.json:', error.message);
}

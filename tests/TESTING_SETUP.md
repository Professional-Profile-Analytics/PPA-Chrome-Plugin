# Testing Setup Guide

## Quick Start

1. **Install Dependencies**
   ```bash
   cd tests
   node run-tests.js install
   ```

2. **Run ConfigManager Tests**
   ```bash
   node run-tests.js config
   ```

3. **Run All Tests**
   ```bash
   node run-tests.js test
   ```

## Available Commands

- `node run-tests.js test` - Run all tests
- `node run-tests.js watch` - Run tests in watch mode (auto-rerun on changes)
- `node run-tests.js coverage` - Run tests with coverage report
- `node run-tests.js config` - Run ConfigManager tests only
- `node run-tests.js install` - Install test dependencies

## Test Structure

```
tests/
├── package.json           # Test dependencies and scripts
├── setup/
│   └── jest.setup.js     # Jest configuration and mocks
├── configManager.test.js  # ConfigManager unit tests
├── run-tests.js          # Test runner script
└── TESTING_SETUP.md      # This file
```

## What's Tested

### ConfigManager Tests (53 test cases)

#### ✅ getEmail()
- Returns email when exists in storage
- Throws AutomationError when email missing
- Handles null/undefined/empty email values
- Provides correct error context

#### ✅ updateExecutionStatus()
- Updates status without error
- Updates status with error object
- Handles errors without context
- Supports different status values
- Creates proper timestamps

#### ✅ getRetryCount()
- Returns retry count from storage
- Returns 0 when not set
- Handles null/undefined values
- Supports various numeric values

#### ✅ updateRetryCount()
- Updates retry count with valid numbers
- Handles zero and large numbers
- Logs updates correctly

#### ✅ resetRetryCount()
- Always resets to 0
- Works regardless of previous value
- Logs reset action

#### ✅ Integration Tests
- Complete retry workflow
- Execution status with retry workflow

#### ✅ Error Handling
- Chrome storage error handling
- Malformed error objects

## Test Coverage

The ConfigManager tests provide comprehensive coverage of:
- **Happy path scenarios** - Normal operation
- **Edge cases** - Null, undefined, empty values
- **Error conditions** - Missing data, malformed inputs
- **Integration workflows** - Multi-step operations
- **Chrome API interactions** - Storage operations

## Mocking Strategy

### Chrome APIs
- `chrome.storage.local.get` - Mocked to return test data
- `chrome.storage.local.set` - Mocked to simulate storage writes
- `chrome.storage.local.remove` - Mocked for cleanup operations

### Global Objects
- `Logger` - Mocked to capture log calls
- `AutomationError` - Custom error class for extension
- `console` methods - Mocked to reduce test noise

## Running Tests

### First Time Setup
```bash
cd /path/to/PPA-Chrome-Plugin/tests
node run-tests.js install
```

### Run ConfigManager Tests
```bash
node run-tests.js config
```

### Expected Output
```
🧪 Professional Profile Analytics - Chrome Extension Tests
============================================================
Running ConfigManager tests only...

 PASS  ./configManager.test.js
  ConfigManager
    getEmail()
      ✓ should return email when email exists in storage
      ✓ should throw AutomationError when email does not exist
      ✓ should throw AutomationError with correct context
      ... (50+ more tests)

Test Suites: 1 passed, 1 total
Tests:       53 passed, 53 total
Snapshots:   0 total
Time:        2.5s
```

## Next Steps

After ConfigManager tests are working:

1. **Add Language Detection Tests** - Test multi-language support
2. **Add File Upload Tests** - Test file handling logic  
3. **Add Company Automation Tests** - Test new company page features
4. **Add Integration Tests** - Test Chrome API interactions
5. **Add E2E Tests** - Test complete user workflows

## Troubleshooting

### Common Issues

**"Cannot find module 'jest'"**
- Run `node run-tests.js install` first

**"chrome is not defined"**
- Check that `jest-chrome` is installed and setup file is loaded

**Tests fail with storage errors**
- Verify Chrome API mocks are properly configured in `jest.setup.js`

### Debug Mode
Add `--verbose` to see detailed test output:
```bash
npx jest --verbose configManager.test.js
```

## Benefits of This Test Suite

1. **Confidence** - Know that core functionality works
2. **Regression Prevention** - Catch breaking changes early
3. **Documentation** - Tests serve as usage examples
4. **Refactoring Safety** - Change code with confidence
5. **Quality Assurance** - Ensure edge cases are handled

The ConfigManager tests establish a solid foundation for testing the entire Chrome extension.

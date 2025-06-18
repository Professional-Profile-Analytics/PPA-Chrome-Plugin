# Testing Plan for Professional Profile Analytics Chrome Extension

## Overview

This document outlines a comprehensive testing strategy for the PPA Chrome Extension, covering unit tests, integration tests, end-to-end tests, and manual testing procedures.

## Testing Framework Recommendations

### Primary Testing Stack
- **Jest** - JavaScript testing framework for unit and integration tests
- **Chrome Extensions Testing Library** - Specialized testing utilities for Chrome extensions
- **Puppeteer** - For end-to-end browser automation testing
- **Sinon.js** - For mocking and stubbing Chrome APIs
- **MSW (Mock Service Worker)** - For API mocking

### Additional Tools
- **ESLint** - Code quality and consistency
- **Chrome Extension Test Utils** - Helper utilities for extension testing
- **Faker.js** - Generate test data

## Test Categories

### 1. Unit Tests

#### 1.1 Background Script Tests (`background.js`)

**Configuration Management**
- [ ] `ConfigManager.getEmail()` - Test email retrieval from storage
- [ ] `ConfigManager.updateExecutionStatus()` - Test status updates
- [ ] `ConfigManager.getRetryCount()` - Test retry count management
- [ ] `ConfigManager.resetRetryCount()` - Test retry count reset

**Language Detection**
- [ ] `detectLanguage()` - Test language detection from various meta tags
- [ ] `LANGUAGE_DICTIONARY` - Test all language translations exist
- [ ] Language fallback to default when detection fails

**LinkedIn Automation**
- [ ] `LinkedInMultilingualAutomation.executeSteps()` - Test main automation flow
- [ ] `LinkedInMultilingualAutomation.executeStepsDirect()` - Test direct automation
- [ ] `LinkedInMultilingualAutomation.clickExportButton()` - Test export button clicking
- [ ] Multi-language button detection logic

**Company Page Automation**
- [ ] `checkAndRunCompanyPageUpload()` - Test 7-day interval checking
- [ ] `runCompanyPageAutomation()` - Test company automation flow
- [ ] `executeCompanyPageSteps()` - Test two-step export process
- [ ] `findAndClickCompanyExportButton()` - Test first export button
- [ ] `findAndClickSecondExportButton()` - Test popup export button
- [ ] `findAndClickAlternativeExportButton()` - Test fallback buttons
- [ ] `checkForRecentDownloads()` - Test recent download detection
- [ ] `uploadCompanyFile()` - Test file upload logic

**File Upload**
- [ ] `FileUploader.uploadToWebhook()` - Test personal data upload
- [ ] File validation (xlsx format)
- [ ] Base64 encoding/decoding
- [ ] Error handling for failed uploads

**Alarm Management**
- [ ] `AlarmManager.setupInitialAlarm()` - Test alarm creation
- [ ] `AlarmManager.setupWatchdogAlarm()` - Test watchdog functionality
- [ ] `AlarmManager.initializeAlarmListeners()` - Test alarm listeners
- [ ] Alarm interval calculations

**Retry Mechanism**
- [ ] `scheduleRetry()` - Test retry scheduling logic
- [ ] Exponential backoff calculations
- [ ] Maximum retry limit enforcement
- [ ] Retry count reset conditions

**Message Handling**
- [ ] `chrome.runtime.onMessage` handlers
- [ ] `executeScript` action handling
- [ ] `executeCompanyScript` action handling
- [ ] `updateInterval` action handling
- [ ] External message handling for Shiny integration

#### 1.2 Options Script Tests (`options.js`)

**UI Interactions**
- [ ] Email save functionality
- [ ] Company ID save functionality
- [ ] Frequency selection updates
- [ ] Manual execution triggers

**Status Display**
- [ ] Next execution time display
- [ ] Last execution status display
- [ ] Company execution status display
- [ ] Alarm status checking

**Validation**
- [ ] Email format validation
- [ ] Company ID numeric validation
- [ ] Status message display logic

#### 1.3 Popup Script Tests (`popup.js`)

**Status Information**
- [ ] Extension status display
- [ ] Next execution countdown
- [ ] Last execution results
- [ ] Error message handling

#### 1.4 Content Script Tests (`content.js`)

**LinkedIn Page Interaction**
- [ ] Export button detection
- [ ] Button click simulation
- [ ] Multi-language support
- [ ] Error handling for missing elements

#### 1.5 LinkedIn Post Helper Tests (`linkedin-post-helper-typing.js`)

**Human-like Typing**
- [ ] Variable typing speed simulation
- [ ] Natural pause insertion
- [ ] Punctuation pause handling
- [ ] Paragraph break timing
- [ ] "Thinking pause" randomization

**Post Creation**
- [ ] "Start a post" button detection
- [ ] Text area focus and typing
- [ ] Multi-language button support
- [ ] Error handling for UI changes

### 2. Integration Tests

#### 2.1 Chrome APIs Integration
- [ ] `chrome.storage.local` operations
- [ ] `chrome.downloads` API usage
- [ ] `chrome.tabs` management
- [ ] `chrome.alarms` functionality
- [ ] `chrome.scripting` injection
- [ ] `chrome.runtime` messaging

#### 2.2 External API Integration
- [ ] Personal analytics API endpoint
- [ ] Company analytics API endpoint
- [ ] Error response handling
- [ ] Network timeout handling
- [ ] Rate limiting scenarios

#### 2.3 Cross-Component Communication
- [ ] Background ↔ Options page messaging
- [ ] Background ↔ Popup messaging
- [ ] Background ↔ Content script communication
- [ ] External app ↔ Extension messaging (Shiny)

### 3. End-to-End Tests

#### 3.1 Personal Analytics Flow
- [ ] Complete automation cycle (LinkedIn login → export → upload)
- [ ] Multi-language LinkedIn interfaces
- [ ] Retry mechanism on failures
- [ ] Alarm-triggered execution
- [ ] Manual execution from popup

#### 3.2 Company Analytics Flow
- [ ] Company page navigation
- [ ] Two-step export process
- [ ] File download detection
- [ ] Weekly scheduling logic
- [ ] Manual company execution

#### 3.3 Shiny Integration Flow
- [ ] External message reception
- [ ] LinkedIn tab creation
- [ ] Human-like typing simulation
- [ ] Post creation completion
- [ ] Response message sending

### 4. Performance Tests

#### 4.1 Memory Usage
- [ ] Extension memory footprint
- [ ] Memory leaks in long-running processes
- [ ] Tab cleanup after automation

#### 4.2 Timing Tests
- [ ] Automation completion times
- [ ] Download detection latency
- [ ] API response times
- [ ] Retry interval accuracy

### 5. Security Tests

#### 5.1 Data Handling
- [ ] Secure storage of user credentials
- [ ] Base64 encoding/decoding security
- [ ] File content validation
- [ ] API payload sanitization

#### 5.2 Permission Usage
- [ ] Minimal permission principle
- [ ] Host permission validation
- [ ] External connectivity restrictions

### 6. Compatibility Tests

#### 6.1 Browser Compatibility
- [ ] Chrome versions (latest 3 major versions)
- [ ] Manifest V3 compliance
- [ ] Service worker limitations

#### 6.2 LinkedIn Interface Changes
- [ ] UI element selector robustness
- [ ] Multi-language interface handling
- [ ] Graceful degradation on UI changes

### 7. Manual Testing Procedures

#### 7.1 Installation & Setup
- [ ] Fresh installation process
- [ ] Options page configuration
- [ ] Permission granting
- [ ] Initial alarm setup

#### 7.2 User Workflows
- [ ] First-time user experience
- [ ] Regular automation cycles
- [ ] Error recovery scenarios
- [ ] Manual intervention cases

#### 7.3 Edge Cases
- [ ] Network disconnection during automation
- [ ] LinkedIn session expiration
- [ ] Browser restart during process
- [ ] Multiple tab scenarios

## Test Data Management

### Mock Data Requirements
- [ ] Sample LinkedIn HTML structures (multiple languages)
- [ ] Mock Chrome API responses
- [ ] Sample download files (XLS/XLSX)
- [ ] API response fixtures
- [ ] User configuration scenarios

### Test Environment Setup
- [ ] Mock LinkedIn pages for testing
- [ ] Local API endpoints for testing
- [ ] Chrome extension test environment
- [ ] Automated test data generation

## Continuous Integration

### CI/CD Pipeline
- [ ] Automated test execution on commits
- [ ] Code coverage reporting
- [ ] Performance regression detection
- [ ] Security vulnerability scanning

### Test Reporting
- [ ] Unit test coverage reports
- [ ] Integration test results
- [ ] Performance benchmarks
- [ ] Security scan results

## Test Implementation Phases

### Phase 1: Foundation (Week 1-2)
- Set up testing framework and tools
- Implement basic unit tests for core functions
- Create mock data and fixtures
- Establish CI/CD pipeline

### Phase 2: Core Functionality (Week 3-4)
- Complete unit tests for all modules
- Implement integration tests for Chrome APIs
- Create end-to-end test scenarios
- Add performance benchmarks

### Phase 3: Advanced Testing (Week 5-6)
- Implement security tests
- Add compatibility tests
- Create comprehensive manual test procedures
- Optimize test execution speed

### Phase 4: Maintenance (Ongoing)
- Regular test updates for new features
- Regression test maintenance
- Performance monitoring
- Security audit updates

## Success Metrics

### Coverage Targets
- **Unit Tests**: 90%+ code coverage
- **Integration Tests**: All Chrome API interactions covered
- **End-to-End Tests**: All user workflows covered
- **Manual Tests**: All edge cases documented and tested

### Quality Gates
- All tests must pass before deployment
- No critical security vulnerabilities
- Performance within acceptable limits
- Compatibility with target browser versions

## Tools and Resources

### Development Dependencies
```json
{
  "devDependencies": {
    "jest": "^29.0.0",
    "puppeteer": "^19.0.0",
    "sinon": "^15.0.0",
    "msw": "^1.0.0",
    "@types/chrome": "^0.0.200",
    "eslint": "^8.0.0",
    "faker": "^6.0.0"
  }
}
```

### Testing Utilities
- Chrome Extension Testing Library
- Jest Chrome Extension Preset
- Puppeteer Chrome Extension Helper
- Mock Service Worker for API testing

## Documentation Requirements

### Test Documentation
- [ ] Test case specifications
- [ ] Mock data documentation
- [ ] Test environment setup guide
- [ ] Troubleshooting guide for test failures

### User Testing Documentation
- [ ] Manual testing checklists
- [ ] User acceptance test scenarios
- [ ] Bug reporting templates
- [ ] Performance testing procedures

---

## Getting Started

1. **Install Dependencies**: Run `npm install` to install testing frameworks
2. **Set Up Environment**: Configure test environment variables
3. **Run Tests**: Execute `npm test` for unit tests, `npm run test:e2e` for end-to-end tests
4. **View Coverage**: Run `npm run coverage` to see test coverage reports
5. **Manual Testing**: Follow procedures in `/tests/manual/` directory

## Contributing to Tests

When adding new features:
1. Write unit tests for new functions
2. Add integration tests for Chrome API usage
3. Update end-to-end tests for new user workflows
4. Document any new test procedures
5. Ensure all tests pass before submitting PR

---

*This testing plan should be reviewed and updated regularly as the extension evolves and new features are added.*

/**
 * Jest setup file for Chrome Extension testing
 * This file configures the testing environment with Chrome API mocks
 */

// Create a comprehensive Chrome API mock
const chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    },
    sync: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn(),
      clear: jest.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onMessageExternal: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    sendMessage: jest.fn()
  },
  tabs: {
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    query: jest.fn(),
    onUpdated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  downloads: {
    search: jest.fn(),
    onCreated: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  },
  scripting: {
    executeScript: jest.fn()
  },
  webRequest: {
    onBeforeRequest: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    },
    onHeadersReceived: {
      addListener: jest.fn(),
      removeListener: jest.fn()
    }
  }
};

// Make chrome available globally
global.chrome = chrome;

// Polyfill for TextEncoder/TextDecoder for jsdom compatibility
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Global test setup
beforeEach(() => {
  // Clear all mocks before each test
  jest.clearAllMocks();
  
  // Reset Chrome API mocks
  chrome.storage.local.get.mockClear();
  chrome.storage.local.set.mockClear();
  chrome.storage.local.remove.mockClear();
});

// Global test teardown
afterEach(() => {
  // Clean up any remaining timers or async operations
  jest.clearAllTimers();
});

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
};

// Mock AutomationError class (from background.js)
global.AutomationError = class AutomationError extends Error {
  constructor(message, context = {}) {
    super(message);
    this.name = 'AutomationError';
    this.context = context;
  }
};

// Mock Logger object (from background.js)
global.Logger = {
  log: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn()
};

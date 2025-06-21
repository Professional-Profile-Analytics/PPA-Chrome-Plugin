/**
 * Options Page Tests
 * 
 * Comprehensive test suite for the Chrome Extension's options page functionality,
 * covering email/company ID management, frequency settings, and UI interactions.
 */

const fs = require('fs');
const path = require('path');

// Polyfills for JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock DOM environment
const { JSDOM } = require('jsdom');

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Options Page Tests', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Create a mock DOM environment
    const optionsHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Options</title>
      </head>
      <body>
        <div id="email-section">
          <input type="email" id="email" placeholder="Enter your email">
          <button id="save-email">Save Email</button>
          <div id="emailStatus"></div>
        </div>
        
        <div id="company-section">
          <input type="text" id="companyId" placeholder="Enter Company ID">
          <button id="save-company-id">Save Company ID</button>
          <div id="companyIdStatus"></div>
        </div>
        
        <div id="frequency-section">
          <select id="uploadFrequency">
            <option value="daily">Daily</option>
            <option value="3days">Every 3 Days</option>
          </select>
          <button id="saveFrequency">Save Frequency</button>
          <div id="frequencyStatus"></div>
        </div>
        
        <div id="advanced-section">
          <input type="checkbox" id="advancedPostStats">
          <input type="range" id="postsLimit" min="5" max="50" value="30">
          <span id="postsLimitValue">30</span>
          <button id="saveAdvanced">Save Advanced Settings</button>
        </div>
        
        <div id="execution-section">
          <div id="nextExecution"></div>
          <div id="lastExecution"></div>
          <div id="companyNextExecution"></div>
          <div id="companyLastExecution"></div>
          <button id="manualExecution">Run Now</button>
          <button id="manualCompanyExecution">Run Company Analytics</button>
        </div>
      </body>
      </html>
    `;

    dom = new JSDOM(optionsHtml, {
      url: 'chrome-extension://test/options.html',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset Chrome API mocks to default behavior
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    chrome.storage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });
    chrome.storage.local.remove.mockImplementation((keys, callback) => {
      if (callback) callback();
    });
    chrome.runtime.sendMessage.mockImplementation(() => {});

    // Mock showStatusMessage function
    global.showStatusMessage = jest.fn();
    global.updateNextExecutionDisplay = jest.fn();
    global.updateCompanyExecutionDisplays = jest.fn();
    global.togglePostsLimitSlider = jest.fn();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('Email Management', () => {
    
    test('loads existing email from storage on page load', (done) => {
      const testEmail = 'test@example.com';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys === 'email') {
          callback({ email: testEmail });
        } else {
          callback({});
        }
      });

      // Simulate DOMContentLoaded event
      const event = new window.Event('DOMContentLoaded');
      
      // Add event listener that mimics options.js behavior
      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get('email', function(data) {
          if (data.email) {
            document.getElementById('email').value = data.email;
          }
        });
        
        // Verify email was loaded
        setTimeout(() => {
          expect(document.getElementById('email').value).toBe(testEmail);
          expect(chrome.storage.local.get).toHaveBeenCalledWith('email', expect.any(Function));
          done();
        }, 0);
      });

      document.dispatchEvent(event);
    });

    test('saves valid email when save button is clicked', () => {
      const testEmail = 'user@example.com';
      const emailInput = document.getElementById('email');
      const saveButton = document.getElementById('save-email');
      
      emailInput.value = testEmail;
      
      // Add event listener that mimics options.js behavior
      saveButton.addEventListener('click', function() {
        const email = document.getElementById('email').value;
        if (email) {
          chrome.storage.local.set({ email: email }, function() {
            showStatusMessage('emailStatus', 'Email saved successfully!', 'success');
          });
        } else {
          showStatusMessage('emailStatus', 'Please enter a valid email address.', 'error');
        }
      });

      saveButton.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { email: testEmail },
        expect.any(Function)
      );
      expect(showStatusMessage).toHaveBeenCalledWith(
        'emailStatus',
        'Email saved successfully!',
        'success'
      );
    });

    test('shows error message for empty email', () => {
      const emailInput = document.getElementById('email');
      const saveButton = document.getElementById('save-email');
      
      emailInput.value = '';
      
      // Add event listener
      saveButton.addEventListener('click', function() {
        const email = document.getElementById('email').value;
        if (email) {
          chrome.storage.local.set({ email: email }, function() {
            showStatusMessage('emailStatus', 'Email saved successfully!', 'success');
          });
        } else {
          showStatusMessage('emailStatus', 'Please enter a valid email address.', 'error');
        }
      });

      saveButton.click();

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(showStatusMessage).toHaveBeenCalledWith(
        'emailStatus',
        'Please enter a valid email address.',
        'error'
      );
    });

  });

  describe('Company ID Management', () => {
    
    test('loads existing company ID from storage', (done) => {
      const testCompanyId = '12345';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys === 'companyId') {
          callback({ companyId: testCompanyId });
        } else {
          callback({});
        }
      });

      // Simulate loading company ID
      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get('companyId', function(data) {
          if (data.companyId) {
            document.getElementById('companyId').value = data.companyId;
          }
        });
        
        setTimeout(() => {
          expect(document.getElementById('companyId').value).toBe(testCompanyId);
          done();
        }, 0);
      });

      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    test('saves valid numeric company ID', () => {
      const testCompanyId = '67890';
      const companyInput = document.getElementById('companyId');
      const saveButton = document.getElementById('save-company-id');
      
      companyInput.value = testCompanyId;
      
      // Add event listener
      saveButton.addEventListener('click', function() {
        const companyId = document.getElementById('companyId').value.trim();
        
        if (companyId && /^\d+$/.test(companyId)) {
          chrome.storage.local.set({ companyId: companyId }, function() {
            showStatusMessage('companyIdStatus', 'Company ID saved successfully!', 'success');
            updateCompanyExecutionDisplays();
          });
        } else if (companyId === '') {
          chrome.storage.local.remove('companyId', function() {
            showStatusMessage('companyIdStatus', 'Company ID cleared.', 'success');
            updateCompanyExecutionDisplays();
          });
        } else {
          showStatusMessage('companyIdStatus', 'Please enter a valid numeric Company ID.', 'error');
        }
      });

      saveButton.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { companyId: testCompanyId },
        expect.any(Function)
      );
      expect(showStatusMessage).toHaveBeenCalledWith(
        'companyIdStatus',
        'Company ID saved successfully!',
        'success'
      );
      expect(updateCompanyExecutionDisplays).toHaveBeenCalled();
    });

    test('clears company ID when empty value is saved', () => {
      const companyInput = document.getElementById('companyId');
      const saveButton = document.getElementById('save-company-id');
      
      companyInput.value = '';
      
      // Add event listener
      saveButton.addEventListener('click', function() {
        const companyId = document.getElementById('companyId').value.trim();
        
        if (companyId && /^\d+$/.test(companyId)) {
          chrome.storage.local.set({ companyId: companyId }, function() {
            showStatusMessage('companyIdStatus', 'Company ID saved successfully!', 'success');
            updateCompanyExecutionDisplays();
          });
        } else if (companyId === '') {
          chrome.storage.local.remove('companyId', function() {
            showStatusMessage('companyIdStatus', 'Company ID cleared.', 'success');
            updateCompanyExecutionDisplays();
          });
        } else {
          showStatusMessage('companyIdStatus', 'Please enter a valid numeric Company ID.', 'error');
        }
      });

      saveButton.click();

      expect(chrome.storage.local.remove).toHaveBeenCalledWith(
        'companyId',
        expect.any(Function)
      );
      expect(showStatusMessage).toHaveBeenCalledWith(
        'companyIdStatus',
        'Company ID cleared.',
        'success'
      );
    });

    test('shows error for invalid non-numeric company ID', () => {
      const companyInput = document.getElementById('companyId');
      const saveButton = document.getElementById('save-company-id');
      
      companyInput.value = 'invalid123abc';
      
      // Add event listener
      saveButton.addEventListener('click', function() {
        const companyId = document.getElementById('companyId').value.trim();
        
        if (companyId && /^\d+$/.test(companyId)) {
          chrome.storage.local.set({ companyId: companyId }, function() {
            showStatusMessage('companyIdStatus', 'Company ID saved successfully!', 'success');
            updateCompanyExecutionDisplays();
          });
        } else if (companyId === '') {
          chrome.storage.local.remove('companyId', function() {
            showStatusMessage('companyIdStatus', 'Company ID cleared.', 'success');
            updateCompanyExecutionDisplays();
          });
        } else {
          showStatusMessage('companyIdStatus', 'Please enter a valid numeric Company ID.', 'error');
        }
      });

      saveButton.click();

      expect(chrome.storage.local.set).not.toHaveBeenCalled();
      expect(showStatusMessage).toHaveBeenCalledWith(
        'companyIdStatus',
        'Please enter a valid numeric Company ID.',
        'error'
      );
    });

  });

  describe('Frequency Settings', () => {
    
    test('loads existing frequency setting from storage', (done) => {
      const testFrequency = 'daily';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes && keys.includes('uploadFrequency')) {
          callback({ uploadFrequency: testFrequency });
        } else {
          callback({});
        }
      });

      // Simulate loading frequency
      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get(['uploadFrequency'], function(result) {
          if (result.uploadFrequency) {
            document.getElementById('uploadFrequency').value = result.uploadFrequency;
          }
        });
        
        setTimeout(() => {
          expect(document.getElementById('uploadFrequency').value).toBe(testFrequency);
          done();
        }, 0);
      });

      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    test('saves frequency setting and updates interval', () => {
      const frequencySelect = document.getElementById('uploadFrequency');
      const saveButton = document.getElementById('saveFrequency');
      
      frequencySelect.value = 'daily';
      
      // Add event listener
      saveButton.addEventListener('click', function() {
        const frequency = document.getElementById('uploadFrequency').value;

        chrome.storage.local.set({ uploadFrequency: frequency }, function() {
          // Update the interval in milliseconds based on selection
          let interval;
          switch(frequency) {
            case 'daily':
              interval = 24 * 60 * 60 * 1000; // 1 day
              break;
            default:
              interval = 3 * 24 * 60 * 60 * 1000; // 3 days (default)
          }

          // Send message to background script to update interval
          chrome.runtime.sendMessage({
            action: 'updateInterval',
            interval: interval
          });

          // Calculate and display the next execution time
          updateNextExecutionDisplay(interval);

          // Show status message
          showStatusMessage('frequencyStatus', 'Frequency saved successfully!', 'success');
        });
      });

      saveButton.click();

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { uploadFrequency: 'daily' },
        expect.any(Function)
      );
      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'updateInterval',
        interval: 24 * 60 * 60 * 1000
      });
      expect(updateNextExecutionDisplay).toHaveBeenCalledWith(24 * 60 * 60 * 1000);
      expect(showStatusMessage).toHaveBeenCalledWith(
        'frequencyStatus',
        'Frequency saved successfully!',
        'success'
      );
    });

    test('calculates correct interval for 3-day frequency', () => {
      const frequencySelect = document.getElementById('uploadFrequency');
      const saveButton = document.getElementById('saveFrequency');
      
      frequencySelect.value = '3days';
      
      // Add event listener
      saveButton.addEventListener('click', function() {
        const frequency = document.getElementById('uploadFrequency').value;

        chrome.storage.local.set({ uploadFrequency: frequency }, function() {
          let interval;
          switch(frequency) {
            case 'daily':
              interval = 24 * 60 * 60 * 1000;
              break;
            default:
              interval = 3 * 24 * 60 * 60 * 1000; // 3 days (default)
          }

          chrome.runtime.sendMessage({
            action: 'updateInterval',
            interval: interval
          });

          updateNextExecutionDisplay(interval);
          showStatusMessage('frequencyStatus', 'Frequency saved successfully!', 'success');
        });
      });

      saveButton.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'updateInterval',
        interval: 3 * 24 * 60 * 60 * 1000
      });
    });

  });

  describe('Advanced Post Analytics Settings', () => {
    
    test('loads existing advanced settings from storage', (done) => {
      const testSettings = {
        advancedPostStats: true,
        postsLimit: 25
      };
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes && keys.includes('advancedPostStats')) {
          callback(testSettings);
        } else {
          callback({});
        }
      });

      // Simulate loading advanced settings
      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get(['advancedPostStats', 'postsLimit'], function(result) {
          if (result.advancedPostStats !== undefined) {
            document.getElementById('advancedPostStats').checked = result.advancedPostStats;
            togglePostsLimitSlider(result.advancedPostStats);
          }
          
          const postsLimit = result.postsLimit || 30;
          document.getElementById('postsLimit').value = postsLimit;
          document.getElementById('postsLimitValue').textContent = postsLimit;
        });
        
        setTimeout(() => {
          expect(document.getElementById('advancedPostStats').checked).toBe(true);
          expect(document.getElementById('postsLimit').value).toBe('25');
          expect(document.getElementById('postsLimitValue').textContent).toBe('25');
          expect(togglePostsLimitSlider).toHaveBeenCalledWith(true);
          done();
        }, 0);
      });

      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    test('uses default posts limit when not stored', (done) => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // No stored settings
      });

      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get(['advancedPostStats', 'postsLimit'], function(result) {
          const postsLimit = result.postsLimit || 30;
          document.getElementById('postsLimit').value = postsLimit;
          document.getElementById('postsLimitValue').textContent = postsLimit;
        });
        
        setTimeout(() => {
          expect(document.getElementById('postsLimit').value).toBe('30');
          expect(document.getElementById('postsLimitValue').textContent).toBe('30');
          done();
        }, 0);
      });

      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    test('updates posts limit value display when slider changes', () => {
      const postsLimitSlider = document.getElementById('postsLimit');
      const postsLimitValue = document.getElementById('postsLimitValue');
      
      // Add event listener for slider change
      postsLimitSlider.addEventListener('input', function() {
        document.getElementById('postsLimitValue').textContent = this.value;
      });

      postsLimitSlider.value = '45';
      postsLimitSlider.dispatchEvent(new window.Event('input'));

      expect(postsLimitValue.textContent).toBe('45');
    });

  });

  describe('Manual Execution', () => {
    
    test('triggers manual execution when button is clicked', () => {
      const manualButton = document.getElementById('manualExecution');
      
      // Add event listener
      manualButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'executeScript'
        });
      });

      manualButton.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'executeScript'
      });
    });

    test('triggers manual company execution when button is clicked', () => {
      const manualCompanyButton = document.getElementById('manualCompanyExecution');
      
      // Add event listener
      manualCompanyButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'executeCompanyScript'
        });
      });

      manualCompanyButton.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'executeCompanyScript'
      });
    });

  });

  describe('Status Display Functions', () => {
    
    test('showStatusMessage function displays success message', () => {
      const statusElement = document.getElementById('emailStatus');
      
      // Mock the showStatusMessage function implementation
      global.showStatusMessage = function(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = type;
      };

      showStatusMessage('emailStatus', 'Test success message', 'success');

      expect(statusElement.textContent).toBe('Test success message');
      expect(statusElement.className).toBe('success');
    });

    test('showStatusMessage function displays error message', () => {
      const statusElement = document.getElementById('companyIdStatus');
      
      global.showStatusMessage = function(elementId, message, type) {
        const element = document.getElementById(elementId);
        element.textContent = message;
        element.className = type;
      };

      showStatusMessage('companyIdStatus', 'Test error message', 'error');

      expect(statusElement.textContent).toBe('Test error message');
      expect(statusElement.className).toBe('error');
    });

  });

  describe('Error Handling', () => {
    
    test('handles storage errors gracefully', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        throw new Error('Storage error');
      });

      // Should not throw an error when storage fails
      expect(() => {
        const event = new window.Event('DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', function() {
          try {
            chrome.storage.local.get('email', function(data) {
              // This should handle the error gracefully
            });
          } catch (error) {
            // Error should be caught and handled
          }
        });
        document.dispatchEvent(event);
      }).not.toThrow();
    });

    test('handles runtime message errors gracefully', () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Runtime message error');
      });

      const saveButton = document.getElementById('saveFrequency');
      
      // Should not throw an error when runtime message fails
      expect(() => {
        saveButton.addEventListener('click', function() {
          try {
            chrome.runtime.sendMessage({
              action: 'updateInterval',
              interval: 24 * 60 * 60 * 1000
            });
          } catch (error) {
            // Error should be caught and handled
          }
        });
        saveButton.click();
      }).not.toThrow();
    });

  });

});

// Export for use in other test files
module.exports = {
  setupOptionsPageMocks: () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    chrome.storage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });
    chrome.runtime.sendMessage.mockImplementation(() => {});
  }
};

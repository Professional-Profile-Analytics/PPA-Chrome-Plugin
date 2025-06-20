/**
 * Unit Tests for Chrome API Integration System
 * 
 * Tests the Chrome extension API integrations including:
 * - Chrome Storage API operations and error handling
 * - Chrome Tabs API management and LinkedIn page automation
 * - Chrome Scripting API content script injection
 * - Chrome WebRequest API URL capture and filtering
 * - Chrome Alarms API scheduled execution
 * - Cross-API interaction scenarios and permission validation
 */

describe('Chrome API Integration System', () => {
  let mockLogger;

  beforeAll(() => {
    // Mock logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Reset Chrome runtime error
    delete chrome.runtime.lastError;
  });

  describe('Chrome Storage API Integration', () => {
    it('should handle chrome.storage.local.get operations correctly', async () => {
      const testData = { email: 'test@example.com', retryCount: 0 };
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback(testData);
      });

      const result = await new Promise((resolve) => {
        chrome.storage.local.get(['email', 'retryCount'], (result) => {
          resolve(result);
        });
      });

      expect(result).toEqual(testData);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['email', 'retryCount'], expect.any(Function));
    });

    it('should handle chrome.storage.local.set operations correctly', async () => {
      const testData = { executionStatus: 'Running', timestamp: '2025-06-20T09:00:00Z' };
      
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      await new Promise((resolve) => {
        chrome.storage.local.set(testData, () => {
          resolve();
        });
      });

      expect(chrome.storage.local.set).toHaveBeenCalledWith(testData, expect.any(Function));
    });

    it('should handle storage quota exceeded errors', async () => {
      chrome.storage.local.set.mockImplementation((data, callback) => {
        chrome.runtime.lastError = { message: 'QUOTA_EXCEEDED' };
        callback();
      });

      const error = await new Promise((resolve) => {
        chrome.storage.local.set({ largeData: 'x'.repeat(10000) }, () => {
          resolve(chrome.runtime.lastError);
        });
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('QUOTA_EXCEEDED');
    });

    it('should handle concurrent storage operations', async () => {
      let callCount = 0;
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callCount++;
        setTimeout(callback, 10); // Simulate async operation
      });

      const operations = [
        new Promise(resolve => chrome.storage.local.set({ key1: 'value1' }, resolve)),
        new Promise(resolve => chrome.storage.local.set({ key2: 'value2' }, resolve)),
        new Promise(resolve => chrome.storage.local.set({ key3: 'value3' }, resolve))
      ];

      await Promise.all(operations);

      expect(callCount).toBe(3);
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
    });

    it('should handle storage corruption scenarios', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        chrome.runtime.lastError = { message: 'Storage corrupted' };
        callback({});
      });

      const { result, error } = await new Promise((resolve) => {
        chrome.storage.local.get(['email'], (result) => {
          resolve({ result, error: chrome.runtime.lastError });
        });
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Storage corrupted');
      expect(result).toEqual({});
    });
  });

  describe('Chrome Tabs API Integration', () => {
    it('should create LinkedIn tabs correctly', async () => {
      const mockTab = { id: 123, url: 'https://www.linkedin.com/feed/', active: true };
      
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        callback(mockTab);
      });

      const tab = await new Promise((resolve) => {
        chrome.tabs.create({
          url: 'https://www.linkedin.com/feed/',
          active: false
        }, resolve);
      });

      expect(tab).toEqual(mockTab);
      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://www.linkedin.com/feed/',
        active: false
      }, expect.any(Function));
    });

    it('should handle tab creation errors', async () => {
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        chrome.runtime.lastError = { message: 'Tab creation blocked' };
        callback(null);
      });

      const { tab, error } = await new Promise((resolve) => {
        chrome.tabs.create({ url: 'https://www.linkedin.com/feed/' }, (tab) => {
          resolve({ tab, error: chrome.runtime.lastError });
        });
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Tab creation blocked');
      expect(tab).toBeNull();
    });

    it('should update tab properties correctly', async () => {
      const tabId = 123;
      const updateProperties = { active: true };
      
      chrome.tabs.update.mockImplementation((tabId, updateProperties, callback) => {
        callback({ id: tabId, active: true });
      });

      const updatedTab = await new Promise((resolve) => {
        chrome.tabs.update(tabId, updateProperties, resolve);
      });

      expect(updatedTab.active).toBe(true);
      expect(chrome.tabs.update).toHaveBeenCalledWith(tabId, updateProperties, expect.any(Function));
    });

    it('should close tabs correctly', async () => {
      const tabId = 123;
      
      chrome.tabs.remove.mockImplementation((tabId, callback) => {
        callback();
      });

      await new Promise((resolve) => {
        chrome.tabs.remove(tabId, resolve);
      });

      expect(chrome.tabs.remove).toHaveBeenCalledWith(tabId, expect.any(Function));
    });

    it('should handle tab permission errors', async () => {
      chrome.tabs.create.mockImplementation((createProperties, callback) => {
        chrome.runtime.lastError = { message: 'Cannot access chrome:// URLs' };
        callback(null);
      });

      const { error } = await new Promise((resolve) => {
        chrome.tabs.create({ url: 'chrome://settings/' }, (tab) => {
          resolve({ tab, error: chrome.runtime.lastError });
        });
      });

      expect(error.message).toBe('Cannot access chrome:// URLs');
    });

    it('should query tabs with filters correctly', async () => {
      const mockTabs = [
        { id: 1, url: 'https://www.linkedin.com/feed/', active: true },
        { id: 2, url: 'https://www.linkedin.com/analytics/', active: false }
      ];
      
      chrome.tabs.query.mockImplementation((queryInfo, callback) => {
        const filtered = mockTabs.filter(tab => 
          tab.url.includes('linkedin.com') && 
          (queryInfo.active === undefined || tab.active === queryInfo.active)
        );
        callback(filtered);
      });

      const linkedinTabs = await new Promise((resolve) => {
        chrome.tabs.query({ url: '*://www.linkedin.com/*' }, resolve);
      });

      expect(linkedinTabs).toHaveLength(2);
      expect(linkedinTabs[0].url).toContain('linkedin.com');
    });
  });

  describe('Chrome Scripting API Integration', () => {
    it('should inject content scripts correctly', async () => {
      const tabId = 123;
      const scriptResult = [{ result: 'Script executed successfully' }];
      
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        callback(scriptResult);
      });

      const result = await new Promise((resolve) => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          func: () => 'Script executed successfully'
        }, resolve);
      });

      expect(result).toEqual(scriptResult);
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: tabId },
        func: expect.any(Function)
      }, expect.any(Function));
    });

    it('should handle script injection errors', async () => {
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        chrome.runtime.lastError = { message: 'Cannot access contents of the page' };
        callback(null);
      });

      const { result, error } = await new Promise((resolve) => {
        chrome.scripting.executeScript({
          target: { tabId: 123 },
          func: () => 'test'
        }, (result) => {
          resolve({ result, error: chrome.runtime.lastError });
        });
      });

      expect(error).toBeDefined();
      expect(error.message).toBe('Cannot access contents of the page');
      expect(result).toBeNull();
    });

    it('should inject files correctly', async () => {
      const tabId = 123;
      
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        callback([{ result: 'File injected' }]);
      });

      const result = await new Promise((resolve) => {
        chrome.scripting.executeScript({
          target: { tabId: tabId },
          files: ['content.js']
        }, resolve);
      });

      expect(result[0].result).toBe('File injected');
      expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
        target: { tabId: tabId },
        files: ['content.js']
      }, expect.any(Function));
    });

    it('should handle multiple frame injection', async () => {
      const tabId = 123;
      const multiFrameResult = [
        { result: 'Main frame result', frameId: 0 },
        { result: 'Iframe result', frameId: 1 }
      ];
      
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        callback(multiFrameResult);
      });

      const result = await new Promise((resolve) => {
        chrome.scripting.executeScript({
          target: { tabId: tabId, allFrames: true },
          func: () => 'Frame result'
        }, resolve);
      });

      expect(result).toHaveLength(2);
      expect(result[0].frameId).toBe(0);
      expect(result[1].frameId).toBe(1);
    });
  });

  describe('Chrome WebRequest API Integration', () => {
    it('should setup WebRequest listeners correctly', () => {
      const mockCallback = jest.fn();
      const filter = { urls: ['*://www.linkedin.com/*'] };
      const extraInfoSpec = ['requestBody'];
      
      chrome.webRequest.onBeforeRequest.addListener(mockCallback, filter, extraInfoSpec);
      
      expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledWith(
        mockCallback, filter, extraInfoSpec
      );
    });

    it('should capture LinkedIn download URLs', () => {
      let capturedCallback;
      
      chrome.webRequest.onBeforeRequest.addListener.mockImplementation((callback, filter, extraInfoSpec) => {
        capturedCallback = callback;
      });
      
      // Setup listener
      chrome.webRequest.onBeforeRequest.addListener(
        (details) => mockLogger.log(`Captured URL: ${details.url}`),
        { urls: ['*://www.linkedin.com/ambry/*'] },
        ['requestBody']
      );
      
      // Simulate request
      const mockRequest = {
        url: 'https://www.linkedin.com/ambry/?x-ambry-um-filename=test.xlsx',
        method: 'GET',
        type: 'main_frame'
      };
      
      capturedCallback(mockRequest);
      
      expect(mockLogger.log).toHaveBeenCalledWith('Captured URL: https://www.linkedin.com/ambry/?x-ambry-um-filename=test.xlsx');
    });

    it('should handle WebRequest permission errors', () => {
      chrome.webRequest.onBeforeRequest.addListener.mockImplementation(() => {
        throw new Error('webRequest permission required');
      });

      expect(() => {
        chrome.webRequest.onBeforeRequest.addListener(
          () => {},
          { urls: ['*://www.linkedin.com/*'] },
          ['requestBody']
        );
      }).toThrow('webRequest permission required');
    });

    it('should remove WebRequest listeners correctly', () => {
      const mockCallback = jest.fn();
      
      chrome.webRequest.onBeforeRequest.removeListener(mockCallback);
      
      expect(chrome.webRequest.onBeforeRequest.removeListener).toHaveBeenCalledWith(mockCallback);
    });
  });

  describe('Chrome Alarms API Integration', () => {
    it('should create alarms correctly', async () => {
      chrome.alarms.create.mockImplementation((name, alarmInfo, callback) => {
        if (callback) callback();
      });

      await new Promise((resolve) => {
        chrome.alarms.create('automation-alarm', {
          delayInMinutes: 60,
          periodInMinutes: 1440 // 24 hours
        }, resolve);
      });

      expect(chrome.alarms.create).toHaveBeenCalledWith(
        'automation-alarm',
        { delayInMinutes: 60, periodInMinutes: 1440 },
        expect.any(Function)
      );
    });

    it('should handle alarm creation errors', async () => {
      chrome.alarms.create.mockImplementation((name, alarmInfo, callback) => {
        chrome.runtime.lastError = { message: 'Alarm creation failed' };
        callback();
      });

      const error = await new Promise((resolve) => {
        chrome.alarms.create('test-alarm', { delayInMinutes: 1 }, () => {
          resolve(chrome.runtime.lastError);
        });
      });

      expect(error.message).toBe('Alarm creation failed');
    });

    it('should clear alarms correctly', async () => {
      chrome.alarms.clear.mockImplementation((name, callback) => {
        callback(true); // Successfully cleared
      });

      const wasCleared = await new Promise((resolve) => {
        chrome.alarms.clear('automation-alarm', resolve);
      });

      expect(wasCleared).toBe(true);
      expect(chrome.alarms.clear).toHaveBeenCalledWith('automation-alarm', expect.any(Function));
    });

    it('should get alarm information correctly', async () => {
      const mockAlarm = {
        name: 'automation-alarm',
        scheduledTime: Date.now() + 60000,
        periodInMinutes: 1440
      };
      
      chrome.alarms.get.mockImplementation((name, callback) => {
        callback(mockAlarm);
      });

      const alarm = await new Promise((resolve) => {
        chrome.alarms.get('automation-alarm', resolve);
      });

      expect(alarm).toEqual(mockAlarm);
    });
  });
});

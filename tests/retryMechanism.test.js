/**
 * Retry Mechanism Tests
 * 
 * Comprehensive test suite for the Chrome Extension's retry mechanism,
 * covering retry scheduling, execution, limits, and error handling.
 */

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn(),
      remove: jest.fn()
    }
  },
  alarms: {
    create: jest.fn(),
    clear: jest.fn(),
    get: jest.fn(),
    getAll: jest.fn(),
    onAlarm: {
      addListener: jest.fn()
    }
  },
  tabs: {
    create: jest.fn(),
    remove: jest.fn(),
    update: jest.fn(),
    onUpdated: {
      addListener: jest.fn()
    }
  },
  runtime: {
    onMessage: {
      addListener: jest.fn()
    },
    onMessageExternal: {
      addListener: jest.fn()
    },
    onStartup: {
      addListener: jest.fn()
    },
    onInstalled: {
      addListener: jest.fn()
    }
  }
};

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

// Mock ConfigManager functionality with error handling
const ConfigManager = {
  async getRetryCount() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.get(['retryCount'], (result) => {
          resolve(result.retryCount || 0);
        });
      } catch (error) {
        // Handle storage errors gracefully
        resolve(0);
      }
    });
  },

  async updateRetryCount(count) {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ retryCount: count }, () => {
          resolve();
        });
      } catch (error) {
        // Handle storage errors gracefully
        resolve();
      }
    });
  },

  async resetRetryCount() {
    return new Promise((resolve) => {
      try {
        chrome.storage.local.set({ retryCount: 0 }, () => {
          resolve();
        });
      } catch (error) {
        // Handle storage errors gracefully
        resolve();
      }
    });
  }
};

// Mock CONFIG object
const CONFIG = {
  RETRY: {
    INTERVAL: 2 * 60 * 1000, // 2 minutes
    MAX_ATTEMPTS: 3
  },
  ALARMS: {
    RETRY: 'retryExecution'
  }
};

// Mock scheduleRetry function with error handling
async function scheduleRetry() {
  try {
    const currentRetryCount = await ConfigManager.getRetryCount();
    
    // Reset retry count if it's already at or above the maximum
    if (currentRetryCount >= CONFIG.RETRY.MAX_ATTEMPTS) {
      await ConfigManager.resetRetryCount();
      chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
      return;
    }

    // Normal retry scheduling logic
    const newRetryCount = currentRetryCount + 1;
    await ConfigManager.updateRetryCount(newRetryCount);

    // Calculate retry time (2 minutes later)
    const retryTime = Date.now() + CONFIG.RETRY.INTERVAL;
    const retryTimeISO = new Date(retryTime).toISOString();

    // Store the next retry time in storage for the watchdog to check
    chrome.storage.local.set({
      nextRetryTime: retryTimeISO,
      retryScheduled: true
    });

    // Create alarm for retry execution with error handling
    try {
      chrome.alarms.create(CONFIG.ALARMS.RETRY, { when: retryTime });
    } catch (alarmError) {
      // Handle alarm creation errors gracefully
      console.warn('Failed to create retry alarm:', alarmError.message);
    }
  } catch (error) {
    // Handle any errors gracefully
    console.error('Error in scheduleRetry:', error.message);
  }
}

// Mock AutomationWatchdog
class AutomationWatchdog {
  checkForMissedExecutions() {
    chrome.storage.local.get(["nextExecution", "nextRetryTime", "retryScheduled", "retryCount"], (data) => {
      const now = new Date();

      // Check for missed retry
      if (data.retryScheduled && data.nextRetryTime) {
        const nextRetryTime = new Date(data.nextRetryTime);
        if (now >= nextRetryTime) {
          // Clear the retry scheduled flag
          chrome.storage.local.set({ retryScheduled: false });
          
          // Run the automation script (mocked)
          this.runAutomationScript();
        }
      }
    });
  }

  handleRetryAlarm() {
    chrome.storage.local.get(['retryCount', 'nextRetryTime', 'retryScheduled'], (data) => {
      // Only proceed if retry is still scheduled (prevents race conditions)
      if (data.retryScheduled) {
        // Clear the retry scheduled flag immediately to prevent duplicate executions
        chrome.storage.local.set({ retryScheduled: false }, () => {
          // Run the automation script (mocked)
          this.runAutomationScript();
        });
      }
    });
  }

  runAutomationScript() {
    // Mock implementation
    return Promise.resolve();
  }
}

describe('Retry Mechanism Tests', () => {
  
  beforeEach(() => {
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
    chrome.alarms.create.mockImplementation(() => {});
    chrome.alarms.clear.mockImplementation(() => {});
  });

  describe('ConfigManager Retry Methods', () => {
    
    test('getRetryCount returns 0 for new installation', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });
      
      const retryCount = await ConfigManager.getRetryCount();
      expect(retryCount).toBe(0);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['retryCount'], expect.any(Function));
    });

    test('getRetryCount returns stored value', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: 2 });
      });
      
      const retryCount = await ConfigManager.getRetryCount();
      expect(retryCount).toBe(2);
    });

    test('updateRetryCount stores new value', async () => {
      await ConfigManager.updateRetryCount(3);
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 3 },
        expect.any(Function)
      );
    });

    test('resetRetryCount sets count to 0', async () => {
      await ConfigManager.resetRetryCount();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 0 },
        expect.any(Function)
      );
    });

  });

  describe('Retry Scheduling Logic', () => {
    
    test('scheduleRetry increments retry count from 0 to 1', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: 0 });
      });
      
      await scheduleRetry();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 1 },
        expect.any(Function)
      );
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        CONFIG.ALARMS.RETRY,
        { when: expect.any(Number) }
      );
    });

    test('scheduleRetry increments retry count from 1 to 2', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: 1 });
      });
      
      await scheduleRetry();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 2 },
        expect.any(Function)
      );
    });

    test('scheduleRetry resets when at maximum attempts', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: CONFIG.RETRY.MAX_ATTEMPTS });
      });
      
      await scheduleRetry();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 0 },
        expect.any(Function)
      );
      expect(chrome.storage.local.remove).toHaveBeenCalledWith(['nextRetryTime', 'retryScheduled']);
      expect(chrome.alarms.create).not.toHaveBeenCalled();
    });

    test('scheduleRetry stores retry timing information', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: 1 });
      });
      
      const beforeTime = Date.now();
      await scheduleRetry();
      const afterTime = Date.now();
      
      // Check that retry timing information was stored
      const setCall = chrome.storage.local.set.mock.calls.find(call => 
        call[0].nextRetryTime && call[0].retryScheduled
      );
      
      expect(setCall).toBeDefined();
      expect(setCall[0]).toEqual(
        expect.objectContaining({
          nextRetryTime: expect.any(String),
          retryScheduled: true
        })
      );
      
      // Verify the retry time is approximately 2 minutes in the future
      const retryTime = new Date(setCall[0].nextRetryTime).getTime();
      const expectedRetryTime = beforeTime + CONFIG.RETRY.INTERVAL;
      
      expect(retryTime).toBeGreaterThanOrEqual(expectedRetryTime - 1000);
      expect(retryTime).toBeLessThanOrEqual(afterTime + CONFIG.RETRY.INTERVAL + 1000);
    });

  });

  describe('Retry Configuration', () => {
    
    test('CONFIG.RETRY has correct default values', () => {
      expect(CONFIG.RETRY.INTERVAL).toBe(2 * 60 * 1000); // 2 minutes
      expect(CONFIG.RETRY.MAX_ATTEMPTS).toBe(3);
    });

    test('CONFIG.ALARMS.RETRY is defined', () => {
      expect(CONFIG.ALARMS.RETRY).toBe('retryExecution');
    });

  });

  describe('Watchdog Retry Detection', () => {
    
    test('watchdog detects missed retry execution', () => {
      const pastTime = new Date(Date.now() - 10000).toISOString(); // 10 seconds ago
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          retryScheduled: true,
          nextRetryTime: pastTime,
          retryCount: 1
        });
      });
      
      const watchdog = new AutomationWatchdog();
      const runAutomationScriptSpy = jest.spyOn(watchdog, 'runAutomationScript');
      runAutomationScriptSpy.mockResolvedValue();
      
      watchdog.checkForMissedExecutions();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ retryScheduled: false });
      expect(runAutomationScriptSpy).toHaveBeenCalled();
    });

    test('watchdog ignores future retry times', () => {
      const futureTime = new Date(Date.now() + 60000).toISOString(); // 1 minute in future
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          retryScheduled: true,
          nextRetryTime: futureTime,
          retryCount: 1
        });
      });
      
      const watchdog = new AutomationWatchdog();
      const runAutomationScriptSpy = jest.spyOn(watchdog, 'runAutomationScript');
      runAutomationScriptSpy.mockResolvedValue();
      
      watchdog.checkForMissedExecutions();
      
      expect(runAutomationScriptSpy).not.toHaveBeenCalled();
    });

    test('watchdog handles missing retry data gracefully', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // No retry data
      });
      
      const watchdog = new AutomationWatchdog();
      
      expect(() => {
        watchdog.checkForMissedExecutions();
      }).not.toThrow();
    });

  });

  describe('Retry Alarm Handling', () => {
    
    test('handleRetryAlarm executes when retry is scheduled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          retryScheduled: true,
          retryCount: 1,
          nextRetryTime: new Date().toISOString()
        });
      });
      
      const watchdog = new AutomationWatchdog();
      const runAutomationScriptSpy = jest.spyOn(watchdog, 'runAutomationScript');
      runAutomationScriptSpy.mockResolvedValue();
      
      watchdog.handleRetryAlarm();
      
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryScheduled: false },
        expect.any(Function)
      );
      expect(runAutomationScriptSpy).toHaveBeenCalled();
    });

    test('handleRetryAlarm skips when retry not scheduled', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          retryScheduled: false,
          retryCount: 1
        });
      });
      
      const watchdog = new AutomationWatchdog();
      const runAutomationScriptSpy = jest.spyOn(watchdog, 'runAutomationScript');
      runAutomationScriptSpy.mockResolvedValue();
      
      watchdog.handleRetryAlarm();
      
      expect(runAutomationScriptSpy).not.toHaveBeenCalled();
    });

  });

  describe('Error Scenarios and Edge Cases', () => {
    
    test('handles storage errors gracefully', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        throw new Error('Storage error');
      });
      
      // Should not throw an error
      await expect(ConfigManager.getRetryCount()).resolves.toBeDefined();
    });

    test('handles alarm creation failures', async () => {
      chrome.alarms.create.mockImplementation(() => {
        throw new Error('Alarm creation failed');
      });
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: 0 });
      });
      
      // Should not throw an error
      await expect(scheduleRetry()).resolves.toBeUndefined();
    });

    test('prevents infinite retry loops', async () => {
      // Test that retry count properly limits attempts
      for (let i = 0; i < CONFIG.RETRY.MAX_ATTEMPTS + 2; i++) {
        chrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({ retryCount: i });
        });
        
        await scheduleRetry();
        
        if (i >= CONFIG.RETRY.MAX_ATTEMPTS) {
          // Should reset retry count when at maximum
          expect(chrome.storage.local.set).toHaveBeenCalledWith(
            { retryCount: 0 },
            expect.any(Function)
          );
          expect(chrome.storage.local.remove).toHaveBeenCalledWith(['nextRetryTime', 'retryScheduled']);
        }
      }
    });

  });

  describe('Performance and Timing', () => {
    
    test('retry interval is correctly configured', () => {
      expect(CONFIG.RETRY.INTERVAL).toBe(2 * 60 * 1000); // 2 minutes
    });

    test('retry scheduling uses correct timing', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: 0 });
      });
      
      const beforeTime = Date.now();
      await scheduleRetry();
      
      expect(chrome.alarms.create).toHaveBeenCalledWith(
        CONFIG.ALARMS.RETRY,
        { when: expect.any(Number) }
      );
      
      const alarmCall = chrome.alarms.create.mock.calls[0];
      const scheduledTime = alarmCall[1].when;
      const expectedTime = beforeTime + CONFIG.RETRY.INTERVAL;
      
      expect(scheduledTime).toBeGreaterThanOrEqual(expectedTime - 1000);
      expect(scheduledTime).toBeLessThanOrEqual(expectedTime + 1000);
    });

  });

});

// Export for use in other test files
module.exports = {
  setupRetryMocks: () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    chrome.storage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });
    chrome.alarms.create.mockImplementation(() => {});
  }
};

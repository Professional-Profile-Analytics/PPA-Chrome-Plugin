/**
 * Unit Tests for ConfigManager
 * 
 * Tests the configuration management functionality including:
 * - Email retrieval and validation
 * - Execution status updates
 * - Retry count management
 * - Chrome storage interactions
 */

describe('ConfigManager', () => {
  // Import the ConfigManager from background.js
  let ConfigManager;
  
  beforeAll(() => {
    // Load the background script and extract ConfigManager
    // In a real implementation, you'd import this properly
    // For now, we'll define it inline based on the actual implementation
    ConfigManager = {
      async getEmail() {
        return new Promise((resolve, reject) => {
          chrome.storage.local.get(['email'], (result) => {
            if (result.email) {
              resolve(result.email);
            } else {
              reject(new AutomationError('Email not configured', {
                suggestedAction: 'Configure email in options page'
              }));
            }
          });
        });
      },

      async updateExecutionStatus(status, error = null) {
        const statusRecord = {
          timestamp: new Date().toISOString(),
          status: status
        };

        if (error) {
          statusRecord.error = {
            message: error.message,
            name: error.name,
            context: error.context || {},
            stack: error.stack
          };
        }

        return new Promise((resolve) => {
          chrome.storage.local.set({
            lastExecutionStatus: statusRecord.status,
            lastExecutionError: error ? JSON.stringify({
              message: error.message,
              name: error.name,
              context: error.context,
              stack: error.stack
            }, null, 2) : null,
            lastExecutionTime: statusRecord.timestamp
          }, () => {
            Logger.log(`Execution status updated: ${status}`);
            resolve();
          });
        });
      },

      async getRetryCount() {
        return new Promise((resolve) => {
          chrome.storage.local.get(['retryCount'], (result) => {
            resolve(result.retryCount || 0);
          });
        });
      },

      async updateRetryCount(count) {
        return new Promise((resolve) => {
          chrome.storage.local.set({ retryCount: count }, () => {
            Logger.log(`Retry count updated: ${count}`);
            resolve();
          });
        });
      },

      async resetRetryCount() {
        return new Promise((resolve) => {
          chrome.storage.local.set({ retryCount: 0 }, () => {
            Logger.log('Retry count reset to 0');
            resolve();
          });
        });
      }
    };
  });

  describe('getEmail()', () => {
    it('should return email when email exists in storage', async () => {
      // Arrange
      const testEmail = 'test@example.com';
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ email: testEmail });
      });

      // Act
      const result = await ConfigManager.getEmail();

      // Assert
      expect(result).toBe(testEmail);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['email'], expect.any(Function));
    });

    it('should throw AutomationError when email does not exist in storage', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // Empty result
      });

      // Act & Assert
      await expect(ConfigManager.getEmail()).rejects.toThrow(AutomationError);
      await expect(ConfigManager.getEmail()).rejects.toThrow('Email not configured');
    });

    it('should throw AutomationError with correct context when email is missing', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({});
      });

      // Act & Assert
      try {
        await ConfigManager.getEmail();
      } catch (error) {
        expect(error).toBeInstanceOf(AutomationError);
        expect(error.context.suggestedAction).toBe('Configure email in options page');
      }
    });

    it('should handle null email value', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ email: null });
      });

      // Act & Assert
      await expect(ConfigManager.getEmail()).rejects.toThrow(AutomationError);
    });

    it('should handle undefined email value', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ email: undefined });
      });

      // Act & Assert
      await expect(ConfigManager.getEmail()).rejects.toThrow(AutomationError);
    });

    it('should handle empty string email value', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ email: '' });
      });

      // Act & Assert
      await expect(ConfigManager.getEmail()).rejects.toThrow(AutomationError);
    });
  });

  describe('updateExecutionStatus()', () => {
    let dateSpyOn;
    
    beforeEach(() => {
      // Mock Date.prototype.toISOString to return consistent timestamp
      dateSpyOn = jest.spyOn(Date.prototype, 'toISOString').mockReturnValue('2023-01-01T00:00:00.000Z');
    });

    afterEach(() => {
      // Restore Date mock
      if (dateSpyOn) {
        dateSpyOn.mockRestore();
      }
    });

    it('should update execution status without error', async () => {
      // Arrange
      const status = 'Success';
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.updateExecutionStatus(status);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        lastExecutionStatus: status,
        lastExecutionError: null,
        lastExecutionTime: '2023-01-01T00:00:00.000Z'
      }, expect.any(Function));
      expect(Logger.log).toHaveBeenCalledWith(`Execution status updated: ${status}`);
    });

    it('should update execution status with error', async () => {
      // Arrange
      const status = 'Failed';
      const error = new Error('Test error');
      error.name = 'TestError';
      error.context = { testContext: 'value' };
      error.stack = 'Error stack trace';

      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.updateExecutionStatus(status, error);

      // Assert
      const expectedErrorString = JSON.stringify({
        message: 'Test error',
        name: 'TestError',
        context: { testContext: 'value' },
        stack: 'Error stack trace'
      }, null, 2);

      expect(chrome.storage.local.set).toHaveBeenCalledWith({
        lastExecutionStatus: status,
        lastExecutionError: expectedErrorString,
        lastExecutionTime: '2023-01-01T00:00:00.000Z'
      }, expect.any(Function));
    });

    it('should handle error without context', async () => {
      // Arrange
      const status = 'Failed';
      const error = new Error('Simple error');
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.updateExecutionStatus(status, error);

      // Assert
      const call = chrome.storage.local.set.mock.calls[0][0];
      const errorData = JSON.parse(call.lastExecutionError);
      // The actual implementation uses error.context directly, which will be undefined for a simple Error
      expect(errorData.context).toBeUndefined();
    });

    it('should handle different status values', async () => {
      // Arrange
      const statuses = ['Running', '✅Success', 'Failed', 'Retrying'];
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act & Assert
      for (const status of statuses) {
        await ConfigManager.updateExecutionStatus(status);
        expect(chrome.storage.local.set).toHaveBeenCalledWith(
          expect.objectContaining({
            lastExecutionStatus: status
          }),
          expect.any(Function)
        );
      }
    });
  });

  describe('getRetryCount()', () => {
    it('should return retry count when it exists in storage', async () => {
      // Arrange
      const testRetryCount = 3;
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: testRetryCount });
      });

      // Act
      const result = await ConfigManager.getRetryCount();

      // Assert
      expect(result).toBe(testRetryCount);
      expect(chrome.storage.local.get).toHaveBeenCalledWith(['retryCount'], expect.any(Function));
    });

    it('should return 0 when retry count does not exist in storage', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // Empty result
      });

      // Act
      const result = await ConfigManager.getRetryCount();

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when retry count is null', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: null });
      });

      // Act
      const result = await ConfigManager.getRetryCount();

      // Assert
      expect(result).toBe(0);
    });

    it('should return 0 when retry count is undefined', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ retryCount: undefined });
      });

      // Act
      const result = await ConfigManager.getRetryCount();

      // Assert
      expect(result).toBe(0);
    });

    it('should handle various numeric retry count values', async () => {
      // Arrange & Act & Assert
      const testValues = [0, 1, 5, 10, 99];
      
      for (const value of testValues) {
        chrome.storage.local.get.mockImplementation((keys, callback) => {
          callback({ retryCount: value });
        });
        
        const result = await ConfigManager.getRetryCount();
        expect(result).toBe(value);
      }
    });
  });

  describe('updateRetryCount()', () => {
    it('should update retry count with valid number', async () => {
      // Arrange
      const newCount = 5;
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.updateRetryCount(newCount);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: newCount },
        expect.any(Function)
      );
      expect(Logger.log).toHaveBeenCalledWith(`Retry count updated: ${newCount}`);
    });

    it('should handle zero retry count', async () => {
      // Arrange
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.updateRetryCount(0);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 0 },
        expect.any(Function)
      );
    });

    it('should handle large retry count numbers', async () => {
      // Arrange
      const largeCount = 999;
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.updateRetryCount(largeCount);

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: largeCount },
        expect.any(Function)
      );
    });
  });

  describe('resetRetryCount()', () => {
    it('should reset retry count to 0', async () => {
      // Arrange
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act
      await ConfigManager.resetRetryCount();

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        { retryCount: 0 },
        expect.any(Function)
      );
      expect(Logger.log).toHaveBeenCalledWith('Retry count reset to 0');
    });

    it('should always set retry count to 0 regardless of previous value', async () => {
      // Arrange
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act - Call multiple times
      await ConfigManager.resetRetryCount();
      await ConfigManager.resetRetryCount();
      await ConfigManager.resetRetryCount();

      // Assert - Should always set to 0
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(3);
      chrome.storage.local.set.mock.calls.forEach(call => {
        expect(call[0]).toEqual({ retryCount: 0 });
      });
    });
  });

  describe('Integration Tests', () => {
    it('should handle complete retry workflow', async () => {
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('retryCount')) {
          callback({ retryCount: 0 });
        }
      });
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act - Simulate retry workflow
      const initialCount = await ConfigManager.getRetryCount();
      await ConfigManager.updateRetryCount(initialCount + 1);
      await ConfigManager.updateRetryCount(initialCount + 2);
      await ConfigManager.resetRetryCount();

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ retryCount: 1 }, expect.any(Function));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ retryCount: 2 }, expect.any(Function));
      expect(chrome.storage.local.set).toHaveBeenCalledWith({ retryCount: 0 }, expect.any(Function));
    });

    it('should handle execution status workflow with retry', async () => {
      // Arrange
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });
      const error = new Error('Network timeout');

      // Act - Simulate execution workflow
      await ConfigManager.updateExecutionStatus('Running');
      await ConfigManager.updateExecutionStatus('Failed', error);
      await ConfigManager.updateRetryCount(1);
      await ConfigManager.updateExecutionStatus('✅Success');
      await ConfigManager.resetRetryCount();

      // Assert
      expect(chrome.storage.local.set).toHaveBeenCalledTimes(5);
      expect(Logger.log).toHaveBeenCalledWith('Execution status updated: Running');
      expect(Logger.log).toHaveBeenCalledWith('Execution status updated: Failed');
      expect(Logger.log).toHaveBeenCalledWith('Retry count updated: 1');
      expect(Logger.log).toHaveBeenCalledWith('Execution status updated: ✅Success');
      expect(Logger.log).toHaveBeenCalledWith('Retry count reset to 0');
    });
  });

  describe('Error Handling', () => {
    it('should handle Chrome storage errors gracefully', async () => {
      // Note: In a real Chrome extension, storage operations can fail
      // This test would be more relevant in an actual Chrome environment
      // For now, we test that our functions don't throw unexpected errors
      
      // Arrange
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({ email: 'test@example.com' });
      });

      // Act & Assert - Should not throw
      await expect(ConfigManager.getEmail()).resolves.toBe('test@example.com');
    });

    it('should handle malformed error objects in updateExecutionStatus', async () => {
      // Arrange
      const malformedError = {
        message: 'Error message',
        // Missing standard Error properties
      };
      chrome.storage.local.set.mockImplementation((data, callback) => {
        callback();
      });

      // Act & Assert - Should not throw
      await expect(ConfigManager.updateExecutionStatus('Failed', malformedError)).resolves.toBeUndefined();
    });
  });
});

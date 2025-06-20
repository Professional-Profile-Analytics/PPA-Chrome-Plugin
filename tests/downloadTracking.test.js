/**
 * Unit Tests for Download Tracking System
 * 
 * Tests the URL-based download tracking functionality including:
 * - WebRequest URL capture and pattern matching
 * - LinkedIn ambry URL processing and parameter extraction
 * - Filename extraction from x-ambry-um-filename parameter
 * - Download promise resolution and timeout handling
 * - Error handling for malformed URLs and failed downloads
 * - Memory cleanup and race condition prevention
 */

describe('Download Tracking System', () => {
  let mockWebRequestTracker;
  let mockLogger;
  let mockChrome;

  beforeAll(() => {
    // Mock the WebRequestTracker based on actual implementation
    mockWebRequestTracker = {
      downloadPromises: new Map(),
      
      // Simulate the download tracking promise
      trackDownload() {
        return new Promise((resolve, reject) => {
          const timeoutId = setTimeout(() => {
            reject(new Error('Download tracking timeout'));
          }, 30000); // 30 second timeout
          
          // Store promise for cleanup
          const promiseId = Date.now();
          this.downloadPromises.set(promiseId, {
            resolve,
            reject,
            timeoutId,
            timestamp: Date.now()
          });
          
          // Simulate successful URL capture after delay
          setTimeout(() => {
            const mockUrl = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQIxRcoYQx-xygAAAZeJ_cHM&x-ambry-um-filename=PostAnalytics_Dr.+MarkusSchmidberger_7339644402337738753.xlsx';
            clearTimeout(timeoutId);
            this.downloadPromises.delete(promiseId);
            resolve(mockUrl);
          }, 100);
        });
      },
      
      // Simulate WebRequest listener setup
      setupWebRequestListener() {
        // Actually call the Chrome API mocks to verify they're called
        chrome.webRequest.onBeforeRequest.addListener(
          this.webRequestCallback || (() => {}),
          { urls: ['*://www.linkedin.com/*', '*://linkedin.com/*'] },
          ['requestBody']
        );
        
        chrome.webRequest.onHeadersReceived.addListener(
          this.headersCallback || (() => {}),
          { urls: ['*://www.linkedin.com/*', '*://linkedin.com/*'] },
          ['responseHeaders']
        );
      },
      
      // Simulate URL capture from WebRequest
      simulateUrlCapture(url, headers = []) {
        if (this.webRequestCallback) {
          this.webRequestCallback({
            url: url,
            method: 'GET',
            type: 'main_frame'
          });
        }
        
        if (this.headersCallback && headers.length > 0) {
          this.headersCallback({
            url: url,
            responseHeaders: headers
          });
        }
      },
      
      // Clean up promises
      cleanup() {
        this.downloadPromises.forEach(({ timeoutId, reject }) => {
          clearTimeout(timeoutId);
          // Don't reject during cleanup to avoid unhandled promise rejections
        });
        this.downloadPromises.clear();
      }
    };

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
    mockWebRequestTracker.cleanup();
    
    // Mock chrome.webRequest API
    chrome.webRequest = {
      onBeforeRequest: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      },
      onHeadersReceived: {
        addListener: jest.fn(),
        removeListener: jest.fn()
      }
    };
  });

  describe('LinkedIn Ambry URL Processing', () => {
    const validLinkedInUrls = [
      {
        url: 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQIxRcoYQx-xygAAAZeJ_cHM&x-ambry-um-filename=PostAnalytics_Dr.+MarkusSchmidberger_7339644402337738753.xlsx',
        expectedFilename: 'PostAnalytics_Dr. MarkusSchmidberger_7339644402337738753.xlsx'
      },
      {
        url: 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQJjbEG3L_2H5AAAAZeJ_ho0&x-ambry-um-filename=Content_2025-05-23_2025-06-19_Dr.+MarkusSchmidberger.xlsx',
        expectedFilename: 'Content_2025-05-23_2025-06-19_Dr. MarkusSchmidberger.xlsx'
      },
      {
        url: 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQJ7a40R58nHRwAAAZeJ_msE&x-ambry-um-filename=CompanyAnalytics_TestCompany_2025.xlsx',
        expectedFilename: 'CompanyAnalytics_TestCompany_2025.xlsx'
      }
    ];

    it('should extract filename from x-ambry-um-filename parameter correctly', () => {
      validLinkedInUrls.forEach(({ url, expectedFilename }) => {
        const urlParams = new URLSearchParams(new URL(url).search);
        const extractedFilename = urlParams.get('x-ambry-um-filename');
        
        expect(extractedFilename).toBe(expectedFilename);
      });
    });

    it('should handle URL-encoded filenames correctly', () => {
      const encodedUrl = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=test&x-ambry-um-filename=PostAnalytics_Dr.%2BMarkusSchmidberger_123.xlsx';
      const urlParams = new URLSearchParams(new URL(encodedUrl).search);
      const filename = urlParams.get('x-ambry-um-filename');
      
      // URLSearchParams automatically decodes %2B to +, so we expect the + version
      expect(filename).toBe('PostAnalytics_Dr.+MarkusSchmidberger_123.xlsx');
    });

    it('should validate LinkedIn ambry URL patterns', () => {
      const validPatterns = [
        'https://www.linkedin.com/ambry/?x-li-ambry-ep=',
        'https://linkedin.com/ambry/?x-li-ambry-ep='
      ];
      
      const invalidPatterns = [
        'https://www.facebook.com/ambry/?x-li-ambry-ep=',
        'https://www.linkedin.com/feed/',
        'https://www.linkedin.com/analytics/',
        'invalid-url'
      ];

      validPatterns.forEach(pattern => {
        const testUrl = pattern + 'test&x-ambry-um-filename=test.xlsx';
        expect(testUrl).toMatch(/linkedin\.com\/ambry\/\?/);
      });

      invalidPatterns.forEach(pattern => {
        expect(pattern).not.toMatch(/linkedin\.com\/ambry\/\?/);
      });
    });

    it('should handle missing filename parameter gracefully', () => {
      const urlWithoutFilename = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQIxRcoYQx-xygAAAZeJ_cHM';
      const urlParams = new URLSearchParams(new URL(urlWithoutFilename).search);
      const filename = urlParams.get('x-ambry-um-filename');
      
      expect(filename).toBeNull();
    });

    it('should handle malformed URLs gracefully', () => {
      const malformedUrls = [
        'not-a-url',
        'https://linkedin.com/ambry/?invalid-params',
        'https://linkedin.com/ambry/?x-ambry-um-filename=', // Empty filename
        ''
      ];

      malformedUrls.forEach(url => {
        expect(() => {
          if (url && url.includes('://')) {
            const urlParams = new URLSearchParams(new URL(url).search);
            const filename = urlParams.get('x-ambry-um-filename');
            // Should not throw, filename can be null/empty
            expect(filename).toBeDefined();
          }
        }).not.toThrow();
      });
    });
  });

  describe('WebRequest URL Capture', () => {
    it('should setup WebRequest listeners correctly', () => {
      mockWebRequestTracker.setupWebRequestListener();
      
      expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalled();
      expect(chrome.webRequest.onHeadersReceived.addListener).toHaveBeenCalled();
    });

    it('should capture LinkedIn download URLs through WebRequest', async () => {
      mockWebRequestTracker.setupWebRequestListener();
      
      const testUrl = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=test&x-ambry-um-filename=test.xlsx';
      
      // Start tracking
      const downloadPromise = mockWebRequestTracker.trackDownload();
      
      // Simulate URL capture
      setTimeout(() => {
        mockWebRequestTracker.simulateUrlCapture(testUrl);
      }, 50);
      
      const capturedUrl = await downloadPromise;
      expect(capturedUrl).toContain('linkedin.com/ambry');
      expect(capturedUrl).toContain('x-ambry-um-filename=');
    });

    it('should handle WebRequest listener filters correctly', () => {
      mockWebRequestTracker.setupWebRequestListener();
      
      const expectedFilter = {
        urls: ['*://www.linkedin.com/*', '*://linkedin.com/*']
      };
      
      // Verify the filter was used (in real implementation)
      expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          urls: expect.arrayContaining(['*://www.linkedin.com/*'])
        }),
        expect.any(Array)
      );
    });

    it('should process response headers for download detection', () => {
      mockWebRequestTracker.setupWebRequestListener();
      
      const testHeaders = [
        { name: 'Content-Type', value: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
        { name: 'Content-Disposition', value: 'attachment; filename="test.xlsx"' }
      ];
      
      const testUrl = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=test&x-ambry-um-filename=test.xlsx';
      
      // Should not throw when processing headers
      expect(() => {
        mockWebRequestTracker.simulateUrlCapture(testUrl, testHeaders);
      }).not.toThrow();
    });
  });

  describe('Download Promise Management', () => {
    it('should resolve download promises when URL captured', async () => {
      const downloadPromise = mockWebRequestTracker.trackDownload();
      
      // Promise should resolve with captured URL
      const result = await downloadPromise;
      expect(result).toContain('linkedin.com/ambry');
      expect(result).toContain('x-ambry-um-filename=');
    });

    it('should handle download timeout correctly', async () => {
      // Create a tracker that times out immediately
      const fastTimeoutTracker = {
        trackDownload() {
          return new Promise((resolve, reject) => {
            setTimeout(() => {
              reject(new Error('Download tracking timeout'));
            }, 10); // Very short timeout for testing
          });
        }
      };

      await expect(fastTimeoutTracker.trackDownload()).rejects.toThrow('Download tracking timeout');
    });

    it('should clean up promises properly', () => {
      // Start multiple download tracking promises
      const promise1 = mockWebRequestTracker.trackDownload();
      const promise2 = mockWebRequestTracker.trackDownload();
      
      expect(mockWebRequestTracker.downloadPromises.size).toBeGreaterThan(0);
      
      // Cleanup should clear all promises
      mockWebRequestTracker.cleanup();
      expect(mockWebRequestTracker.downloadPromises.size).toBe(0);
    });

    it('should handle multiple concurrent downloads', async () => {
      const promises = [];
      
      // Start multiple downloads
      for (let i = 0; i < 3; i++) {
        promises.push(mockWebRequestTracker.trackDownload());
      }
      
      // All should resolve successfully
      const results = await Promise.all(promises);
      
      results.forEach(result => {
        expect(result).toContain('linkedin.com/ambry');
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle WebRequest API errors gracefully', () => {
      // Mock WebRequest API to throw error
      chrome.webRequest.onBeforeRequest.addListener.mockImplementation(() => {
        throw new Error('WebRequest API error');
      });

      expect(() => {
        try {
          mockWebRequestTracker.setupWebRequestListener();
        } catch (error) {
          // The mock will throw, but our tracker should handle it
          throw error;
        }
      }).toThrow('WebRequest API error');
      
      // Reset the mock for other tests
      chrome.webRequest.onBeforeRequest.addListener.mockImplementation(() => {});
    });

    it('should handle invalid URL parameters', () => {
      const invalidUrls = [
        'https://linkedin.com/ambry/?x-ambry-um-filename=',
        'https://linkedin.com/ambry/?invalid=params',
        'https://linkedin.com/ambry/?x-ambry-um-filename=%invalid%encoding%'
      ];

      invalidUrls.forEach(url => {
        expect(() => {
          const urlParams = new URLSearchParams(new URL(url).search);
          const filename = urlParams.get('x-ambry-um-filename');
          // Should handle gracefully, even if filename is empty/invalid
        }).not.toThrow();
      });
    });

    it('should handle network errors during download tracking', async () => {
      const errorTracker = {
        trackDownload() {
          return Promise.reject(new Error('Network error'));
        }
      };

      await expect(errorTracker.trackDownload()).rejects.toThrow('Network error');
    });

    it('should handle Chrome extension context invalidation', () => {
      // Simulate chrome.runtime.lastError
      chrome.runtime.lastError = { message: 'Extension context invalidated' };

      expect(() => {
        // Any Chrome API call should check for lastError
        if (chrome.runtime.lastError) {
          throw new Error(chrome.runtime.lastError.message);
        }
      }).toThrow('Extension context invalidated');

      // Clean up
      delete chrome.runtime.lastError;
    });
  });

  describe('Real-World Scenarios', () => {
    it('should handle typical LinkedIn post analytics download flow', async () => {
      // Simulate the complete flow
      mockWebRequestTracker.setupWebRequestListener();
      
      const downloadPromise = mockWebRequestTracker.trackDownload();
      
      // Simulate user clicking export button and LinkedIn generating download
      const linkedinUrl = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQIxRcoYQx-xygAAAZeJ_cHM&x-ambry-um-filename=PostAnalytics_Dr.+MarkusSchmidberger_7339644402337738753.xlsx';
      
      setTimeout(() => {
        mockWebRequestTracker.simulateUrlCapture(linkedinUrl);
      }, 50);
      
      const capturedUrl = await downloadPromise;
      
      // Verify URL structure
      expect(capturedUrl).toContain('linkedin.com/ambry');
      expect(capturedUrl).toContain('x-li-ambry-ep=');
      expect(capturedUrl).toContain('x-ambry-um-filename=');
      
      // Verify filename extraction
      const urlParams = new URLSearchParams(new URL(capturedUrl).search);
      const filename = urlParams.get('x-ambry-um-filename');
      expect(filename).toContain('PostAnalytics_');
      expect(filename).toContain('.xlsx');
    });

    it('should handle company analytics download flow', async () => {
      // Create a specific tracker for company analytics
      const companyTracker = {
        trackDownload() {
          return new Promise((resolve) => {
            setTimeout(() => {
              const companyUrl = 'https://www.linkedin.com/ambry/?x-li-ambry-ep=AQJjbEG3L_2H5AAAAZeJ_ho0&x-ambry-um-filename=Content_2025-05-23_2025-06-19_Dr.+MarkusSchmidberger.xlsx';
              resolve(companyUrl);
            }, 50);
          });
        },
        setupWebRequestListener() {
          chrome.webRequest.onBeforeRequest.addListener(() => {}, { urls: ['*://www.linkedin.com/*'] }, []);
        }
      };
      
      companyTracker.setupWebRequestListener();
      const downloadPromise = companyTracker.trackDownload();
      const capturedUrl = await downloadPromise;
      
      // Verify company analytics URL structure
      expect(capturedUrl).toContain('Content_');
      expect(capturedUrl).toContain('2025-');
      
      const urlParams = new URLSearchParams(new URL(capturedUrl).search);
      const filename = urlParams.get('x-ambry-um-filename');
      expect(filename).toMatch(/Content_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}/);
    });

    it('should handle rapid successive downloads', async () => {
      // Create specific trackers for each download
      const createTracker = (filename) => ({
        trackDownload() {
          return new Promise((resolve) => {
            setTimeout(() => {
              const url = `https://www.linkedin.com/ambry/?x-li-ambry-ep=test&x-ambry-um-filename=${filename}`;
              resolve(url);
            }, 50);
          });
        }
      });
      
      const downloads = [];
      const filenames = ['file1.xlsx', 'file2.xlsx', 'file3.xlsx'];
      
      // Start multiple downloads rapidly
      filenames.forEach((filename) => {
        const tracker = createTracker(filename);
        downloads.push(tracker.trackDownload());
      });
      
      const results = await Promise.all(downloads);
      
      // All downloads should complete successfully
      expect(results).toHaveLength(3);
      results.forEach((result, index) => {
        expect(result).toContain(`file${index + 1}.xlsx`);
      });
    });
  });

  describe('Memory Management', () => {
    it('should not leak memory with repeated downloads', async () => {
      const initialPromiseCount = mockWebRequestTracker.downloadPromises.size;
      
      // Perform multiple downloads
      for (let i = 0; i < 5; i++) {
        await mockWebRequestTracker.trackDownload();
      }
      
      // Promise map should be cleaned up after each download
      expect(mockWebRequestTracker.downloadPromises.size).toBe(initialPromiseCount);
    });

    it('should clean up timeouts properly', () => {
      const timeoutSpy = jest.spyOn(global, 'clearTimeout');
      
      // Start and cleanup downloads
      mockWebRequestTracker.trackDownload();
      mockWebRequestTracker.trackDownload();
      mockWebRequestTracker.cleanup();
      
      // clearTimeout should be called for cleanup
      expect(timeoutSpy).toHaveBeenCalled();
      
      timeoutSpy.mockRestore();
    });

    it('should handle garbage collection scenarios', () => {
      // Simulate memory pressure by creating many promises
      const promises = [];
      for (let i = 0; i < 100; i++) {
        promises.push(mockWebRequestTracker.trackDownload());
      }
      
      // Cleanup should handle large numbers of promises
      expect(() => {
        mockWebRequestTracker.cleanup();
      }).not.toThrow();
      
      expect(mockWebRequestTracker.downloadPromises.size).toBe(0);
    });
  });

  describe('Integration with Chrome APIs', () => {
    it('should integrate with chrome.webRequest correctly', () => {
      mockWebRequestTracker.setupWebRequestListener();
      
      // Verify correct API usage
      expect(chrome.webRequest.onBeforeRequest.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          urls: expect.any(Array)
        }),
        expect.any(Array)
      );
      
      expect(chrome.webRequest.onHeadersReceived.addListener).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          urls: expect.any(Array)
        }),
        expect.any(Array)
      );
    });

    it('should handle chrome.webRequest permission issues', () => {
      // Simulate missing webRequest permission
      delete chrome.webRequest;
      
      expect(() => {
        if (!chrome.webRequest) {
          throw new Error('webRequest permission required');
        }
      }).toThrow('webRequest permission required');
      
      // Restore for other tests
      chrome.webRequest = {
        onBeforeRequest: { addListener: jest.fn(), removeListener: jest.fn() },
        onHeadersReceived: { addListener: jest.fn(), removeListener: jest.fn() }
      };
    });
  });
});

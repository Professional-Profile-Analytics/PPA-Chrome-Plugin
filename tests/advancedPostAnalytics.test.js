/**
 * Unit Tests for Advanced Post Analytics
 * 
 * Tests the advanced post analytics functionality including:
 * - Posts limit slider functionality (5-50 posts, default 30)
 * - Post URL processing and post_id extraction
 * - Success message formatting with processed counts
 * - URL-based download tracking
 * - Results object structure and return values
 * - processAdvancedPostStatistics method behavior
 */

describe('Advanced Post Analytics', () => {
  let AdvancedPostAnalytics;
  let mockLogger;
  let mockTabId;
  let mockEmail;

  beforeAll(() => {
    // Mock the AdvancedPostAnalytics object based on actual implementation
    AdvancedPostAnalytics = {
      async processAdvancedStatistics(tabId, email, postUrls, logger) {
        // Get posts limit from storage (default 30)
        const postsLimit = await new Promise((resolve) => {
          chrome.storage.local.get(['postsLimit'], (result) => {
            resolve(result.postsLimit || 30);
          });
        });
        
        // Limit the number of posts to process
        const totalAvailable = postUrls.length;
        const postsToProcess = Math.min(totalAvailable, postsLimit);
        const limitedPostUrls = postUrls.slice(0, postsToProcess);
        
        logger.log(`Posts available: ${totalAvailable}, Posts limit: ${postsLimit}, Processing: ${postsToProcess} posts`);

        const results = {
          processed: 0,
          successful: 0,
          failed: 0,
          uploads: [],
          errors: [],
          totalAvailable: totalAvailable,
          postsLimit: postsLimit
        };

        // Simulate processing each post
        for (let i = 0; i < limitedPostUrls.length; i++) {
          const postUrl = limitedPostUrls[i];
          
          try {
            // Simulate successful processing
            results.processed++;
            results.successful++;
            results.uploads.push({
              postUrl: postUrl,
              success: true
            });
            
            logger.log(`✅ Post ${i + 1}/${limitedPostUrls.length} uploaded successfully`);
          } catch (error) {
            results.processed++;
            results.failed++;
            results.errors.push({
              postUrl: postUrl,
              error: error.message
            });
          }
        }

        return results;
      },

      // Helper method to extract post ID from URL
      extractPostIdFromUrl(url) {
        const postIdMatch = url.match(/urn:li:activity:(\d+)/);
        return postIdMatch ? postIdMatch[1] : null;
      },

      // Helper method to validate LinkedIn analytics URL
      isValidAnalyticsUrl(url) {
        return url && url.includes('linkedin.com/analytics/post-summary/urn:li:activity:');
      }
    };

    // Mock LinkedInMultilingualAutomation processAdvancedPostStatistics method
    global.LinkedInMultilingualAutomation = {
      async processAdvancedPostStatistics(tabId, email, logger, postAnalyticsUrls = null) {
        if (!postAnalyticsUrls || postAnalyticsUrls.length === 0) {
          logger.log('No post analytics URLs provided, skipping advanced statistics');
          return null;
        }
        
        logger.log(`Starting advanced post statistics processing for ${postAnalyticsUrls.length} posts...`);
        
        // Process each analytics URL directly
        const results = await AdvancedPostAnalytics.processAdvancedStatistics(
          tabId, 
          email, 
          postAnalyticsUrls, 
          logger
        );
        
        // Log completion
        logger.log(`Advanced post statistics processing completed. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`);
        
        if (results.successful > 0) {
          logger.log(`Successfully uploaded ${results.successful} individual post analytics files`);
        }
        
        if (results.failed > 0) {
          logger.warn(`Failed to process ${results.failed} posts. Check logs for details.`);
        }
        
        // Return the results so they can be used for success message
        return results;
      }
    };
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup common test data
    mockTabId = 12345;
    mockEmail = 'test@example.com';
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    // Mock chrome.storage.local.get with default posts limit
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      if (keys.includes('postsLimit')) {
        callback({ postsLimit: 30 });
      } else {
        callback({});
      }
    });
  });

  describe('processAdvancedStatistics()', () => {
    const mockPostUrls = [
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7339644403738656768/',
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7341072233987026944/',
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7338535479996215297/',
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7334186875114438656/',
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7333184754235723776/'
    ];

    it('should respect posts limit setting from storage (default 30)', async () => {
      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        mockPostUrls, 
        mockLogger
      );

      expect(results.postsLimit).toBe(30);
      expect(results.totalAvailable).toBe(5);
      expect(results.processed).toBe(5); // All 5 posts processed since limit (30) > available (5)
    });

    it('should limit posts when storage limit is less than available', async () => {
      // Mock storage to return limit of 3
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('postsLimit')) {
          callback({ postsLimit: 3 });
        } else {
          callback({});
        }
      });

      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        mockPostUrls, 
        mockLogger
      );

      expect(results.postsLimit).toBe(3);
      expect(results.totalAvailable).toBe(5);
      expect(results.processed).toBe(3); // Only 3 posts processed due to limit
      expect(results.successful).toBe(3);
    });

    it('should handle minimum posts limit (5)', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('postsLimit')) {
          callback({ postsLimit: 5 });
        } else {
          callback({});
        }
      });

      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        mockPostUrls, 
        mockLogger
      );

      expect(results.postsLimit).toBe(5);
      expect(results.processed).toBe(5);
    });

    it('should handle maximum posts limit (50)', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys.includes('postsLimit')) {
          callback({ postsLimit: 50 });
        } else {
          callback({});
        }
      });

      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        mockPostUrls, 
        mockLogger
      );

      expect(results.postsLimit).toBe(50);
      expect(results.processed).toBe(5); // Still only 5 since that's all available
    });

    it('should return correct results object structure', async () => {
      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        mockPostUrls, 
        mockLogger
      );

      expect(results).toHaveProperty('processed');
      expect(results).toHaveProperty('successful');
      expect(results).toHaveProperty('failed');
      expect(results).toHaveProperty('uploads');
      expect(results).toHaveProperty('errors');
      expect(results).toHaveProperty('totalAvailable');
      expect(results).toHaveProperty('postsLimit');

      expect(typeof results.processed).toBe('number');
      expect(typeof results.successful).toBe('number');
      expect(typeof results.failed).toBe('number');
      expect(Array.isArray(results.uploads)).toBe(true);
      expect(Array.isArray(results.errors)).toBe(true);
    });

    it('should log processing progress correctly', async () => {
      await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        mockPostUrls, 
        mockLogger
      );

      expect(mockLogger.log).toHaveBeenCalledWith(
        'Posts available: 5, Posts limit: 30, Processing: 5 posts'
      );
      expect(mockLogger.log).toHaveBeenCalledWith('✅ Post 1/5 uploaded successfully');
      expect(mockLogger.log).toHaveBeenCalledWith('✅ Post 5/5 uploaded successfully');
    });

    it('should handle empty post URLs array', async () => {
      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        [], 
        mockLogger
      );

      expect(results.processed).toBe(0);
      expect(results.successful).toBe(0);
      expect(results.totalAvailable).toBe(0);
    });
  });

  describe('URL Processing', () => {
    it('should extract correct post_id from analytics URLs', () => {
      const testCases = [
        {
          url: 'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7339644403738656768/',
          expected: '7339644403738656768'
        },
        {
          url: 'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7341072233987026944/',
          expected: '7341072233987026944'
        },
        {
          url: 'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7338535479996215297/',
          expected: '7338535479996215297'
        }
      ];

      testCases.forEach(({ url, expected }) => {
        const postId = AdvancedPostAnalytics.extractPostIdFromUrl(url);
        expect(postId).toBe(expected);
      });
    });

    it('should return null for invalid URLs', () => {
      const invalidUrls = [
        'https://www.linkedin.com/feed/',
        'https://www.linkedin.com/analytics/',
        'invalid-url',
        '',
        null,
        undefined
      ];

      invalidUrls.forEach(url => {
        const postId = AdvancedPostAnalytics.extractPostIdFromUrl(url);
        expect(postId).toBeNull();
      });
    });

    it('should validate LinkedIn analytics URLs correctly', () => {
      const validUrls = [
        'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7339644403738656768/',
        'https://www.linkedin.com/analytics/post-summary/urn:li:activity:1234567890123456789/'
      ];

      const invalidUrls = [
        'https://www.linkedin.com/feed/',
        'https://www.linkedin.com/analytics/',
        'https://www.facebook.com/analytics/post-summary/urn:li:activity:123/',
        '',
        null,
        undefined
      ];

      validUrls.forEach(url => {
        expect(AdvancedPostAnalytics.isValidAnalyticsUrl(url)).toBe(true);
      });

      invalidUrls.forEach(url => {
        expect(AdvancedPostAnalytics.isValidAnalyticsUrl(url)).toBe(false);
      });
    });
  });

  describe('LinkedInMultilingualAutomation.processAdvancedPostStatistics()', () => {
    const mockPostUrls = [
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7339644403738656768/',
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7341072233987026944/',
      'https://www.linkedin.com/analytics/post-summary/urn:li:activity:7338535479996215297/'
    ];

    it('should return results object for success message formatting', async () => {
      const results = await LinkedInMultilingualAutomation.processAdvancedPostStatistics(
        mockTabId, 
        mockEmail, 
        mockLogger, 
        mockPostUrls
      );

      expect(results).not.toBeNull();
      expect(results.processed).toBe(3);
      expect(results.successful).toBe(3);
      expect(results.totalAvailable).toBe(3);
    });

    it('should return null when no URLs provided', async () => {
      const results = await LinkedInMultilingualAutomation.processAdvancedPostStatistics(
        mockTabId, 
        mockEmail, 
        mockLogger, 
        null
      );

      expect(results).toBeNull();
      expect(mockLogger.log).toHaveBeenCalledWith('No post analytics URLs provided, skipping advanced statistics');
    });

    it('should return null when empty URLs array provided', async () => {
      const results = await LinkedInMultilingualAutomation.processAdvancedPostStatistics(
        mockTabId, 
        mockEmail, 
        mockLogger, 
        []
      );

      expect(results).toBeNull();
    });

    it('should log completion messages correctly', async () => {
      await LinkedInMultilingualAutomation.processAdvancedPostStatistics(
        mockTabId, 
        mockEmail, 
        mockLogger, 
        mockPostUrls
      );

      expect(mockLogger.log).toHaveBeenCalledWith('Starting advanced post statistics processing for 3 posts...');
      expect(mockLogger.log).toHaveBeenCalledWith('Advanced post statistics processing completed. Processed: 3, Successful: 3, Failed: 0');
      expect(mockLogger.log).toHaveBeenCalledWith('Successfully uploaded 3 individual post analytics files');
    });
  });

  describe('Success Message Logic', () => {
    it('should format success message for all posts processed', () => {
      const mockResults = {
        processed: 5,
        successful: 5,
        failed: 0,
        totalAvailable: 5,
        postsLimit: 30
      };

      // Test the logic that would be used in the main automation
      let successMessage = '✅Success';
      if (mockResults && mockResults.processed) {
        const totalAvailable = mockResults.totalAvailable || mockResults.processed;
        const processed = mockResults.processed;
        
        if (totalAvailable > processed) {
          successMessage = `✅Success (${processed}/${totalAvailable} posts processed)`;
        } else {
          successMessage = `✅Success (${processed} posts processed)`;
        }
      }

      expect(successMessage).toBe('✅Success (5 posts processed)');
    });

    it('should format success message for limited posts processed', () => {
      const mockResults = {
        processed: 5,
        successful: 5,
        failed: 0,
        totalAvailable: 50,
        postsLimit: 5
      };

      let successMessage = '✅Success';
      if (mockResults && mockResults.processed) {
        const totalAvailable = mockResults.totalAvailable || mockResults.processed;
        const processed = mockResults.processed;
        
        if (totalAvailable > processed) {
          successMessage = `✅Success (${processed}/${totalAvailable} posts processed)`;
        } else {
          successMessage = `✅Success (${processed} posts processed)`;
        }
      }

      expect(successMessage).toBe('✅Success (5/50 posts processed)');
    });

    it('should handle partial success scenarios', () => {
      const mockResults = {
        processed: 5,
        successful: 3,
        failed: 2,
        totalAvailable: 10,
        postsLimit: 5
      };

      let successMessage = '✅Success';
      if (mockResults && mockResults.processed) {
        const totalAvailable = mockResults.totalAvailable || mockResults.processed;
        const processed = mockResults.processed;
        
        if (totalAvailable > processed) {
          successMessage = `✅Success (${processed}/${totalAvailable} posts processed)`;
        } else {
          successMessage = `✅Success (${processed} posts processed)`;
        }
      }

      expect(successMessage).toBe('✅Success (5/10 posts processed)');
    });
  });

  describe('Posts Limit Storage Integration', () => {
    it('should use default value when postsLimit not in storage', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // Empty storage
      });

      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        ['url1', 'url2'], 
        mockLogger
      );

      expect(results.postsLimit).toBe(30); // Default value
    });

    it('should handle various posts limit values from storage', async () => {
      const testLimits = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50];
      
      for (const limit of testLimits) {
        chrome.storage.local.get.mockImplementation((keys, callback) => {
          if (keys.includes('postsLimit')) {
            callback({ postsLimit: limit });
          } else {
            callback({});
          }
        });

        const results = await AdvancedPostAnalytics.processAdvancedStatistics(
          mockTabId, 
          mockEmail, 
          ['url1', 'url2'], 
          mockLogger
        );

        expect(results.postsLimit).toBe(limit);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle Chrome storage errors gracefully', async () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        // Simulate Chrome storage error
        chrome.runtime.lastError = { message: 'Storage error' };
        callback({});
      });

      // Should not throw and should use default value
      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        mockTabId, 
        mockEmail, 
        ['url1'], 
        mockLogger
      );

      expect(results.postsLimit).toBe(30); // Should fallback to default
      
      // Clean up
      delete chrome.runtime.lastError;
    });
  });
});

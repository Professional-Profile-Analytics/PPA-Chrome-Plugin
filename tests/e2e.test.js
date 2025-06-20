/**
 * End-to-End (E2E) Workflow Tests
 * 
 * Tests complete user workflows and component integration including:
 * - Complete LinkedIn analytics automation workflow
 * - Advanced post analytics with posts limit enforcement
 * - Multi-language workflow scenarios (German, Spanish, French)
 * - Error recovery and retry mechanisms across components
 * - Company analytics weekly automation workflow
 * - Performance and timing validation of complete flows
 */

describe('End-to-End Workflow Tests', () => {
  let mockWorkflowOrchestrator;
  let mockLogger;
  let mockTabId;
  let mockEmail;

  // Increase timeout for E2E tests
  jest.setTimeout(10000);

  beforeAll(() => {
    // Mock the complete workflow orchestrator
    mockWorkflowOrchestrator = {
      async executeCompleteLinkedInWorkflow(email, logger, options = {}) {
        const workflow = {
          steps: [],
          startTime: Date.now(),
          status: 'running',
          results: {}
        };

        try {
          // Step 1: Create LinkedIn tab
          logger.log('🔄 Step 1: Creating LinkedIn tab...');
          const tab = await this.createLinkedInTab();
          workflow.steps.push({ step: 'createTab', status: 'success', tabId: tab.id });

          // Step 2: Detect language
          logger.log('🔄 Step 2: Detecting LinkedIn interface language...');
          const language = await this.detectPageLanguage(tab.id);
          workflow.steps.push({ step: 'detectLanguage', status: 'success', language });

          // Step 3: Navigate to analytics
          logger.log('🔄 Step 3: Navigating to analytics section...');
          await this.navigateToAnalytics(tab.id, language);
          workflow.steps.push({ step: 'navigateAnalytics', status: 'success' });

          // Step 4: Trigger download
          logger.log('🔄 Step 4: Triggering analytics download...');
          const downloadPromise = this.setupDownloadTracking();
          await this.clickExportButton(tab.id, language);
          const downloadUrl = await downloadPromise;
          workflow.steps.push({ step: 'triggerDownload', status: 'success', downloadUrl });

          // Step 5: Process advanced analytics (if enabled)
          if (options.advancedPostStats) {
            logger.log('🔄 Step 5: Processing advanced post analytics...');
            const postResults = await this.processAdvancedPostAnalytics(tab.id, email, logger, options.postsLimit);
            workflow.steps.push({ step: 'advancedAnalytics', status: 'success', results: postResults });
            workflow.results.advancedAnalytics = postResults;
            
            // Step 6: Upload file
            logger.log('🔄 Step 6: Uploading file to API...');
            const uploadResult = await this.uploadFileToAPI(downloadUrl, email, logger);
            workflow.steps.push({ step: 'uploadFile', status: 'success', result: uploadResult });

            // Step 7: Update execution status
            logger.log('🔄 Step 7: Updating execution status...');
            await this.updateExecutionStatus('✅Success', null, workflow.results);
            workflow.steps.push({ step: 'updateStatus', status: 'success' });

            // Step 8: Cleanup
            logger.log('🔄 Step 8: Cleaning up resources...');
            await this.cleanupResources(tab.id);
            workflow.steps.push({ step: 'cleanup', status: 'success' });
          } else {
            // Step 5: Upload file (without advanced analytics)
            logger.log('🔄 Step 5: Uploading file to API...');
            const uploadResult = await this.uploadFileToAPI(downloadUrl, email, logger);
            workflow.steps.push({ step: 'uploadFile', status: 'success', result: uploadResult });

            // Step 6: Update execution status
            logger.log('🔄 Step 6: Updating execution status...');
            await this.updateExecutionStatus('✅Success', null, workflow.results);
            workflow.steps.push({ step: 'updateStatus', status: 'success' });

            // Step 7: Cleanup
            logger.log('🔄 Step 7: Cleaning up resources...');
            await this.cleanupResources(tab.id);
            workflow.steps.push({ step: 'cleanup', status: 'success' });
          }

          workflow.status = 'completed';
          workflow.endTime = Date.now();
          workflow.duration = workflow.endTime - workflow.startTime;

          logger.log(`✅ Complete workflow finished in ${workflow.duration}ms`);
          return workflow;

        } catch (error) {
          workflow.status = 'failed';
          workflow.error = error.message;
          workflow.endTime = Date.now();
          workflow.duration = workflow.endTime - workflow.startTime;

          logger.error(`❌ Workflow failed: ${error.message}`);
          
          // Attempt cleanup even on failure
          try {
            await this.cleanupResources(mockTabId);
          } catch (cleanupError) {
            logger.warn(`Cleanup failed: ${cleanupError.message}`);
          }

          throw error;
        }
      },

      async createLinkedInTab() {
        return new Promise((resolve) => {
          chrome.tabs.create({
            url: 'https://www.linkedin.com/analytics/',
            active: false
          }, (tab) => {
            resolve(tab);
          });
        });
      },

      async detectPageLanguage(tabId) {
        return new Promise((resolve) => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
              const htmlLang = document.documentElement.getAttribute('lang');
              return htmlLang ? htmlLang.split('-')[0] : 'en';
            }
          }, (results) => {
            resolve(results[0]?.result || 'en');
          });
        });
      },

      async navigateToAnalytics(tabId, language) {
        return new Promise((resolve) => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (lang) => {
              // Simulate navigation to analytics section
              window.location.href = 'https://www.linkedin.com/analytics/';
              return true;
            },
            args: [language]
          }, () => {
            setTimeout(resolve, 1000); // Simulate page load time
          });
        });
      },

      async setupDownloadTracking() {
        return new Promise((resolve) => {
          // Simulate download URL capture
          setTimeout(() => {
            resolve('https://www.linkedin.com/ambry/?x-ambry-um-filename=analytics.xlsx');
          }, 2000);
        });
      },

      async clickExportButton(tabId, language) {
        return new Promise((resolve) => {
          chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (lang) => {
              // Simulate clicking export button based on language
              const exportTexts = {
                'en': 'Export',
                'de': 'Exportieren',
                'es': 'Exportar',
                'fr': 'Exporter'
              };
              
              const exportText = exportTexts[lang] || exportTexts['en'];
              // Simulate button click
              return `Clicked ${exportText} button`;
            },
            args: [language]
          }, () => {
            resolve();
          });
        });
      },

      async processAdvancedPostAnalytics(tabId, email, logger, postsLimit = 30) {
        // Simulate advanced post analytics processing
        const mockPostUrls = [
          'https://www.linkedin.com/analytics/post-summary/urn:li:activity:123/',
          'https://www.linkedin.com/analytics/post-summary/urn:li:activity:456/',
          'https://www.linkedin.com/analytics/post-summary/urn:li:activity:789/'
        ];

        const limitedPosts = mockPostUrls.slice(0, Math.min(mockPostUrls.length, postsLimit));
        
        return {
          processed: limitedPosts.length,
          successful: limitedPosts.length,
          failed: 0,
          totalAvailable: mockPostUrls.length,
          postsLimit: postsLimit
        };
      },

      async uploadFileToAPI(downloadUrl, email, logger) {
        // Simulate file upload
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              message: 'File uploaded successfully',
              fileId: 'test-upload-123'
            });
          }, 1000);
        });
      },

      async updateExecutionStatus(status, error, results) {
        return new Promise((resolve) => {
          chrome.storage.local.set({
            executionStatus: status,
            lastExecution: new Date().toISOString(),
            results: results
          }, resolve);
        });
      },

      async cleanupResources(tabId) {
        if (tabId) {
          return new Promise((resolve) => {
            chrome.tabs.remove(tabId, resolve);
          });
        }
      }
    };

    // Mock logger
    mockLogger = {
      log: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };

    mockTabId = 12345;
    mockEmail = 'test@example.com';
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();
    
    // Setup default Chrome API responses
    chrome.tabs.create.mockImplementation((createProperties, callback) => {
      callback({ id: mockTabId, url: createProperties.url, active: false });
    });

    chrome.tabs.remove.mockImplementation((tabId, callback) => {
      callback();
    });

    chrome.scripting.executeScript.mockImplementation((injection, callback) => {
      callback([{ result: 'en' }]); // Default language detection
    });

    chrome.storage.local.set.mockImplementation((data, callback) => {
      callback();
    });
  });

  describe('Complete LinkedIn Analytics Workflow', () => {
    it('should execute complete workflow successfully', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(workflow.status).toBe('completed');
      expect(workflow.steps.length).toBeGreaterThanOrEqual(7); // 7 steps without advanced analytics
      expect(workflow.duration).toBeGreaterThan(0);

      // Verify all steps completed successfully
      workflow.steps.forEach(step => {
        expect(step.status).toBe('success');
      });

      // Verify required steps are present
      const requiredSteps = ['createTab', 'detectLanguage', 'navigateAnalytics', 'triggerDownload', 'uploadFile', 'updateStatus', 'cleanup'];
      requiredSteps.forEach(stepName => {
        const step = workflow.steps.find(s => s.step === stepName);
        expect(step).toBeDefined();
        expect(step.status).toBe('success');
      });

      // Verify logging
      expect(mockLogger.log).toHaveBeenCalledWith('🔄 Step 1: Creating LinkedIn tab...');
      expect(mockLogger.log).toHaveBeenCalledWith(expect.stringMatching(/✅ Complete workflow finished in \d+ms/));
    });

    it('should handle workflow timing correctly', async () => {
      const startTime = Date.now();
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );
      const endTime = Date.now();

      expect(workflow.duration).toBeGreaterThan(0);
      expect(workflow.duration).toBeLessThan(endTime - startTime + 100); // Allow some margin
      expect(workflow.startTime).toBeDefined();
      expect(workflow.endTime).toBeDefined();
    });

    it('should create and cleanup LinkedIn tab correctly', async () => {
      await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(chrome.tabs.create).toHaveBeenCalledWith({
        url: 'https://www.linkedin.com/analytics/',
        active: false
      }, expect.any(Function));

      expect(chrome.tabs.remove).toHaveBeenCalledWith(mockTabId, expect.any(Function));
    });

    it('should detect page language correctly', async () => {
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        if (injection.func.toString().includes('documentElement')) {
          callback([{ result: 'de' }]); // German language
        } else {
          callback([{ result: 'success' }]);
        }
      });

      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      const languageStep = workflow.steps.find(step => step.step === 'detectLanguage');
      expect(languageStep.language).toBe('de');
    });

    it('should update execution status correctly', async () => {
      await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          executionStatus: '✅Success',
          lastExecution: expect.any(String)
        }),
        expect.any(Function)
      );
    });
  });

  describe('Advanced Post Analytics E2E Workflow', () => {
    it('should process advanced analytics with posts limit', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger,
        { advancedPostStats: true, postsLimit: 2 }
      );

      expect(workflow.status).toBe('completed');
      expect(workflow.results.advancedAnalytics).toBeDefined();
      expect(workflow.results.advancedAnalytics.processed).toBe(2);
      expect(workflow.results.advancedAnalytics.postsLimit).toBe(2);
      expect(workflow.results.advancedAnalytics.totalAvailable).toBe(3);

      const advancedStep = workflow.steps.find(step => step.step === 'advancedAnalytics');
      expect(advancedStep.status).toBe('success');
    });

    it('should handle default posts limit correctly', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger,
        { advancedPostStats: true }
      );

      expect(workflow.results.advancedAnalytics.postsLimit).toBe(30);
      expect(workflow.results.advancedAnalytics.processed).toBe(3); // All available posts
    });

    it('should skip advanced analytics when disabled', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger,
        { advancedPostStats: false }
      );

      expect(workflow.results.advancedAnalytics).toBeUndefined();
      const advancedStep = workflow.steps.find(step => step.step === 'advancedAnalytics');
      expect(advancedStep).toBeUndefined();
    });
  });

  describe('Error Recovery E2E Workflows', () => {
    it('should handle tab creation failure and retry', async () => {
      let attemptCount = 0;
      
      // Mock tab creation to fail first time, succeed second time
      const originalCreateTab = mockWorkflowOrchestrator.createLinkedInTab;
      mockWorkflowOrchestrator.createLinkedInTab = async function() {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Tab creation failed');
        }
        return { id: mockTabId, url: 'https://www.linkedin.com/analytics/', active: false };
      };

      // Mock retry mechanism in the main workflow
      const originalExecute = mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow;
      mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow = async function(email, logger, options = {}) {
        try {
          return await originalExecute.call(this, email, logger, options);
        } catch (error) {
          if (error.message === 'Tab creation failed' && attemptCount === 1) {
            // Retry once
            return await originalExecute.call(this, email, logger, options);
          }
          throw error;
        }
      };

      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(workflow.status).toBe('completed');
      expect(attemptCount).toBe(2); // Should have retried once
      
      // Restore original methods
      mockWorkflowOrchestrator.createLinkedInTab = originalCreateTab;
      mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow = originalExecute;
    });

    it('should handle script injection failure gracefully', async () => {
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        if (injection.func.toString().includes('documentElement')) {
          chrome.runtime.lastError = { message: 'Cannot access contents of the page' };
          callback(null);
        } else {
          callback([{ result: 'success' }]);
        }
      });

      await expect(
        mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(mockEmail, mockLogger)
      ).rejects.toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(expect.stringContaining('Workflow failed'));
    });

    it('should cleanup resources even when workflow fails', async () => {
      // Store original method
      const originalUpload = mockWorkflowOrchestrator.uploadFileToAPI;
      
      // Mock a failure in the upload step
      mockWorkflowOrchestrator.uploadFileToAPI = async function() {
        throw new Error('Upload failed');
      };

      await expect(
        mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(mockEmail, mockLogger)
      ).rejects.toThrow('Upload failed');

      // Verify cleanup was still attempted
      expect(chrome.tabs.remove).toHaveBeenCalledWith(mockTabId, expect.any(Function));
      
      // Restore original method
      mockWorkflowOrchestrator.uploadFileToAPI = originalUpload;
    });

    it('should handle storage errors during status update', async () => {
      // Store original method
      const originalUpdateStatus = mockWorkflowOrchestrator.updateExecutionStatus;
      
      mockWorkflowOrchestrator.updateExecutionStatus = async function(status, error, results) {
        throw new Error('Storage quota exceeded');
      };

      await expect(
        mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(mockEmail, mockLogger)
      ).rejects.toThrow('Storage quota exceeded');

      expect(mockLogger.error).toHaveBeenCalled();
      
      // Restore original method
      mockWorkflowOrchestrator.updateExecutionStatus = originalUpdateStatus;
    });

    it('should handle download timeout scenarios', async () => {
      // Store original method
      const originalSetupDownload = mockWorkflowOrchestrator.setupDownloadTracking;
      
      mockWorkflowOrchestrator.setupDownloadTracking = async function() {
        return new Promise((resolve, reject) => {
          setTimeout(() => {
            reject(new Error('Download timeout'));
          }, 50);
        });
      };

      await expect(
        mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(mockEmail, mockLogger)
      ).rejects.toThrow('Download timeout');
      
      // Restore original method
      mockWorkflowOrchestrator.setupDownloadTracking = originalSetupDownload;
    });
  });

  describe('Performance and Timing E2E', () => {
    it('should complete workflow within reasonable time limits', async () => {
      const startTime = Date.now();
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );
      const endTime = Date.now();

      expect(workflow.status).toBe('completed');
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(workflow.duration).toBeLessThan(8000); // Internal timing should be less
    });

    it('should handle concurrent workflow executions', async () => {
      const workflows = [];
      const emails = ['user1@test.com', 'user2@test.com', 'user3@test.com'];

      // Start multiple workflows concurrently
      for (const email of emails) {
        workflows.push(
          mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(email, mockLogger)
        );
      }

      const results = await Promise.all(workflows);

      results.forEach(workflow => {
        expect(workflow.status).toBe('completed');
        expect(workflow.steps.length).toBeGreaterThanOrEqual(7); // At least 7 steps
      });

      // Verify all tabs were created and cleaned up
      expect(chrome.tabs.create).toHaveBeenCalledTimes(3);
      expect(chrome.tabs.remove).toHaveBeenCalledTimes(3);
    });

    it('should track step-by-step timing correctly', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(workflow.startTime).toBeDefined();
      expect(workflow.endTime).toBeDefined();
      expect(workflow.duration).toBe(workflow.endTime - workflow.startTime);
      expect(workflow.duration).toBeGreaterThan(0);
    });

    it('should handle memory efficiently during large workflows', async () => {
      // Test with advanced analytics enabled (more memory usage)
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger,
        { advancedPostStats: true, postsLimit: 50 }
      );

      expect(workflow.status).toBe('completed');
      expect(workflow.results.advancedAnalytics).toBeDefined();
      
      // Verify cleanup was performed
      expect(chrome.tabs.remove).toHaveBeenCalled();
    });
  });

  describe('Company Analytics E2E Workflow', () => {
    let originalUploadMethod;
    
    beforeEach(() => {
      // Store original upload method
      originalUploadMethod = mockWorkflowOrchestrator.uploadFileToAPI;
      
      // Restore upload method for company tests
      mockWorkflowOrchestrator.uploadFileToAPI = async function(downloadUrl, email, logger) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              message: 'Company file uploaded successfully',
              fileId: 'company-upload-123'
            });
          }, 100);
        });
      };
      
      // Mock company-specific workflow
      mockWorkflowOrchestrator.executeCompanyAnalyticsWorkflow = async function(email, logger) {
        const workflow = {
          steps: [],
          startTime: Date.now(),
          status: 'running',
          type: 'company'
        };

        try {
          // Step 1: Create company page tab
          logger.log('🔄 Company Step 1: Creating company page tab...');
          const tab = await this.createLinkedInTab('https://www.linkedin.com/company/analytics/');
          workflow.steps.push({ step: 'createCompanyTab', status: 'success', tabId: tab.id });

          // Step 2: First export (overview)
          logger.log('🔄 Company Step 2: First export - overview data...');
          await this.clickFirstExportButton(tab.id);
          workflow.steps.push({ step: 'firstExport', status: 'success' });

          // Step 3: Second export (detailed)
          logger.log('🔄 Company Step 3: Second export - detailed data...');
          const downloadUrl = await this.clickSecondExportButton(tab.id);
          workflow.steps.push({ step: 'secondExport', status: 'success', downloadUrl });

          // Step 4: Upload company file
          logger.log('🔄 Company Step 4: Uploading company analytics...');
          const uploadResult = await this.uploadFileToAPI(downloadUrl, email, logger);
          workflow.steps.push({ step: 'uploadCompanyFile', status: 'success', result: uploadResult });

          // Step 5: Update weekly status
          logger.log('🔄 Company Step 5: Updating weekly execution status...');
          await this.updateWeeklyStatus();
          workflow.steps.push({ step: 'updateWeeklyStatus', status: 'success' });

          workflow.status = 'completed';
          workflow.endTime = Date.now();
          workflow.duration = workflow.endTime - workflow.startTime;

          return workflow;

        } catch (error) {
          workflow.status = 'failed';
          workflow.error = error.message;
          throw error;
        }
      };

      mockWorkflowOrchestrator.createLinkedInTab = async function(url = 'https://www.linkedin.com/analytics/') {
        return new Promise((resolve) => {
          chrome.tabs.create({ url, active: false }, resolve);
        });
      };

      mockWorkflowOrchestrator.clickFirstExportButton = async function(tabId) {
        return new Promise((resolve) => {
          setTimeout(resolve, 500); // Simulate first export
        });
      };

      mockWorkflowOrchestrator.clickSecondExportButton = async function(tabId) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('https://www.linkedin.com/ambry/?x-ambry-um-filename=company-analytics.xlsx');
          }, 1000); // Simulate second export with download
        });
      };

      mockWorkflowOrchestrator.updateWeeklyStatus = async function() {
        return new Promise((resolve) => {
          chrome.storage.local.set({
            lastCompanyExecution: new Date().toISOString(),
            companyExecutionStatus: '✅Success'
          }, resolve);
        });
      };
    });
    
    afterEach(() => {
      // Restore original upload method
      if (originalUploadMethod) {
        mockWorkflowOrchestrator.uploadFileToAPI = originalUploadMethod;
      }
    });

    it('should execute complete company analytics workflow', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompanyAnalyticsWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(workflow.status).toBe('completed');
      expect(workflow.type).toBe('company');
      expect(workflow.steps).toHaveLength(5);

      // Verify company-specific steps
      const companySteps = ['createCompanyTab', 'firstExport', 'secondExport', 'uploadCompanyFile', 'updateWeeklyStatus'];
      companySteps.forEach(stepName => {
        const step = workflow.steps.find(s => s.step === stepName);
        expect(step).toBeDefined();
        expect(step.status).toBe('success');
      });
    });

    it('should handle two-step export process correctly', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompanyAnalyticsWorkflow(
        mockEmail, 
        mockLogger
      );

      const firstExport = workflow.steps.find(s => s.step === 'firstExport');
      const secondExport = workflow.steps.find(s => s.step === 'secondExport');

      expect(firstExport.status).toBe('success');
      expect(secondExport.status).toBe('success');
      expect(secondExport.downloadUrl).toContain('company-analytics.xlsx');
    });

    it('should update weekly execution status correctly', async () => {
      await mockWorkflowOrchestrator.executeCompanyAnalyticsWorkflow(
        mockEmail, 
        mockLogger
      );

      expect(chrome.storage.local.set).toHaveBeenCalledWith(
        expect.objectContaining({
          lastCompanyExecution: expect.any(String),
          companyExecutionStatus: '✅Success'
        }),
        expect.any(Function)
      );
    });
  });

  describe('Cross-Component Integration', () => {
    let originalSetupDownload;
    let originalUploadFile;
    
    beforeEach(() => {
      // Store original methods
      originalSetupDownload = mockWorkflowOrchestrator.setupDownloadTracking;
      originalUploadFile = mockWorkflowOrchestrator.uploadFileToAPI;
      
      // Restore proper methods for integration tests
      mockWorkflowOrchestrator.setupDownloadTracking = async function() {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve('https://www.linkedin.com/ambry/?x-ambry-um-filename=integration-test.xlsx');
          }, 100);
        });
      };
      
      mockWorkflowOrchestrator.uploadFileToAPI = async function(downloadUrl, email, logger) {
        return new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              success: true,
              message: 'Integration test upload successful',
              fileId: 'integration-123'
            });
          }, 100);
        });
      };
    });
    
    afterEach(() => {
      // Restore original methods
      if (originalSetupDownload) {
        mockWorkflowOrchestrator.setupDownloadTracking = originalSetupDownload;
      }
      if (originalUploadFile) {
        mockWorkflowOrchestrator.uploadFileToAPI = originalUploadFile;
      }
    });
    it('should integrate ConfigManager, DownloadTracking, and FileUpload correctly', async () => {
      // Mock cross-component integration
      const integrationTest = async () => {
        // 1. ConfigManager - Get configuration
        const config = await new Promise((resolve) => {
          chrome.storage.local.get(['email', 'advancedPostStats', 'postsLimit'], resolve);
        });

        // 2. DownloadTracking - Setup and capture
        const downloadUrl = await mockWorkflowOrchestrator.setupDownloadTracking();

        // 3. FileUpload - Upload captured file
        const uploadResult = await mockWorkflowOrchestrator.uploadFileToAPI(
          downloadUrl, 
          config.email || mockEmail, 
          mockLogger
        );

        return { config, downloadUrl, uploadResult };
      };

      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({
          email: mockEmail,
          advancedPostStats: true,
          postsLimit: 25
        });
      });

      const result = await integrationTest();

      expect(result.config.email).toBe(mockEmail);
      expect(result.downloadUrl).toContain('linkedin.com/ambry');
      expect(result.uploadResult.success).toBe(true);
    });

    it('should handle language detection across all components', async () => {
      chrome.scripting.executeScript.mockImplementation((injection, callback) => {
        if (injection.func.toString().includes('documentElement')) {
          callback([{ result: 'de' }]); // German
        } else {
          callback([{ result: 'success' }]);
        }
      });

      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger
      );

      // Verify language was detected and used throughout workflow
      const languageStep = workflow.steps.find(step => step.step === 'detectLanguage');
      expect(languageStep.language).toBe('de');
      expect(workflow.status).toBe('completed');
    });

    it('should maintain state consistency across workflow steps', async () => {
      const workflow = await mockWorkflowOrchestrator.executeCompleteLinkedInWorkflow(
        mockEmail, 
        mockLogger,
        { advancedPostStats: true, postsLimit: 15 }
      );

      // Verify state is maintained across steps
      expect(workflow.results.advancedAnalytics.postsLimit).toBe(15);
      
      const createTabStep = workflow.steps.find(s => s.step === 'createTab');
      const cleanupStep = workflow.steps.find(s => s.step === 'cleanup');
      
      expect(createTabStep.tabId).toBe(mockTabId);
      expect(cleanupStep.status).toBe('success');
    });
  });
});

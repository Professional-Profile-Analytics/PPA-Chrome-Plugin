/**
 * Advanced Post Analytics Module
 * Handles individual post analytics extraction and processing
 */

class AdvancedPostAnalytics {
  /**
   * Process advanced post statistics
   * @param {number} tabId - Tab ID for LinkedIn
   * @param {string} email - User email
   * @param {string[]} postUrls - Array of post URLs to process
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Processing results
   */
  static async processAdvancedStatistics(tabId, email, postUrls, logger) {
    logger.log(`Starting advanced post statistics processing for ${postUrls.length} posts`);
    
    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      downloads: [],
      errors: []
    };
    
    try {
      // Process each post URL
      for (let i = 0; i < postUrls.length; i++) {
        const postUrl = postUrls[i];
        logger.log(`Processing post ${i + 1}/${postUrls.length}: ${postUrl}`);
        
        try {
          // Transform URL to analytics format
          const analyticsUrl = ExcelProcessor.transformToAnalyticsUrl(postUrl);
          
          // Navigate to the post analytics page
          await AdvancedPostAnalytics.navigateToPostAnalytics(tabId, analyticsUrl, logger);
          
          // Wait for page to load
          await AdvancedPostAnalytics.waitForAnalyticsPageLoad(tabId, logger);
          
          // Export the post analytics
          const downloadInfo = await AdvancedPostAnalytics.exportPostAnalytics(tabId, logger);
          
          if (downloadInfo) {
            results.downloads.push({
              postUrl: postUrl,
              analyticsUrl: analyticsUrl,
              downloadInfo: downloadInfo
            });
            results.successful++;
          }
          
          results.processed++;
          
          // Add delay between posts to avoid rate limiting
          if (i < postUrls.length - 1) {
            await AdvancedPostAnalytics.delay(2000 + Math.random() * 3000); // 2-5 second delay
          }
          
        } catch (error) {
          logger.error(`Failed to process post ${postUrl}: ${error.message}`);
          results.errors.push({
            postUrl: postUrl,
            error: error.message
          });
          results.failed++;
        }
      }
      
      logger.log(`Advanced post statistics processing completed. Successful: ${results.successful}, Failed: ${results.failed}`);
      return results;
      
    } catch (error) {
      logger.error(`Advanced post statistics processing failed: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Navigate to post analytics page
   * @param {number} tabId - Tab ID
   * @param {string} analyticsUrl - Analytics URL to navigate to
   * @param {Object} logger - Logger instance
   */
  static async navigateToPostAnalytics(tabId, analyticsUrl, logger) {
    return new Promise((resolve, reject) => {
      chrome.tabs.update(tabId, { url: analyticsUrl }, (tab) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Failed to navigate to analytics page: ${chrome.runtime.lastError.message}`));
          return;
        }
        
        logger.log(`Navigated to analytics page: ${analyticsUrl}`);
        resolve();
      });
    });
  }
  
  /**
   * Wait for analytics page to load completely
   * @param {number} tabId - Tab ID
   * @param {Object} logger - Logger instance
   */
  static async waitForAnalyticsPageLoad(tabId, logger) {
    const maxWait = 15000; // 15 seconds
    const startTime = Date.now();
    
    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          reject(new Error('Analytics page load timeout'));
          return;
        }
        
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            // Check if the analytics page has loaded
            const exportButton = document.querySelector('button[data-test-id="export-button"], button:contains("Export"), button[aria-label*="Export"]');
            const loadingIndicator = document.querySelector('[data-test-id="loading"], .loading, .spinner');
            
            return {
              hasExportButton: !!exportButton,
              isLoading: !!loadingIndicator,
              readyState: document.readyState
            };
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            clearInterval(checkInterval);
            reject(new Error(`Script execution failed: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (results && results[0] && results[0].result) {
            const { hasExportButton, isLoading, readyState } = results[0].result;
            
            if (readyState === 'complete' && hasExportButton && !isLoading) {
              clearInterval(checkInterval);
              logger.log('Analytics page loaded successfully');
              resolve();
            }
          }
        });
      }, 1000);
    });
  }
  
  /**
   * Export post analytics data
   * @param {number} tabId - Tab ID
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Download information
   */
  static async exportPostAnalytics(tabId, logger) {
    return new Promise((resolve, reject) => {
      // Track downloads before clicking export
      const downloadsBeforeExport = [];
      
      chrome.downloads.search({ limit: 10 }, (items) => {
        items.forEach(item => downloadsBeforeExport.push(item.id));
        
        // Click the export button
        chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            // Try multiple selectors for the export button
            const exportSelectors = [
              'button[data-test-id="export-button"]',
              'button[aria-label*="Export"]',
              'button:contains("Export")',
              'button[data-control-name*="export"]',
              '.export-button',
              '[data-test-id*="export"] button'
            ];
            
            let exportButton = null;
            for (const selector of exportSelectors) {
              exportButton = document.querySelector(selector);
              if (exportButton) break;
            }
            
            // If no button found by selector, try finding by text content
            if (!exportButton) {
              const buttons = Array.from(document.querySelectorAll('button'));
              exportButton = buttons.find(btn => 
                btn.textContent.toLowerCase().includes('export') ||
                btn.getAttribute('aria-label')?.toLowerCase().includes('export')
              );
            }
            
            if (exportButton && !exportButton.disabled) {
              exportButton.click();
              return { success: true, buttonFound: true };
            } else {
              return { success: false, buttonFound: !!exportButton, disabled: exportButton?.disabled };
            }
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            reject(new Error(`Export button click failed: ${chrome.runtime.lastError.message}`));
            return;
          }
          
          if (!results || !results[0] || !results[0].result.success) {
            reject(new Error('Export button not found or could not be clicked'));
            return;
          }
          
          logger.log('Export button clicked successfully');
          
          // Wait for download to start
          setTimeout(() => {
            chrome.downloads.search({ limit: 10 }, (newItems) => {
              const newDownloads = newItems.filter(item => 
                !downloadsBeforeExport.includes(item.id) && 
                item.filename.toLowerCase().includes('post')
              );
              
              if (newDownloads.length > 0) {
                const downloadInfo = newDownloads[0];
                logger.log(`Post analytics download detected: ${downloadInfo.filename}`);
                resolve(downloadInfo);
              } else {
                // Wait a bit more for the download
                setTimeout(() => {
                  chrome.downloads.search({ limit: 10 }, (finalItems) => {
                    const finalNewDownloads = finalItems.filter(item => 
                      !downloadsBeforeExport.includes(item.id)
                    );
                    
                    if (finalNewDownloads.length > 0) {
                      resolve(finalNewDownloads[0]);
                    } else {
                      reject(new Error('No download detected after export'));
                    }
                  });
                }, 3000);
              }
            });
          }, 2000);
        });
      });
    });
  }
  
  /**
   * Upload single post analytics to API immediately after download
   * @param {string} email - User email
   * @param {string} originalUrl - Original post URL
   * @param {string} analyticsUrl - Analytics URL
   * @param {Object} downloadInfo - Download information
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Upload result
   */
  static async uploadSinglePostAnalytics(email, originalUrl, analyticsUrl, downloadInfo, logger) {
    const API_ENDPOINT = 'https://mlew54d2u3dfar47trgs2rjjgi0vfopc.lambda-url.us-east-1.on.aws/';
    
    try {
      logger.log(`Uploading single post analytics: ${downloadInfo.filename}`);
      
      // Get the file from the download URL
      let fileBase64 = null;
      try {
        if (downloadInfo.url) {
          const response = await fetch(downloadInfo.url);
          if (response.ok) {
            const fileBlob = await response.blob();
            // Convert blob to base64
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            fileBase64 = btoa(String.fromCharCode.apply(null, uint8Array));
            logger.log(`Converted file ${downloadInfo.filename} to base64 (${fileBase64.length} chars)`);
          } else {
            throw new Error(`Could not fetch file from URL: ${response.status}`);
          }
        } else {
          throw new Error('Download URL not available');
        }
      } catch (fileError) {
        logger.warn(`Failed to get file ${downloadInfo.filename}: ${fileError.message}`);
        return { success: false, error: fileError.message };
      }
      
      // Prepare the simple JSON payload as expected by Python Lambda
      const payload = {
        user_email: email,
        file: fileBase64
      };
      
      // Upload to API with JSON payload
      logger.log(`Uploading to endpoint: ${API_ENDPOINT}`);
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      logger.log(`Single post analytics uploaded successfully: ${downloadInfo.filename}`);
      
      return { success: true, result: result };
      
    } catch (error) {
      logger.error(`Failed to upload single post analytics: ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  /**
   * Upload advanced post statistics to API
   * @param {string} email - User email
   * @param {Array} downloadInfos - Array of download information
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Upload result
   * @deprecated Use uploadSinglePostAnalytics instead for individual uploads
   */
  static async uploadAdvancedStatistics(email, downloadInfos, logger) {
    const API_ENDPOINT = 'https://mlew54d2u3dfar47trgs2rjjgi0vfopc.lambda-url.us-east-1.on.aws/';
    
    logger.log(`Uploading advanced post statistics for ${downloadInfos.length} posts`);
    
    try {
      // Prepare the data for upload
      const uploadData = {
        email: email,
        timestamp: new Date().toISOString(),
        postCount: downloadInfos.length,
        posts: downloadInfos.map(info => ({
          originalUrl: info.postUrl,
          analyticsUrl: info.analyticsUrl,
          downloadFilename: info.downloadInfo.filename,
          downloadId: info.downloadInfo.id
        }))
      };
      
      // Create FormData for file uploads
      const formData = new FormData();
      formData.append('metadata', JSON.stringify(uploadData));
      
      // Add each downloaded file to the form data
      for (let i = 0; i < downloadInfos.length; i++) {
        const downloadInfo = downloadInfos[i].downloadInfo;
        
        // Get the file from the download
        const fileBlob = await AdvancedPostAnalytics.getDownloadedFile(downloadInfo);
        if (fileBlob) {
          formData.append(`post_analytics_${i}`, fileBlob, downloadInfo.filename);
        }
      }
      
      // Upload to API
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed with status: ${response.status}`);
      }
      
      const result = await response.json();
      logger.log('Advanced post statistics uploaded successfully');
      
      return result;
      
    } catch (error) {
      logger.error(`Failed to upload advanced post statistics: ${error.message}`);
      throw error;
    }
  }
  
  /**
   * Get downloaded file as blob
   * @param {Object} downloadInfo - Download information from Chrome downloads API
   * @returns {Promise<Blob>} File blob
   */
  static async getDownloadedFile(downloadInfo) {
    return new Promise((resolve, reject) => {
      // This is a simplified version - in practice, you might need to
      // read the file from the filesystem or handle it differently
      // depending on the Chrome extension's capabilities
      
      // For now, we'll return null and handle file upload differently
      // The actual implementation would depend on how Chrome extensions
      // can access downloaded files
      resolve(null);
    });
  }
  
  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Make AdvancedPostAnalytics available globally
if (typeof window !== 'undefined') {
  window.AdvancedPostAnalytics = AdvancedPostAnalytics;
}

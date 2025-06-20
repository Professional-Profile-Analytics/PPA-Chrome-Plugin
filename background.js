/**
 * Professional Profile Analytics - Background Service Worker
 *
 * This script handles the automated download and upload of LinkedIn analytics data
 * to the Professional Profile Analytics service.
 *
 * It also provides an interface for the Shiny web app to trigger the extension
 * to open tabs and simulate human typing.
 */

// Debug configuration - set to false for production
const DEBUG_MODE = false;

// Enhanced Logger with conditional logging
const Logger = {
  log: (message) => {
    if (DEBUG_MODE) console.log(message);
  },
  warn: (message) => {
    if (DEBUG_MODE) console.warn(message);
  },
  error: (message) => {
    // Always log errors, even in production
    console.error(message);
  },
  info: (message) => {
    if (DEBUG_MODE) console.info(message);
  }
};

// Force reset retry count on startup
chrome.storage.local.get(['retryCount'], (data) => {
  if (data.retryCount) {
    Logger.log(`Found existing retry count on startup: ${data.retryCount}. Resetting to 0.`);
    chrome.storage.local.set({ retryCount: 0 });
    chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
    Logger.log('Retry count reset to 0 and retry flags cleared on startup.');
  }
});

// ============================================================================
// MULTI-LANGUAGE SUPPORT
// ============================================================================

/**
 * Dictionary of UI element text in different languages
 */
const LANGUAGE_DICTIONARY = {
  // Default language (English)
  default: {
    postImpressions: 'Post impressions',
    past7Days: 'Past 7 days',
    past28Days: 'Past 28 days',
    showResults: 'Show results',
    export: 'Export'
  },
  // German translations
  de: {
    postImpressions: 'Impressions von Beiträgen',
    past7Days: 'Vergangene 7 Tage',
    past28Days: 'Vergangene 28 Tage',
    showResults: 'Ergebnisse anzeigen',
    export: 'Exportieren'
  },
  // Spanish translations
  es: {
    postImpressions: 'Impresiones de la publicación',
    past7Days: 'Últimos 7 días',
    past28Days: 'Últimos 28 días',
    showResults: 'Mostrar resultados',
    export: 'Exportar'
  },
  // French translations
  fr: {
    postImpressions: 'Impressions des publications',
    past7Days: 'Les 7 derniers jours',
    past28Days: 'Les 28 derniers jours',
    showResults: 'Afficher les résultats',
    export: 'Exporter'
  }
};

/**
 * Detect the LinkedIn interface language
 * @param {number} tabId - The ID of the tab to check
 * @returns {Promise<string>} The detected language code or 'default' if not detected
 */
async function detectLanguage(tabId) {
  return new Promise((resolve) => {
    chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        // Try to detect language from LinkedIn's i18nLocale meta tag (most reliable)
        const i18nLocale = document.querySelector('meta[name="i18nLocale"]');
        if (i18nLocale && i18nLocale.content) {
          return {
            source: 'i18nLocale',
            value: i18nLocale.content,
            code: i18nLocale.content.split('_')[0] // Extract primary language code (e.g., 'de' from 'de_DE')
          };
        }

        // Try to detect language from HTML lang attribute
        const htmlLang = document.documentElement.lang;
        if (htmlLang) {
          return {
            source: 'html',
            value: htmlLang,
            code: htmlLang.split('-')[0] // Extract primary language code (e.g., 'de' from 'de-DE')
          };
        }

        // Try to detect from other meta tags
        const metaTags = [
          document.querySelector('meta[property="og:locale"]'),
          document.querySelector('meta[http-equiv="content-language"]')
        ];

        for (const tag of metaTags) {
          if (tag && tag.content) {
            return {
              source: 'meta',
              value: tag.content,
              code: tag.content.includes('_') ?
                tag.content.split('_')[0] :
                tag.content.split('-')[0]
            };
          }
        }

        // Try to detect from URL patterns
        const url = window.location.href;
        const urlPatterns = [
          { pattern: '/de/', code: 'de' },
          { pattern: '/es/', code: 'es' },
          { pattern: '/fr/', code: 'fr' },
          { pattern: '.de/', code: 'de' },
          { pattern: '.es/', code: 'es' },
          { pattern: '.fr/', code: 'fr' }
        ];

        for (const { pattern, code } of urlPatterns) {
          if (url.includes(pattern)) {
            return {
              source: 'url',
              value: url,
              code: code
            };
          }
        }

        // Try to detect from page content (look for language-specific elements)
        const pageText = document.body.innerText.toLowerCase();
        if (pageText.includes('Impressionen') || pageText.includes('Beiträgen')) {
          return { source: 'content', value: 'German content detected', code: 'de' };
        }
        if (pageText.includes('Impresiones') || pageText.includes('publicación')) {
          return { source: 'content', value: 'Spanish content detected', code: 'es' };
        }
        if (pageText.includes('Impressions des') || pageText.includes('derniers jours')) {
          return { source: 'content', value: 'French content detected', code: 'fr' };
        }

        // Default to English if no language detected
        return { source: 'default', value: 'en', code: 'default' };
      }
    }, (results) => {
      if (chrome.runtime.lastError || !results || !results[0]) {
        Logger.log('Language detection failed, using default language', 'warn');
        resolve('default');
      } else {
        const langInfo = results[0].result;
        const detectedLang = langInfo.code;

        // Only log language detection once per session or when it changes
        if (!this.lastDetectedLanguage || this.lastDetectedLanguage !== detectedLang) {
          Logger.log(`Language detected: ${detectedLang}`, 'info');
          this.lastDetectedLanguage = detectedLang;
        }

        // Store the detected language in storage for reference
        chrome.storage.local.set({
          detectedLanguage: {
            code: detectedLang,
            source: langInfo.source,
            originalValue: langInfo.value,
            timestamp: new Date().toISOString(),
            supported: !!LANGUAGE_DICTIONARY[detectedLang]
          }
        });

        // Check if we have translations for this language
        resolve(LANGUAGE_DICTIONARY[detectedLang] ? detectedLang : 'default');
      }
    });
  });
}

/**
 * Enhanced Tab Interactions with multi-language support
 */
const MultilingualTabInteractions = {
  /**
   * Wait for a page to fully load
   * @param {number} tabId - The ID of the tab to wait for
   * @param {number} maxWait - Maximum wait time in milliseconds
   * @returns {Promise<void>}
   * @throws {Error} If page load times out or script execution fails
   */
  waitForPageLoad(tabId, maxWait = 50000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        // Check if we've exceeded max wait time
        if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          reject(new Error('Page load timeout'));
        }

        chrome.scripting.executeScript({
          target: { tabId },
          func: () => document.readyState
        }, (results) => {
          if (chrome.runtime.lastError) {
            clearInterval(checkInterval);
            reject(new Error('Script execution error'));
          } else if (results && results[0]?.result === 'complete') {
            clearInterval(checkInterval);
            // Add a small buffer after page load
            setTimeout(resolve, 5000);
          }
        });
      }, 500);
    });
  },

  /**
   * Get the current language of the LinkedIn interface
   * @param {number} tabId - The ID of the tab
   * @returns {Promise<string>} The detected language code
   */
  async getLanguage(tabId) {
    return await detectLanguage(tabId);
  },

  /**
   * Click a button in a tab with multi-language support
   * @param {number} tabId - The ID of the tab
   * @param {string} buttonKey - The key for the button text in the language dictionary
   * @returns {Promise<void>}
   * @throws {Error} If button is not found or script execution fails
   */
  async clickButton(tabId, buttonKey) {
    // First detect the language
    const language = await this.getLanguage(tabId);

    // Get all possible translations for this button
    const buttonTexts = [];
    Object.keys(LANGUAGE_DICTIONARY).forEach(lang => {
      if (LANGUAGE_DICTIONARY[lang][buttonKey]) {
        buttonTexts.push(LANGUAGE_DICTIONARY[lang][buttonKey]);
      }
    });

    // If no translations found, use the key itself
    if (buttonTexts.length === 0) {
      buttonTexts.push(buttonKey);
    }

    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (texts) => {
          // Try to find a button with any of the provided texts
          const buttons = Array.from(document.querySelectorAll('button'));
          let buttonFound = false;

          for (const text of texts) {
            const button = buttons.find((btn) => btn.textContent.includes(text));
            if (button) {
              button.scrollIntoView({ behavior: "smooth", block: "center" });
              button.click();
              buttonFound = true;
              break;
            }
          }

          return buttonFound;
        },
        args: [buttonTexts]
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error('Button click script error'));
        } else if (!results[0]?.result) {
          reject(new Error(`Button not found for key: ${buttonKey}`));
        } else {
          // Wait a bit after clicking to allow for potential UI updates
          setTimeout(resolve, 5000);
        }
      });
    });
  },

  /**
   * Click a link in a tab with multi-language support
   * @param {number} tabId - The ID of the tab
   * @param {string} linkKey - The key for the link text in the language dictionary
   * @returns {Promise<void>}
   * @throws {Error} If link is not found or script execution fails
   */
  async clickLink(tabId, linkKey) {
    // First detect the language
    const language = await this.getLanguage(tabId);

    // Get all possible translations for this link
    const linkTexts = [];
    Object.keys(LANGUAGE_DICTIONARY).forEach(lang => {
      if (LANGUAGE_DICTIONARY[lang][linkKey]) {
        linkTexts.push(LANGUAGE_DICTIONARY[lang][linkKey]);
      }
    });

    // If no translations found, use the key itself
    if (linkTexts.length === 0) {
      linkTexts.push(linkKey);
    }

    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (texts) => {
          // Try to find a link with any of the provided texts
          const links = Array.from(document.querySelectorAll('a'));
          let linkFound = false;

          for (const text of texts) {
            const link = links.find((a) => a.textContent.includes(text));
            if (link) {
              console.log(`Found link with text: ${text}`);
              link.scrollIntoView({ behavior: "smooth", block: "center" });
              setTimeout(() => {
                try {
                  console.log(`Clicking link with text: ${text}`);
                  link.click();
                  linkFound = true;
                } catch (e) {
                  console.error(`Error clicking link: ${e.message}`);
                }
              }, 500);
              linkFound = true;
              break;
            }
          }

          return linkFound;
        },
        args: [linkTexts]
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Link click script error: ${chrome.runtime.lastError.message}`));
        } else if (!results || !results[0] || !results[0]?.result) {
          reject(new Error(`Link not found for key: ${linkKey}. Available texts: ${linkTexts.join(', ')}`));
        } else {
          // Wait a bit after clicking to allow for potential UI updates
          setTimeout(resolve, 5000);
        }
      });
    });
  },

  /**
   * Click a link in a tab, but don't fail if not found
   * @param {number} tabId - The ID of the tab
   * @param {string} linkKey - The key for the link text in the language dictionary
   * @returns {Promise<void>}
   */
  async clickLinkSoft(tabId, linkKey) {
    try {
      // This method uses clickLink which already has language detection
      await this.clickLink(tabId, linkKey);
    } catch (error) {
      console.info(`Link "${linkKey}" not found or could not be clicked, continuing...`);
    }
  },

  /**
   * Select an option in a list
   * @param {number} tabId - The ID of the tab
   * @param {string} forAttributeValue - The value of the "for" attribute of the label
   * @returns {Promise<void>}
   * @throws {Error} If option is not found or script execution fails
   */
  selectListOption(tabId, forAttributeValue) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (attributeValue) => {
          const label = document.querySelector(`label[for="${attributeValue}"]`);
          if (label) {
            label.click();
            return true;
          }
          return false;
        },
        args: [forAttributeValue]
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error('List option selection script error'));
        } else if (!results[0]?.result) {
          reject(new Error('List option not found'));
        } else {
          // Wait a bit after selecting to allow for potential UI updates
          setTimeout(resolve, 5000);
        }
      });
    });
  }
};

/**
 * Handles LinkedIn automation workflows with multi-language support
 */
const LinkedInMultilingualAutomation = {
  /**
   * Execute the standard LinkedIn automation steps
   * @param {number} tabId - The ID of the tab
   * @param {string} email - The user's email address
   * @param {Object} webRequestTracker - The WebRequestTracker object
   * @param {Object} fileUploader - The FileUploader object
   * @param {Object} configManager - The ConfigManager object
   * @param {Object} logger - The Logger object
   * @returns {Promise<void>}
   */
  async executeSteps(tabId, email, webRequestTracker, fileUploader, configManager, logger) {
    let advancedStatsResults = null; // Track advanced statistics results
    
    try {
      // Wait for initial page load
      await MultilingualTabInteractions.waitForPageLoad(tabId);

      // Navigate through LinkedIn analytics
      await MultilingualTabInteractions.clickLink(tabId, 'postImpressions');
      await MultilingualTabInteractions.waitForPageLoad(tabId);
      // 3.4.2025 - LinkedIn removed this step for some accounts
      await MultilingualTabInteractions.clickLinkSoft(tabId, 'postImpressions');
      await MultilingualTabInteractions.waitForPageLoad(tabId);

      // Configure time range
      await MultilingualTabInteractions.clickButton(tabId, 'past7Days');
      // 3.4.2025 - LinkedIn renamed this option
      await MultilingualTabInteractions.selectListOption(tabId, "timeRange-past_28_days");
      await MultilingualTabInteractions.clickButton(tabId, 'showResults');
      await MultilingualTabInteractions.waitForPageLoad(tabId);

      // Track and download file
      const downloadTracker = webRequestTracker.trackDownload(tabId);
      let buttonClicked = false;
      try {
        await MultilingualTabInteractions.clickButton(tabId, 'export');
        buttonClicked = true;
      } catch (error) {
        logger.warn("First attempt to click 'Export' failed, retrying in 15 seconds...");
        await new Promise(resolve => setTimeout(resolve, 15000));
        await MultilingualTabInteractions.clickButton(tabId, 'export');
      }

      // Get download URL and upload file
      const apiURL = await downloadTracker;
      const apiResponse = await fileUploader.uploadToWebhook(apiURL, email);

      // Check if advanced post statistics is enabled
      let advancedStatsEnabled = false;
      try {
        advancedStatsEnabled = await new Promise((resolve) => {
          chrome.storage.local.get(['advancedPostStats'], (result) => {
            resolve(result.advancedPostStats || false);
          });
        });
        
        logger.log(`Advanced post statistics setting: ${advancedStatsEnabled}`);
      } catch (error) {
        logger.warn(`Failed to check advanced stats setting: ${error.message}`);
      }

      if (advancedStatsEnabled) {
        logger.log('Advanced post statistics enabled, processing individual posts...');
        try {
          // Get post analytics URLs from API response
          let postAnalyticsUrls = null;
          if (apiResponse) {
            // Parse the response body if it's a string
            let responseBody = apiResponse;
            if (typeof responseBody === 'string') {
              try {
                responseBody = JSON.parse(responseBody);
              } catch (parseError) {
                logger.error(`Failed to parse API response: ${parseError.message}`);
              }
            }
            
            // Extract URLs from the response body
            if (responseBody && responseBody.extracted_urls) {
              postAnalyticsUrls = responseBody.extracted_urls;
              logger.log(`API returned ${postAnalyticsUrls.length} extracted analytics URLs`);
            } else {
              logger.warn('No extracted_urls found in API response');
              logger.log('API response structure:', responseBody);
            }
          } else {
            logger.warn('No API response available for advanced statistics');
          }
          
          if (postAnalyticsUrls && postAnalyticsUrls.length > 0) {
            advancedStatsResults = await this.processAdvancedPostStatistics(tabId, email, logger, postAnalyticsUrls);
          } else {
            logger.log('No analytics URLs to process, skipping advanced statistics');
          }
        } catch (error) {
          logger.error(`Advanced post statistics failed: ${error.message}`);
          // Continue with main automation
        }
      } else {
        logger.log('Advanced post statistics disabled, skipping individual post processing');
      }

      // Create success message with post count if advanced stats was processed
      let successMessage = '✅Success';
      if (advancedStatsResults && advancedStatsResults.processed) {
        const totalAvailable = advancedStatsResults.totalAvailable || advancedStatsResults.processed;
        const processed = advancedStatsResults.processed;
        
        if (totalAvailable > processed) {
          successMessage = `✅Success (${processed}/${totalAvailable} posts processed)`;
        } else {
          successMessage = `✅Success (${processed} posts processed)`;
        }
      } else {
        // Check if advanced post statistics is enabled
        const advancedStatsEnabled = await new Promise((resolve) => {
          chrome.storage.local.get(['advancedPostStats'], (result) => {
            resolve(result.advancedPostStats || false);
          });
        });
        
        if (advancedStatsEnabled) {
          successMessage = '✅Success (Advanced post statistics enabled)';
        }
      }

      // Update successful execution status after all processing (including advanced statistics)
      await configManager.updateExecutionStatus(successMessage);
      logger.log(`Execution status updated to: ${successMessage}`);
      
      // Reset retry count on success
      await configManager.resetRetryCount();

    } catch (error) {
      // Log and update failed execution status
      logger.error(`LinkedIn automation failed: ${error.message}`);
      await configManager.updateExecutionStatus('Failed', error);
      throw error;
    } finally {
      // Always close the tab safely after everything is complete
      try {
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {
            // Tab already closed or doesn't exist - this is fine
            logger.log(`Tab ${tabId} was already closed: ${chrome.runtime.lastError.message}`);
          } else {
            logger.log(`Tab ${tabId} closed successfully`);
          }
        });
      } catch (error) {
        logger.log(`Error closing tab ${tabId}: ${error.message}`);
      }
    }
  },

  /**
   * Execute the direct LinkedIn automation steps
   * @param {number} tabId - The ID of the tab
   * @param {string} email - The user's email address
   * @param {Object} webRequestTracker - The WebRequestTracker object
   * @param {Object} fileUploader - The FileUploader object
   * @param {Object} configManager - The ConfigManager object
   * @param {Object} logger - The Logger object
   * @returns {Promise<void>}
   */
  async executeStepsDirect(tabId, email, webRequestTracker, fileUploader, configManager, logger) {
    let advancedStatsResults = null; // Track advanced statistics results
    
    try {
      // Wait for initial page load
      await MultilingualTabInteractions.waitForPageLoad(tabId);

      // Attempt to download file with multiple button click strategies
      const downloadResult = await this.clickExportButton(tabId, email, webRequestTracker, fileUploader, logger);

      // Check if advanced post statistics is enabled
      let advancedStatsEnabled = false;
      try {
        advancedStatsEnabled = await new Promise((resolve) => {
          chrome.storage.local.get(['advancedPostStats'], (result) => {
            resolve(result.advancedPostStats || false);
          });
        });

        logger.log(`Advanced post statistics setting: ${advancedStatsEnabled}`);
      } catch (error) {
        logger.warn(`Failed to check advanced stats setting: ${error.message}`);
      }

      if (advancedStatsEnabled) {
        logger.log('Advanced post statistics enabled, processing individual posts...');
        try {
          // Get post analytics URLs from API response
          let postAnalyticsUrls = null;
          if (downloadResult && downloadResult.apiResponse) {
            // Parse the response body if it's a string
            let responseBody = downloadResult.apiResponse;
            if (typeof responseBody === 'string') {
              try {
                responseBody = JSON.parse(responseBody);
              } catch (parseError) {
                logger.error(`Failed to parse API response: ${parseError.message}`);
              }
            }
            
            // Extract URLs from the response body
            if (responseBody && responseBody.extracted_urls) {
              postAnalyticsUrls = responseBody.extracted_urls;
              logger.log(`API returned ${postAnalyticsUrls.length} extracted analytics URLs`);
            } else {
              logger.warn('No extracted_urls found in API response');
              logger.log('API response structure:', responseBody);
            }
          } else {
            logger.warn('No API response available for advanced statistics');
            logger.log('Download result:', downloadResult);
          }
          
          if (postAnalyticsUrls && postAnalyticsUrls.length > 0) {
            advancedStatsResults = await this.processAdvancedPostStatistics(tabId, email, logger, postAnalyticsUrls);
          } else {
            logger.log('No analytics URLs to process, skipping advanced statistics');
          }
        } catch (error) {
          logger.error(`Advanced post statistics failed: ${error.message}`);
          // Continue with main automation
        }
      } else {
        logger.log('Advanced post statistics disabled, skipping individual post processing');
      }

      // Create success message with post count if advanced stats was processed
      let successMessage = '✅Success';
      if (advancedStatsResults && advancedStatsResults.processed) {
        const totalAvailable = advancedStatsResults.totalAvailable || advancedStatsResults.processed;
        const processed = advancedStatsResults.processed;
        
        if (totalAvailable > processed) {
          successMessage = `✅Success (${processed}/${totalAvailable} posts processed)`;
        } else {
          successMessage = `✅Success (${processed} posts processed)`;
        }
      } else {
        // Check if advanced post statistics is enabled
        const advancedStatsEnabled = await new Promise((resolve) => {
          chrome.storage.local.get(['advancedPostStats'], (result) => {
            resolve(result.advancedPostStats || false);
          });
        });
        
        if (advancedStatsEnabled) {
          successMessage = '✅Success (Advanced post statistics enabled)';
        }
      }

      // Update successful execution status after all processing (including advanced statistics)
      await configManager.updateExecutionStatus(successMessage);
      logger.log(`Execution status updated to: ${successMessage}`);
      
      // Reset retry count on success
      await configManager.resetRetryCount();

    } catch (error) {
      // Log and update failed execution status
      logger.error(`LinkedIn direct automation failed: ${error.message}`);
      await configManager.updateExecutionStatus('Failed', error);
      throw error;
    } finally {
      // Always close the tab safely after everything is complete
      try {
        chrome.tabs.remove(tabId, () => {
          if (chrome.runtime.lastError) {
            // Tab already closed or doesn't exist - this is fine
            logger.log(`Tab ${tabId} was already closed: ${chrome.runtime.lastError.message}`);
          } else {
            logger.log(`Tab ${tabId} closed successfully`);
          }
        });
      } catch (error) {
        logger.log(`Error closing tab ${tabId}: ${error.message}`);
      }
    }
  },

  /**
   * Process advanced post statistics
   * @param {number} tabId - The ID of the tab
   * @param {string} email - The user's email address
   * @param {Object} logger - The Logger object
   * @param {string} originalDownloadUrl - The original download URL from the main automation
   * @returns {Promise<void>}
   */
  /**
   * Process advanced post statistics using URLs from API
   * @param {number} tabId - The ID of the tab
   * @param {string} email - The user's email address
   * @param {Object} logger - The Logger object
   * @param {string[]} postAnalyticsUrls - Array of analytics URLs from API
   * @returns {Promise<void>}
   */
  async processAdvancedPostStatistics(tabId, email, logger, postAnalyticsUrls = null) {
    try {
      logger.log(`Starting advanced post statistics processing for ${postAnalyticsUrls.length} posts...`);
      
      if (!postAnalyticsUrls || postAnalyticsUrls.length === 0) {
        logger.log('No post analytics URLs provided, skipping advanced statistics');
        return;
      }
      
      logger.log(`Received ${postAnalyticsUrls.length} post analytics URLs from API`);
      
      // Process each analytics URL directly
      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        tabId, 
        email, 
        postAnalyticsUrls, 
        logger
      );
      
      // Results now include individual upload status for each post
      logger.log(`Advanced post statistics processing completed. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`);
      
      if (results.successful > 0) {
        logger.log(`Successfully uploaded ${results.successful} individual post analytics files`);
      }
      
      if (results.failed > 0) {
        logger.warn(`Failed to process ${results.failed} posts. Check logs for details.`);
      }
      
      // Return the results so they can be used for success message
      return results;
      
    } catch (error) {
      logger.error(`Advanced post statistics processing failed: ${error.message}`);
      // Don't throw the error - we don't want to fail the main automation
      // if advanced statistics fail
      logger.log('Continuing with main automation despite advanced statistics failure');
      
      // Return null results on error
      return null;
    }
  },

  /**
   * Check if URL is a valid LinkedIn post URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid LinkedIn post URL
   */
  isLinkedInPostUrl(url) {
    const linkedInPatterns = [
      /linkedin\.com\/posts\//,
      /linkedin\.com\/feed\/update\//,
      /activity[:-]\d{19}/
    ];

    return linkedInPatterns.some(pattern => pattern.test(url));
  },

  /**
   * Try multiple strategies to click the Export button
   * @param {number} tabId - The ID of the tab
   * @param {string} email - The user's email address
   * @param {Object} webRequestTracker - The WebRequestTracker object
   * @param {Object} fileUploader - The FileUploader object
   * @param {Object} logger - The Logger object
   * @returns {Promise<void>}
   * @throws {Error} If all click attempts fail
   */
  async clickExportButton(tabId, email, webRequestTracker, fileUploader, logger) {
    let downloadTracked = false;
    let downloadUrl = null;

    try {
      // Track download before clicking
      const downloadTracker = webRequestTracker.trackDownload(tabId);

      // Attempt to click the button
      await MultilingualTabInteractions.clickButton(tabId, 'export');

      // Wait for potential download
      const apiURL = await Promise.race([
        downloadTracker,
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Download timeout')), 30000)
        )
      ]);

      // Store the download URL for advanced processing
      downloadUrl = apiURL;
      logger.log(`Download URL captured: ${downloadUrl}`);

      // If download is successful, upload the file and get API response
      const apiResponse = await fileUploader.uploadToWebhook(apiURL, email);
      downloadTracked = true;
      
      logger.log('API response received for advanced statistics processing');

      return { 
        success: true, 
        downloadUrl: downloadUrl,
        apiResponse: apiResponse
      };

    } catch (error) {
      logger.warn(`Attempt to click 'export' failed: ${error.message}`);
      throw error;
    }

    if (!downloadTracked) {
      throw new Error('Failed to download file after multiple attempts');
    }
  }
};

// ============================================================================
// CONFIGURATION CONSTANTS
// ============================================================================

/**
 * Application constants for timing, URLs, and configuration
 */
const CONFIG = {
  // Default execution interval (3 days in milliseconds)
  DEFAULT_EXECUTION_INTERVAL: 3 * 24 * 60 * 60 * 1000,

  // Alarm names for scheduling
  ALARMS: {
    MAIN: "autoDownloadAndUpload",
    WATCHDOG: "watchdog",
    RETRY: "retryExecution"
  },

  // API endpoints
  ENDPOINTS: {
    WEBHOOK: "https://cwf6tbhekvwzbb35oe3psa7lza0oiaoj.lambda-url.us-east-1.on.aws/"
  },

  // Retry configuration
  RETRY: {
    INTERVAL: 2 * 60 * 1000, // 2 minutes in milliseconds (reduced from 5)
    MAX_ATTEMPTS: 3          // Increased from 2
  },

  // LinkedIn URLs
  LINKEDIN: {
    HOME: "https://linkedin.com",
    ANALYTICS: "https://www.linkedin.com/analytics/creator/content/?metricType=IMPRESSIONS&timeRange=past_28_days"
  }
};

// Current execution interval (can be modified based on user settings)
let EXECUTION_INTERVAL = CONFIG.DEFAULT_EXECUTION_INTERVAL;

// ============================================================================
// LOGGING UTILITY
// ============================================================================

/**
 * Persistent logging utility for consistent logging and storage of log messages
 */
const PersistentLogger = {
  /**
   * Log a message with specified level
   * @param {string} message - The message to log
   * @param {string} level - Log level (info, error, warn)
   */
  log(message, level = 'info') {
    const timestamp = new Date().toISOString();
    console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`);

    // Store logs in chrome storage for persistent logging
    chrome.storage.local.get(['logs'], (result) => {
      const logs = result.logs || [];
      logs.push({ timestamp, level, message });

      // Keep only the last 100 logs to prevent storage overflow
      const trimmedLogs = logs.slice(-100);
      chrome.storage.local.set({ logs: trimmedLogs });
    });
  },

  /**
   * Log an error message
   * @param {string} message - The error message
   */
  error(message) {
    this.log(message, 'error');
  },

  /**
   * Log a warning message
   * @param {string} message - The warning message
   */
  warn(message) {
    this.log(message, 'warn');
  }
};

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Custom error class for automation-related errors
 */
class AutomationError extends Error {
  /**
   * Create a new AutomationError
   * @param {string} message - Error message
   * @param {Object} context - Additional context information
   */
  constructor(message, context = {}) {
    super(message);
    this.name = 'AutomationError';
    this.context = context;
  }
}

// ============================================================================
// CONFIGURATION MANAGER
// ============================================================================

/**
 * Manages configuration and state for the extension
 */
const ConfigManager = {
  /**
   * Get the user's email address from storage
   * @returns {Promise<string>} The user's email address
   * @throws {AutomationError} If email is not configured
   */
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

  /**
   * Update the execution status in storage
   * @param {string} status - The execution status
   * @param {Error} error - Optional error object
   * @returns {Promise<void>}
   */
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
        PersistentLogger.log(`Execution status updated: ${status}`);
        resolve();
      });
    });
  },

  /**
   * Get the current retry count
   * @returns {Promise<number>} The current retry count
   */
  async getRetryCount() {
    return new Promise((resolve) => {
      chrome.storage.local.get(['retryCount'], (result) => {
        resolve(result.retryCount || 0);
      });
    });
  },

  /**
   * Update the retry count
   * @param {number} count - The new retry count
   * @returns {Promise<void>}
   */
  async updateRetryCount(count) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ retryCount: count }, () => {
        PersistentLogger.log(`Retry count updated: ${count}`);
        resolve();
      });
    });
  },

  /**
   * Reset the retry count to zero
   * @returns {Promise<void>}
   */
  async resetRetryCount() {
    return new Promise((resolve) => {
      chrome.storage.local.set({ retryCount: 0 }, () => {
        PersistentLogger.log('Retry count reset to 0');
        resolve();
      });
    });
  }
};

// ============================================================================
// WEB REQUEST TRACKER
// ============================================================================

/**
 * Tracks web requests to detect file downloads
 */
const WebRequestTracker = {
  /**
   * Track a file download from a specific tab
   * @param {number} tabId - The ID of the tab to track
   * @param {number} timeout - Timeout in milliseconds
   * @returns {Promise<string>} The URL of the downloaded file
   * @throws {AutomationError} If no download is detected within the timeout
   */
  trackDownload(tabId, timeout = 15000) {
    return new Promise((resolve, reject) => {
      const listener = (details) => {
        if (details.method === "GET" && details.url.includes(".xlsx")) {
          chrome.webRequest.onBeforeRequest.removeListener(listener);
          resolve(details.url);
        }
      };

      chrome.webRequest.onBeforeRequest.addListener(
        listener,
        { urls: ["<all_urls>"] },
        []
      );

      // Set a timeout to reject if no download is detected
      setTimeout(() => {
        chrome.webRequest.onBeforeRequest.removeListener(listener);
        reject(new AutomationError('No .xlsx download detected', {
          tabId,
          timeout
        }));
      }, timeout);
    });
  }
};

// ============================================================================
// INITIALIZATION FUNCTIONS
// ============================================================================

/**
 * Initialize the execution interval based on stored settings
 * @returns {Promise<void>}
 */
async function initializeExecutionInterval() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['uploadFrequency'], (result) => {
      if (result.uploadFrequency) {
        switch(result.uploadFrequency) {
          case 'daily':
            EXECUTION_INTERVAL = 24 * 60 * 60 * 1000; // 1 day
            break;
          default:
            EXECUTION_INTERVAL = CONFIG.DEFAULT_EXECUTION_INTERVAL; // 3 days (default)
        }
      }
      PersistentLogger.log(`Execution interval set to ${EXECUTION_INTERVAL / (24 * 60 * 60 * 1000)} days`);
      resolve();
    });
  });
}

// ============================================================================
// FILE UPLOADER
// ============================================================================

/**
 * Handles file uploads to the webhook
 */
const FileUploader = {
  /**
   * Upload a file to the webhook
   * @param {string} fileUrl - The URL of the file to upload
   * @param {string} email - The user's email address
   * @returns {Promise<Object>} The response from the webhook
   * @throws {AutomationError} If file fetch or upload fails
   */
  async uploadToWebhook(fileUrl, email) {
    try {
      if (!fileUrl) {
        throw new AutomationError('File URL is not provided');
      }

      // Fetch the file
      PersistentLogger.log(`Fetching file from URL: ${fileUrl}`);
      const response = await fetch(fileUrl);

      if (!response.ok) {
        throw new AutomationError('Failed to fetch file', {
          status: response.status,
          url: fileUrl
        });
      }

      // Create Blob and extract filename
      const fileBlob = await response.blob();
      const urlParams = new URLSearchParams(new URL(fileUrl).search);
      const fileName = urlParams.get('x-ambry-um-filename') || 'default_filename.xlsx';

      if (!fileName.endsWith('.xlsx')) {
        throw new AutomationError('Invalid file type', {
          fileName
        });
      }

      // Prepare FormData
      const formData = new FormData();
      formData.append("Email", email);
      formData.append("xlsx", fileBlob, fileName);

      // Upload to webhook
      PersistentLogger.log('Uploading file to webhook...');
      const uploadResponse = await fetch(CONFIG.ENDPOINTS.WEBHOOK, {
        method: "POST",
        body: formData,
      });

      if (!uploadResponse.ok) {
        throw new AutomationError('Upload failed', {
          status: uploadResponse.status,
          responseText: await uploadResponse.text()
        });
      }

      PersistentLogger.log('File successfully uploaded');
      const apiResponse = await uploadResponse.json();
      
      // Handle Lambda response format with statusCode and body
      if (apiResponse.statusCode === 200 && apiResponse.body) {
        // Parse the body if it's a string
        let responseBody = apiResponse.body;
        if (typeof responseBody === 'string') {
          try {
            responseBody = JSON.parse(responseBody);
          } catch (parseError) {
            PersistentLogger.warn(`Failed to parse response body: ${parseError.message}`);
            responseBody = apiResponse.body;
          }
        }
        
        PersistentLogger.log(`API response: ${responseBody.message || 'Success'}`);
        if (responseBody.extracted_urls) {
          PersistentLogger.log(`Extracted ${responseBody.extracted_urls.length} analytics URLs from Excel file`);
        }
        
        return responseBody;
      } else {
        // Fallback for direct response format
        PersistentLogger.log(`API response: ${apiResponse.message || 'Success'}`);
        return apiResponse;
      }

    } catch (error) {
      PersistentLogger.error(`File upload error: ${error.message}`);
      throw error;
    }
  }
};

// ============================================================================
// RETRY MECHANISM
// ============================================================================

/**
 * Schedule a retry attempt
 * @returns {Promise<void>}
 */
async function scheduleRetry() {
  const currentRetryCount = await ConfigManager.getRetryCount();
  PersistentLogger.log(`Current retry count before scheduling: ${currentRetryCount}`);

  // Reset retry count if it's already at or above the maximum
  if (currentRetryCount >= CONFIG.RETRY.MAX_ATTEMPTS) {
    PersistentLogger.log(`Retry count ${currentRetryCount} is at or above maximum ${CONFIG.RETRY.MAX_ATTEMPTS}. Resetting to 0.`);
    await ConfigManager.resetRetryCount();
    // Clear retry flags
    chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
    PersistentLogger.log('Retry count has been reset to 0 and retry flags cleared.');
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

  // Create alarm for retry execution
  chrome.alarms.create(CONFIG.ALARMS.RETRY, { when: retryTime });

  PersistentLogger.log(`Scheduled retry #${newRetryCount} in 2 minutes. Time: ${retryTimeISO}`);
  PersistentLogger.log('Using alarm-based retry mechanism only');
}


// ============================================================================
// MAIN AUTOMATION SCRIPT
// ============================================================================

/**
 * Run the main automation script
 * @returns {Promise<void>}
 */
async function runAutomationScript() {
  try {
    // Retrieve email
    const email = await ConfigManager.getEmail();

    // Update execution status to Running
    await ConfigManager.updateExecutionStatus('Running');

    // Log the execution attempt with timestamp
    const timestamp = new Date().toISOString();
    PersistentLogger.log(`=== AUTOMATION SCRIPT STARTED at ${timestamp} ===`);

    // Randomly choose between the existing and new solution
    const useDirect = Math.random() < 0.5; // 50% chance for each
    PersistentLogger.log(`Using direct approach: ${useDirect}`);

    if (useDirect) {
      // New solution: use executeStepsDirect with multi-language support
      chrome.tabs.create({
        url: CONFIG.LINKEDIN.ANALYTICS,
        active: false
      }, async (tab) => {
        if (!tab || !tab.id) {
          const error = new Error('Failed to create tab');
          PersistentLogger.error(`Tab creation failed: ${error.message}`);
          await scheduleRetry();
          return;
        }

        const tabId = tab.id;
        PersistentLogger.log(`Created tab with ID: ${tabId}`);

        try {
          await LinkedInMultilingualAutomation.executeStepsDirect(
            tabId,
            email,
            WebRequestTracker,
            FileUploader,
            ConfigManager,
            Logger
          );
          // If successful, reset retry count
          await ConfigManager.resetRetryCount();
          // Clear retry flags
          chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
          PersistentLogger.log(`=== AUTOMATION COMPLETED SUCCESSFULLY at ${new Date().toISOString()} ===`);

          // Check if company page upload is needed
          await checkAndRunCompanyPageUpload();
        } catch (error) {
          PersistentLogger.error(`Direct automation script failed: ${error.message}`);
          await scheduleRetry();
          // Close the tab if it still exists
          try {
            PersistentLogger.log(`Attempting to close tab ${tabId}`);
            chrome.tabs.remove(tabId);
          } catch (e) {
            PersistentLogger.log(`Tab ${tabId} already closed or doesn't exist`);
          }
        }
      });
    } else {
      // Use multi-language solution for standard flow
      chrome.tabs.create({
        url: CONFIG.LINKEDIN.HOME,
        active: false
      }, async (tab) => {
        if (!tab || !tab.id) {
          const error = new Error('Failed to create tab');
          PersistentLogger.error(`Tab creation failed: ${error.message}`);
          await scheduleRetry();
          return;
        }

        const tabId = tab.id;
        PersistentLogger.log(`Created tab with ID: ${tabId}`);

        try {
          await LinkedInMultilingualAutomation.executeSteps(
            tabId,
            email,
            WebRequestTracker,
            FileUploader,
            ConfigManager,
            Logger
          );
          // If successful, reset retry count
          await ConfigManager.resetRetryCount();
          // Clear retry flags
          chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
          PersistentLogger.log(`=== AUTOMATION COMPLETED SUCCESSFULLY at ${new Date().toISOString()} ===`);

          // Check if company page upload is needed
          await checkAndRunCompanyPageUpload();
        } catch (error) {
          PersistentLogger.error(`Automation script failed: ${error.message}`);
          await scheduleRetry();
          // Close the tab if it still exists
          try {
            PersistentLogger.log(`Attempting to close tab ${tabId}`);
            chrome.tabs.remove(tabId);
          } catch (e) {
            PersistentLogger.log(`Tab ${tabId} already closed or doesn't exist`);
          }
        }
      });
    }
  } catch (error) {
    PersistentLogger.error(`Automation initialization failed: ${error.message}`);
    await ConfigManager.updateExecutionStatus('Failed', error);
    await scheduleRetry();
  }
}

// ============================================================================
// COMPANY PAGE AUTOMATION
// ============================================================================

// Global flag to prevent multiple company automations from running simultaneously
let companyAutomationRunning = false;

/**
 * Check if company page upload is needed and run it if necessary
 */
async function checkAndRunCompanyPageUpload() {
  try {
    // Prevent multiple simultaneous executions
    if (companyAutomationRunning) {
      PersistentLogger.log('Company automation already running, skipping duplicate request');
      return;
    }

    PersistentLogger.log('Checking if company page upload is needed...');

    // Get company ID from storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['companyId', 'lastCompanyExecutionTime'], resolve);
    });

    if (!result.companyId) {
      PersistentLogger.log('No company ID configured, skipping company page upload');
      return;
    }

    const companyId = result.companyId;
    const lastCompanyExecution = result.lastCompanyExecutionTime;
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds

    // Check if last execution was more than 7 days ago or never executed
    if (!lastCompanyExecution || lastCompanyExecution < sevenDaysAgo) {
      PersistentLogger.log(`Company page upload needed. Last execution: ${lastCompanyExecution ? new Date(lastCompanyExecution).toISOString() : 'Never'}`);
      await runCompanyPageAutomation(companyId);
    } else {
      PersistentLogger.log(`Company page upload not needed. Last execution: ${new Date(lastCompanyExecution).toISOString()}`);
      // Update next execution time
      const nextExecution = lastCompanyExecution + (7 * 24 * 60 * 60 * 1000);
      chrome.storage.local.set({ nextCompanyExecution: nextExecution });
    }
  } catch (error) {
    PersistentLogger.error(`Error checking company page upload: ${error.message}`);
  }
}

/**
 * Run the company page automation script
 * @param {string} companyId - The LinkedIn company ID
 */
async function runCompanyPageAutomation(companyId) {
  // Set the running flag
  companyAutomationRunning = true;

  try {
    PersistentLogger.log(`Starting company page automation for company ${companyId}`);

    // Update company execution status
    const now = Date.now();
    chrome.storage.local.set({
      lastCompanyExecutionTime: now,
      lastCompanyExecutionStatus: 'Running'
    });

    // Get user email
    const email = await ConfigManager.getEmail();
    if (!email) {
      throw new Error('User email not configured');
    }

    // Create tab for company analytics page
    const companyUrl = `https://www.linkedin.com/company/${companyId}/admin/analytics/updates/`;

    chrome.tabs.create({
      url: companyUrl,
      active: false
    }, async (tab) => {
      if (!tab || !tab.id) {
        const error = new Error('Failed to create company analytics tab');
        PersistentLogger.error(`Company tab creation failed: ${error.message}`);
        await updateCompanyExecutionStatus('Failed', error);
        companyAutomationRunning = false; // Reset flag
        return;
      }

      const tabId = tab.id;
      PersistentLogger.log(`Created company analytics tab with ID: ${tabId}`);

      try {
        await executeCompanyPageSteps(tabId, companyId, email);

        // Update success status
        await updateCompanyExecutionStatus('Success');

        // Schedule next execution (7 days from now)
        const nextExecution = now + (7 * 24 * 60 * 60 * 1000);
        chrome.storage.local.set({ nextCompanyExecution: nextExecution });

        PersistentLogger.log(`Company page automation completed successfully`);
      } catch (error) {
        PersistentLogger.error(`Company page automation failed: ${error.message}`);
        await updateCompanyExecutionStatus('Failed', error);

        // Close the tab if it still exists
        try {
          chrome.tabs.remove(tabId);
        } catch (e) {
          PersistentLogger.log(`Company tab ${tabId} already closed or doesn't exist`);
        }
      } finally {
        // Always reset the running flag
        companyAutomationRunning = false;
      }
    });
  } catch (error) {
    PersistentLogger.error(`Company page automation initialization failed: ${error.message}`);
    await updateCompanyExecutionStatus('Failed', error);
    companyAutomationRunning = false; // Reset flag
  }
}

/**
 * Execute the steps for company page analytics download
 * @param {number} tabId - The tab ID
 * @param {string} companyId - The company ID
 * @param {string} email - User email
 */
async function executeCompanyPageSteps(tabId, companyId, email) {
  return new Promise((resolve, reject) => {
    let downloadStarted = false;
    let downloadCompleted = false;
    let exportPopupHandled = false;
    let secondExportClicked = false;
    const timeout = 120000; // 120 seconds timeout (increased for popup handling)

    // Set up download listener
    const downloadListener = (downloadItem) => {
      // Only log if it's a potential analytics file
      if (downloadItem.filename &&
          (downloadItem.filename.includes('analytics') ||
           downloadItem.filename.includes('export') ||
           downloadItem.filename.includes('company') ||
           downloadItem.filename.toLowerCase().includes('.xlsx') ||
           downloadItem.filename.toLowerCase().includes('.xls'))) {

        downloadStarted = true;
        PersistentLogger.log(`Company analytics download started: ${downloadItem.filename.split('/').pop() || downloadItem.filename.split('\\').pop()}`);

        // Monitor download completion
        const checkDownload = () => {
          chrome.downloads.search({ id: downloadItem.id }, (results) => {
            if (results.length > 0) {
              const download = results[0];

              if (download.state === 'complete') {
                downloadCompleted = true;
                PersistentLogger.log(`Company analytics download completed successfully`);

                // Upload the file
                uploadCompanyFile(download.filename, companyId, email)
                  .then(() => {
                    // Clean up - safely remove tab
                    try {
                      chrome.tabs.remove(tabId, () => {
                        if (chrome.runtime.lastError) {
                          // Tab already closed or doesn't exist - this is fine
                          PersistentLogger.log(`Tab ${tabId} was already closed`);
                        }
                      });
                    } catch (e) {
                      // Ignore tab removal errors
                      PersistentLogger.log(`Tab ${tabId} cleanup skipped - already closed`);
                    }
                    chrome.downloads.onCreated.removeListener(downloadListener);
                    resolve();
                  })
                  .catch(reject);
              } else if (download.state === 'interrupted') {
                chrome.downloads.onCreated.removeListener(downloadListener);
                reject(new Error(`Company analytics download failed: ${download.error}`));
              } else {
                // Still downloading, check again
                setTimeout(checkDownload, 1000);
              }
            }
          });
        };

        setTimeout(checkDownload, 1000);
      }
    };

    chrome.downloads.onCreated.addListener(downloadListener);

    // Wait for page to load and then click first export button
    chrome.tabs.onUpdated.addListener(function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        chrome.tabs.onUpdated.removeListener(listener);

        PersistentLogger.log('Company analytics page loaded, looking for first export button...');

        // Wait a bit for the page to fully render
        setTimeout(() => {
          // Inject script to find and click first export button
          chrome.scripting.executeScript({
            target: { tabId },
            function: findAndClickCompanyExportButton
          }, (results) => {
            if (results && results[0] && results[0].result) {
              PersistentLogger.log('First company export button clicked successfully');

              // Wait for popup/modal to appear and then handle the second export button
              setTimeout(() => {
                handleExportPopup(tabId);
              }, 3000); // Increased wait time to 3 seconds for popup to appear

            } else {
              chrome.downloads.onCreated.removeListener(downloadListener);
              reject(new Error('Failed to find or click first company export button'));
            }
          });
        }, 3000);
      }
    });

    // Function to handle the export popup/modal
    const handleExportPopup = (tabId) => {
      PersistentLogger.log('Looking for second export button in popup/modal...');

      chrome.scripting.executeScript({
        target: { tabId },
        function: findAndClickSecondExportButton
      }, (results) => {
        if (results && results[0] && results[0].result) {
          PersistentLogger.log('Second company export button clicked successfully');
          exportPopupHandled = true;
          secondExportClicked = true;

          // Wait longer for download to start after second click (5 seconds)
          setTimeout(() => {
            if (!downloadStarted) {
              PersistentLogger.log('Checking for recent company analytics downloads...');

              // Check for any recent downloads that might be the company file
              checkForRecentDownloads(companyId, email)
                .then(() => {
                  chrome.downloads.onCreated.removeListener(downloadListener);
                  // Safely remove tab
                  try {
                    chrome.tabs.remove(tabId, () => {
                      if (chrome.runtime.lastError) {
                        PersistentLogger.log(`Tab ${tabId} was already closed`);
                      }
                    });
                  } catch (e) {
                    PersistentLogger.log(`Tab ${tabId} cleanup skipped - already closed`);
                  }
                  resolve();
                })
                .catch(() => {
                  PersistentLogger.log('No recent downloads found, trying alternative export methods...');
                  // Try clicking again or look for alternative buttons
                  chrome.scripting.executeScript({
                    target: { tabId },
                    function: findAndClickAlternativeExportButton
                  }, (altResults) => {
                    if (altResults && altResults[0] && altResults[0].result) {
                      PersistentLogger.log('Alternative export button clicked');
                      // Wait another 5 seconds for this attempt
                      setTimeout(() => {
                        if (!downloadStarted) {
                          chrome.downloads.onCreated.removeListener(downloadListener);
                          reject(new Error('Company analytics download did not start after multiple attempts'));
                        }
                      }, 5000);
                    } else {
                      chrome.downloads.onCreated.removeListener(downloadListener);
                      reject(new Error('All export button attempts failed'));
                    }
                  });
                });
            }
          }, 5000); // Wait 5 seconds after second export click

        } else {
          PersistentLogger.log('Second export button not found, trying alternative approaches...');

          // Try alternative approaches for the popup
          setTimeout(() => {
            chrome.scripting.executeScript({
              target: { tabId },
              function: findAndClickAlternativeExportButton
            }, (altResults) => {
              if (altResults && altResults[0] && altResults[0].result) {
                PersistentLogger.log('Alternative export button clicked successfully');
                exportPopupHandled = true;
                secondExportClicked = true;

                // Wait for download after alternative click
                setTimeout(() => {
                  if (!downloadStarted) {
                    checkForRecentDownloads(companyId, email)
                      .then(() => {
                        chrome.downloads.onCreated.removeListener(downloadListener);
                        chrome.tabs.remove(tabId);
                        resolve();
                      })
                      .catch(() => {
                        chrome.downloads.onCreated.removeListener(downloadListener);
                        reject(new Error('Company analytics download did not start'));
                      });
                  }
                }, 5000);
              } else {
                chrome.downloads.onCreated.removeListener(downloadListener);
                reject(new Error('Failed to find second export button in popup'));
              }
            });
          }, 2000);
        }
      });
    };

    // Set timeout for the entire process
    setTimeout(() => {
      if (!downloadCompleted) {
        PersistentLogger.log('Company automation timeout - checking for recent downloads...');

        if (secondExportClicked) {
          // If we clicked the second export button, check for recent downloads
          checkForRecentDownloads(companyId, email)
            .then(() => {
              chrome.downloads.onCreated.removeListener(downloadListener);
              // Safely remove tab
              try {
                chrome.tabs.remove(tabId, () => {
                  if (chrome.runtime.lastError) {
                    PersistentLogger.log(`Tab ${tabId} was already closed`);
                  }
                });
              } catch (e) {
                PersistentLogger.log(`Tab ${tabId} cleanup skipped - already closed`);
              }
              resolve();
            })
            .catch(() => {
              chrome.downloads.onCreated.removeListener(downloadListener);
              // Safely remove tab
              try {
                chrome.tabs.remove(tabId, () => {
                  if (chrome.runtime.lastError) {
                    PersistentLogger.log(`Tab ${tabId} was already closed`);
                  }
                });
              } catch (e) {
                PersistentLogger.log(`Tab ${tabId} cleanup skipped - already closed`);
              }
              reject(new Error('Company page automation timed out - no download detected'));
            });
        } else {
          chrome.downloads.onCreated.removeListener(downloadListener);
          // Safely remove tab
          try {
            chrome.tabs.remove(tabId, () => {
              if (chrome.runtime.lastError) {
                PersistentLogger.log(`Tab ${tabId} was already closed`);
              }
            });
          } catch (e) {
            PersistentLogger.log(`Tab ${tabId} cleanup skipped - already closed`);
          }
          reject(new Error('Company page automation timed out'));
        }
      }
    }, timeout);
  });
}

/**
 * Check for recent downloads that might be the company analytics file
 * @param {string} companyId - The company ID
 * @param {string} email - User email
 * @returns {Promise} Promise that resolves if a recent download is found and uploaded
 */
async function checkForRecentDownloads(companyId, email) {
  return new Promise((resolve, reject) => {
    // Look for downloads from the last 30 seconds
    const thirtySecondsAgo = Date.now() - 30000;

    chrome.downloads.search({
      orderBy: ['-startTime'],
      limit: 10
    }, async (downloads) => {

      for (const download of downloads) {
        // Check if download started recently and looks like analytics data
        if (download.startTime && new Date(download.startTime).getTime() > thirtySecondsAgo) {

          // Check if filename suggests it's analytics data (xls/xlsx format)
          if (download.filename &&
              (download.filename.includes('analytics') ||
               download.filename.includes('export') ||
               download.filename.includes('company') ||
               download.filename.toLowerCase().includes('.xlsx') ||
               download.filename.toLowerCase().includes('.xls'))) {

            PersistentLogger.log(`Found recent company analytics file`);

            if (download.state === 'complete') {
              try {
                await uploadCompanyFile(download.filename, companyId, email);
                resolve();
                return;
              } catch (error) {
                PersistentLogger.error(`Failed to upload recent download: ${error.message}`);
              }
            } else if (download.state === 'in_progress') {
              // Wait for it to complete
              PersistentLogger.log('Download in progress, waiting for completion...');
              const waitForCompletion = () => {
                chrome.downloads.search({ id: download.id }, async (results) => {
                  if (results.length > 0 && results[0].state === 'complete') {
                    try {
                      await uploadCompanyFile(results[0].filename, companyId, email);
                      resolve();
                    } catch (error) {
                      reject(error);
                    }
                  } else if (results.length > 0 && results[0].state === 'interrupted') {
                    reject(new Error('Recent download was interrupted'));
                  } else {
                    setTimeout(waitForCompletion, 1000);
                  }
                });
              };
              waitForCompletion();
              return;
            }
          }
        }
      }

      reject(new Error('No recent company analytics downloads found'));
    });
  });
}

/**
 * Function to be injected into the company analytics page to find and click export button
 */
function findAndClickCompanyExportButton() {
  // Multi-language export button selectors
  const exportTexts = [
    'Export',      // English
    'Exportieren', // German
    'Exportar',    // Spanish
    'Exporter'     // French
  ];

  // Try different selectors
  const selectors = [
    'button',
    '[role="button"]',
    '.artdeco-button',
    'a'
  ];

  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    for (const element of elements) {
      const text = element.textContent?.trim();
      if (text && exportTexts.some(exportText =>
        text.toLowerCase().includes(exportText.toLowerCase())
      )) {
        console.log(`Found company export button with text: ${text}`);
        element.click();
        return true;
      }
    }
  }

  console.log('Company export button not found');
  return false;
}

/**
 * Function to be injected to find and click the second export button in popup/modal
 */
function findAndClickSecondExportButton() {
  console.log('Looking for second export button in popup/modal...');

  // Multi-language export button texts
  const exportTexts = [
    'Export',      // English
    'Exportieren', // German
    'Exportar',    // Spanish
    'Exporter'     // French
  ];

  // Look for modal/popup containers first
  const modalSelectors = [
    '[role="dialog"]',
    '.modal',
    '.popup',
    '.overlay',
    '[data-test-modal]',
    '.artdeco-modal',
    '.artdeco-dropdown-content'
  ];

  // First try to find buttons within modal containers
  for (const modalSelector of modalSelectors) {
    const modals = document.querySelectorAll(modalSelector);
    for (const modal of modals) {
      if (modal.offsetParent !== null) { // Check if modal is visible
        console.log(`Found visible modal: ${modalSelector}`);

        const buttons = modal.querySelectorAll('button, [role="button"], .artdeco-button, a');
        for (const button of buttons) {
          const text = button.textContent?.trim();
          if (text && exportTexts.some(exportText =>
            text.toLowerCase().includes(exportText.toLowerCase())
          )) {
            console.log(`Found second export button in modal with text: ${text}`);
            button.click();
            return true;
          }
        }
      }
    }
  }

  // If no modal found, look for any visible export buttons that might have appeared
  const allButtons = document.querySelectorAll('button, [role="button"], .artdeco-button, a');
  for (const button of allButtons) {
    if (button.offsetParent !== null) { // Check if button is visible
      const text = button.textContent?.trim();
      if (text && exportTexts.some(exportText =>
        text.toLowerCase().includes(exportText.toLowerCase())
      )) {
        // Make sure this is not the same button we clicked before
        const rect = button.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          console.log(`Found visible second export button with text: ${text}`);
          button.click();
          return true;
        }
      }
    }
  }

  console.log('Second export button not found in popup/modal');
  return false;
}

/**
 * Function to be injected to find alternative export buttons or download options
 */
function findAndClickAlternativeExportButton() {
  console.log('Looking for alternative export/download buttons...');

  // Alternative texts that might appear
  const alternativeTexts = [
    'Download',
    'Save',
    'Excel',
    'XLSX',
    'XLS',
    'Herunterladen', // German
    'Descargar',     // Spanish
    'Télécharger',   // French
    'Guardar',       // Spanish Save
    'Enregistrer'    // French Save
  ];

  // Look for any clickable elements with alternative texts
  const clickableElements = document.querySelectorAll('button, [role="button"], .artdeco-button, a, span[role="button"]');

  for (const element of clickableElements) {
    if (element.offsetParent !== null) { // Check if element is visible
      const text = element.textContent?.trim();
      const ariaLabel = element.getAttribute('aria-label');
      const title = element.getAttribute('title');

      // Check text content, aria-label, and title
      const textToCheck = [text, ariaLabel, title].filter(Boolean).join(' ').toLowerCase();

      if (alternativeTexts.some(altText =>
        textToCheck.includes(altText.toLowerCase())
      )) {
        console.log(`Found alternative export button with text: ${text || ariaLabel || title}`);
        element.click();
        return true;
      }
    }
  }

  // Last resort: look for any button that might trigger a download
  const downloadLinks = document.querySelectorAll('a[download], a[href*="download"], a[href*="export"]');
  for (const link of downloadLinks) {
    if (link.offsetParent !== null) {
      console.log(`Found download link: ${link.href}`);
      link.click();
      return true;
    }
  }

  console.log('No alternative export buttons found');
  return false;
}

/**
 * Upload company analytics file to the API
 * @param {string} filename - The downloaded file name
 * @param {string} companyId - The company ID
 * @param {string} email - User email
 */
async function uploadCompanyFile(filename, companyId, email) {
  return new Promise((resolve, reject) => {
    // Search for the downloaded file
    chrome.downloads.search({
      filename: filename,
      orderBy: ['-startTime'],
      limit: 1
    }, async (downloads) => {
      if (downloads.length === 0) {
        reject(new Error('Company analytics file not found'));
        return;
      }

      const download = downloads[0];
      PersistentLogger.log(`Found company analytics file: ${download.filename}`);

      try {
        // Get the download URL - LinkedIn provides direct download URLs
        const downloadUrl = download.url;

        if (!downloadUrl) {
          reject(new Error('Download URL not available'));
          return;
        }

        PersistentLogger.log(`Fetching company file from URL: ${downloadUrl}`);

        // Fetch the file content
        const response = await fetch(downloadUrl);

        if (!response.ok) {
          reject(new Error(`Failed to fetch company file: ${response.status}`));
          return;
        }

        // Get the file as blob
        const fileBlob = await response.blob();

        // Convert to base64
        const reader = new FileReader();
        reader.onload = async function() {
          try {
            const base64Data = reader.result.split(',')[1]; // Remove data:... prefix

            // Validate required parameters
            if (!companyId) {
              reject(new Error('Company ID is missing or empty'));
              return;
            }

            if (!email) {
              reject(new Error('User email is missing or empty'));
              return;
            }

            if (!base64Data) {
              reject(new Error('File data is missing or empty'));
              return;
            }

            // Extract just the filename from the full path (handle both Windows and Unix paths)
            let justFilename = download.filename;

            // Debug: Log the original filename
            PersistentLogger.log(`[DEBUG] Original filename: "${download.filename}"`);

            // Handle Windows paths (C:\Users\...)
            if (justFilename.includes('\\')) {
              justFilename = justFilename.split('\\').pop();
              PersistentLogger.log(`[DEBUG] After Windows split: "${justFilename}"`);
            }

            // Handle Unix paths (/home/user/...)
            if (justFilename.includes('/')) {
              justFilename = justFilename.split('/').pop();
              PersistentLogger.log(`[DEBUG] After Unix split: "${justFilename}"`);
            }

            // Fallback if extraction failed
            if (!justFilename || justFilename === download.filename) {
              // Try to extract from the end of the path using regex
              const match = download.filename.match(/[^\\\/]+$/);
              justFilename = match ? match[0] : 'company_analytics.xls';
              PersistentLogger.log(`[DEBUG] After regex fallback: "${justFilename}"`);
            }

            PersistentLogger.log(`[DEBUG] Final filename: "${justFilename}"`);

            // Prepare the payload for the company API
            const payload = {
              company_id: String(companyId), // Ensure it's a string
              user_email: String(email),     // Ensure it's a string
              file: base64Data,
              file_name: justFilename
            };

            PersistentLogger.log(`Uploading company analytics file for company ${companyId}`);

            // Upload to company API endpoint
            const uploadResponse = await fetch('https://sn6ujdpryv35cap42dqlgmyybe0wsxso.lambda-url.us-east-1.on.aws/', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(payload)
            });

            if (uploadResponse.ok) {
              const responseData = await uploadResponse.json();
              PersistentLogger.log('Company analytics file uploaded successfully');
              resolve(responseData);
            } else {
              const errorText = await uploadResponse.text();
              PersistentLogger.error(`Company file upload failed: ${uploadResponse.status} - ${errorText}`);
              reject(new Error(`Company file upload failed: ${uploadResponse.status} - ${errorText}`));
            }
          } catch (error) {
            reject(new Error(`Company file processing error: ${error.message}`));
          }
        };

        reader.onerror = () => {
          reject(new Error('Failed to read company analytics file'));
        };

        reader.readAsDataURL(fileBlob);

      } catch (error) {
        reject(new Error(`Error processing company analytics file: ${error.message}`));
      }
    });
  });
}

/**
 * Update company execution status in storage
 * @param {string} status - The execution status
 * @param {Error} error - Optional error object
 */
async function updateCompanyExecutionStatus(status, error = null) {
  const updateData = {
    lastCompanyExecutionStatus: status,
    lastCompanyExecutionTime: Date.now()
  };

  if (error) {
    updateData.lastCompanyExecutionError = JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack
    });
  } else {
    // Clear previous error if successful
    chrome.storage.local.remove(['lastCompanyExecutionError']);
  }

  chrome.storage.local.set(updateData);
  PersistentLogger.log(`Company execution status updated: ${status}`);
}

// ============================================================================
// ALARM MANAGER
// ============================================================================

/**
 * Manages Chrome alarms for scheduling tasks
 */
const AlarmManager = {
  // Flags to prevent duplicate setups
  _initialAlarmSetup: false,
  _watchdogAlarmSetup: false,
  _listenersInitialized: false,

  /**
   * Set up the initial alarm
   * @returns {Promise<void>}
   */
  setupInitialAlarm: async function() {
    if (this._initialAlarmSetup) {
      PersistentLogger.log("Initial alarm already set up, skipping duplicate setup");
      return;
    }
    this._initialAlarmSetup = true;
    
    await initializeExecutionInterval();

    chrome.storage.local.get("nextExecution", (data) => {
      const now = new Date();
      let nextExecution;

      if (data.nextExecution) {
        nextExecution = new Date(data.nextExecution);

        // Check if stored execution time is in the past
        if (now >= nextExecution) {
          PersistentLogger.log("Stored execution time is in the past. Running task now.");
          runAutomationScript();
          nextExecution = new Date(now.getTime() + EXECUTION_INTERVAL);
        }
      } else {
        // First-time setup
        nextExecution = new Date(now.getTime() + EXECUTION_INTERVAL);
      }

      // Create recurring alarm
      chrome.alarms.create(CONFIG.ALARMS.MAIN, {
        periodInMinutes: EXECUTION_INTERVAL / (60 * 1000)
      });

      // Save next execution time and mark alarms as enabled
      chrome.storage.local.set({
        nextExecution: nextExecution.toISOString(),
        alarmsEnabled: true
      });

      PersistentLogger.log(`Alarm set. Next execution: ${nextExecution}`);
    });
  },

  /**
   * Set up the watchdog alarm
   */
  setupWatchdogAlarm() {
    // Run the watchdog more frequently (every 1 minute) to catch missed retries
    chrome.alarms.create(CONFIG.ALARMS.WATCHDOG, { periodInMinutes: 1 });
    PersistentLogger.log("Watchdog alarm set to run every minute");

    // Mark alarms as enabled
    chrome.storage.local.set({ alarmsEnabled: true });
    PersistentLogger.log("Alarms marked as enabled in storage");

    // Debug current alarms
    //chrome.alarms.getAll((alarms) => {
    //  PersistentLogger.log(`Initial alarms: ${JSON.stringify(alarms.map(a => ({
  //    name: a.name,
    //    scheduledTime: new Date(a.scheduledTime).toISOString(),
    //    periodInMinutes: a.periodInMinutes
    //  })))}`);
    //});
  },

  /**
   * Initialize alarm listeners
   */
  initializeAlarmListeners() {
    chrome.alarms.onAlarm.addListener((alarm) => {
      PersistentLogger.log(`Alarm triggered: ${alarm.name} at ${new Date().toISOString()}`);

      switch(alarm.name) {
        case CONFIG.ALARMS.MAIN:
          this.handleMainAlarm();
          break;
        case CONFIG.ALARMS.WATCHDOG:
          this.checkForMissedExecutions();
          break;
        case CONFIG.ALARMS.RETRY:
          this.handleRetryAlarm();
          break;
      }
    });
  },

  /**
   * Handle the main alarm trigger
   */
  handleMainAlarm() {
    const nextExecution = new Date(Date.now() + EXECUTION_INTERVAL);
    chrome.storage.local.set({
      nextExecution: nextExecution.toISOString()
    });

    PersistentLogger.log(`Main alarm triggered. Next execution: ${nextExecution}`);
    runAutomationScript();
  },

  /**
   * Check for missed executions
   */
  checkForMissedExecutions() {
    // First check for missed regular executions
    chrome.storage.local.get(["nextExecution", "nextRetryTime", "retryScheduled", "retryCount"], (data) => {
      const now = new Date();
      const timestamp = now.toISOString();

      // Check for missed retry
      if (data.retryScheduled && data.nextRetryTime) {
        const nextRetryTime = new Date(data.nextRetryTime);
        if (now >= nextRetryTime) {
          PersistentLogger.log(`=== WATCHDOG DETECTED MISSED RETRY at ${timestamp} ===`);
          PersistentLogger.log("Watchdog detected missed retry execution. Running retry now.");

          // Clear the retry scheduled flag
          chrome.storage.local.set({ retryScheduled: false });

          // Log the retry count
          PersistentLogger.log(`Current retry count: ${data.retryCount || 0}`);
          PersistentLogger.log(`Next retry time was: ${data.nextRetryTime}`);
          PersistentLogger.log(`Current time is: ${timestamp}`);
          PersistentLogger.log(`Time difference: ${now - nextRetryTime}ms`);

          // Run the automation script
          runAutomationScript();
          return; // Exit early to avoid running regular execution check
        }
      }

      // Check for missed regular execution
      if (data.nextExecution) {
        const nextExecution = new Date(data.nextExecution);
        if (now >= nextExecution) {
          PersistentLogger.log("Watchdog detected missed execution. Running task now.");
          runAutomationScript();

          // Reschedule next execution
          const newExecutionTime = new Date(now.getTime() + EXECUTION_INTERVAL);
          chrome.alarms.create(CONFIG.ALARMS.MAIN, {
            when: newExecutionTime.getTime()
          });
          chrome.storage.local.set({
            nextExecution: newExecutionTime.toISOString()
          });
        }
      }
    });
  },

  /**
   * Handle the retry alarm trigger
   */
  handleRetryAlarm() {
    const timestamp = new Date().toISOString();
    PersistentLogger.log(`=== RETRY ALARM TRIGGERED at ${timestamp} ===`);
    PersistentLogger.log(`Retry alarm handler started. Time: ${timestamp}`);

    // Debug information about retry state
    chrome.storage.local.get(['retryCount', 'nextRetryTime', 'retryScheduled'], (data) => {
      PersistentLogger.log(`Current retry count before execution: ${data.retryCount || 0}`);
      PersistentLogger.log(`Retry scheduled: ${data.retryScheduled ? 'Yes' : 'No'}`);
      PersistentLogger.log(`Next retry time: ${data.nextRetryTime || 'Not set'}`);

      // Only proceed if retry is still scheduled (prevents race conditions)
      if (data.retryScheduled) {
        // Clear the retry scheduled flag immediately to prevent duplicate executions
        chrome.storage.local.set({ retryScheduled: false }, () => {
          PersistentLogger.log('Retry scheduled flag cleared, proceeding with execution');

          // Run the automation script with error handling
          try {
            PersistentLogger.log('Starting automation script from retry handler');
            runAutomationScript().catch(error => {
              PersistentLogger.error(`Retry execution failed: ${error.message}`);
            });
          } catch (error) {
            PersistentLogger.error(`Error in retry handler: ${error.message}`);
          }
        });
      } else {
        PersistentLogger.log('Retry not scheduled or already handled, skipping execution');
      }
    });
  }
};

// ============================================================================
// RUNTIME EVENT LISTENERS
// ============================================================================

/**
 * Set up runtime event listeners
 */
function setupRuntimeListeners() {
  // Handle manual script execution
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'executeScript') {
      const nextExecution = new Date(Date.now() + EXECUTION_INTERVAL);
      chrome.storage.local.set({
        nextExecution: nextExecution.toISOString()
      });

      PersistentLogger.log(`Manual execution triggered. Next execution: ${nextExecution}`);
      runAutomationScript();
    }
    else if (message.action === 'executeCompanyScript') {
      // Check if company automation is already running
      if (companyAutomationRunning) {
        PersistentLogger.log('Company automation already running, ignoring manual request');
        return;
      }

      PersistentLogger.log(`Manual company execution triggered for company ID: ${message.companyId}`);
      runCompanyPageAutomation(message.companyId);
    }
    else if (message.action === 'updateInterval') {
      // Update the execution interval
      EXECUTION_INTERVAL = message.interval;

      // Reset the alarm with the new interval
      chrome.alarms.clear(CONFIG.ALARMS.MAIN, (wasCleared) => {
        if (wasCleared) {
          const nextExecution = new Date(Date.now() + EXECUTION_INTERVAL);
          chrome.alarms.create(CONFIG.ALARMS.MAIN, {
            periodInMinutes: EXECUTION_INTERVAL / (60 * 1000)
          });

          chrome.storage.local.set({
            nextExecution: nextExecution.toISOString()
          });

          PersistentLogger.log(`Execution interval updated to ${EXECUTION_INTERVAL / (24 * 60 * 60 * 1000)} days. Next execution: ${nextExecution}`);
        }
      });
    }
  });

  // Handle browser startup and extension installation
  chrome.runtime.onInstalled.addListener((details) => {
    PersistentLogger.log(`Extension installed/updated. Reason: ${details.reason}`);
    
    // Only run full initialization on install, not on updates
    if (details.reason === 'install') {
      PersistentLogger.log("First-time installation detected, running safe initialization");
      safeInitializeExtension();
    } else {
      PersistentLogger.log("Extension update detected, skipping duplicate initialization");
      // Just ensure alarms are enabled
      chrome.storage.local.set({ alarmsEnabled: true }, () => {
        PersistentLogger.log("alarmsEnabled flag set to true after update");
      });
    }
  });

  chrome.runtime.onStartup.addListener(() => {
    PersistentLogger.log("Browser startup detected");
    // Only set the flag, don't re-initialize everything
    chrome.storage.local.set({ alarmsEnabled: true }, () => {
      PersistentLogger.log("alarmsEnabled flag set to true on browser startup");
    });
    
    // Ensure alarms are still active (they might have been cleared)
    AlarmManager.setupInitialAlarm();
    AlarmManager.setupWatchdogAlarm();
  });

  // Handle system idle state changes
  chrome.idle.onStateChanged.addListener((newState) => {
    if (newState === "active") {
      AlarmManager.checkForMissedExecutions();
    }
  });
}

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the extension
 * @returns {Promise<void>}
 */
async function initializeExtension() {
  await initializeExecutionInterval();
  setupRuntimeListeners();

  // Set up alarms and mark them as enabled
  AlarmManager.setupInitialAlarm();
  AlarmManager.setupWatchdogAlarm();
  AlarmManager.initializeAlarmListeners();

  // Explicitly set alarmsEnabled flag
  chrome.storage.local.set({ alarmsEnabled: true });
  PersistentLogger.log("Extension initialized with alarms enabled");
}

// Global flag to prevent multiple initializations
let extensionInitialized = false;

/**
 * Safe initialization wrapper to prevent duplicate initialization
 */
async function safeInitializeExtension() {
  if (extensionInitialized) {
    PersistentLogger.log("Extension already initialized, skipping duplicate initialization");
    return;
  }
  
  extensionInitialized = true;
  PersistentLogger.log("Starting extension initialization...");
  await initializeExtension();
}

// Initialize the extension only once
safeInitializeExtension();
/**
 * Professional Profile Analytics - Shiny App Integration
 *
 * This script handles the integration with Shiny web applications,
 * allowing them to trigger LinkedIn post creation with human-like typing.
 */

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

// Enable or disable verbose debugging for typing simulation
const TYPING_DEBUG_MODE = false;

// Debug logging function for typing simulation
function debugLog(message, data = null) {
  if (!TYPING_DEBUG_MODE) return;

  const timestamp = new Date().toISOString();
  PersistentLogger.log(`[PPA-DEBUG ${timestamp}] ${message}`);
  if (data) {
    PersistentLogger.log('[PPA-DEBUG DATA]', data);
  }
}

// ============================================================================
// SHINY APP INTEGRATION
// ============================================================================

// Listen for messages from external web pages (Shiny app)
chrome.runtime.onMessageExternal.addListener(
  function(request, sender, sendResponse) {
    debugLog("Message received from external source:", request);
    debugLog("Sender:", sender);

    if (request.action === "openTabAndType") {
      debugLog("Processing openTabAndType action");

      // Open a new tab with the specified URL
      chrome.tabs.create({ url: request.url || "https://www.linkedin.com/feed/" }, function(tab) {
        debugLog("Created new tab:", tab);

        // We need to wait for the tab to fully load before injecting our content script
        chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
          debugLog(`Tab ${tabId} update:`, changeInfo);

          if (tabId === tab.id && changeInfo.status === 'complete') {
            // Remove the listener to avoid multiple executions
            chrome.tabs.onUpdated.removeListener(listener);
            debugLog("Tab fully loaded, proceeding with script injection");

            // First inject the LinkedIn post helper script with human-like typing
            chrome.scripting.executeScript({
              target: { tabId: tab.id },
              files: ['linkedin-post-helper-typing.js']
            }, (injectionResults) => {
              debugLog("Helper script injection results:", injectionResults);

              // Then execute the script to create a post
              chrome.scripting.executeScript({
                target: { tabId: tab.id },
                function: createLinkedInPost,
                args: [request.text, request.delay || 100, request.autoSubmit || false]
              }, (results) => {
                debugLog("Post creation script execution results:", results);

                // Send response back to the web page
                if (results && results[0] && results[0].result && results[0].result.success) {
                  debugLog("Sending success response to Shiny app");
                  sendResponse({
                    success: true,
                    message: "LinkedIn post created successfully"
                  });
                } else {
                  const errorMessage = results && results[0] && results[0].result ?
                    results[0].result.message :
                    "Failed to create LinkedIn post";

                  debugLog("Sending error response to Shiny app:", errorMessage);
                  sendResponse({
                    success: false,
                    message: errorMessage
                  });
                }
              });
            });
          }
        });
      });

      // Return true to indicate we will send a response asynchronously
      return true;
    }
  }
);

// Function to be injected into the tab to create a LinkedIn post
function createLinkedInPost(text, delay, autoSubmit) {
  try {
    // Check if the helper is available
    if (!window.linkedInPostHelper) {
      PersistentLogger.error("LinkedIn post helper not found");
      return { success: false, message: "LinkedIn post helper not found" };
    }

    // Use the debug logging function
    window.linkedInPostHelper.debugLog("Starting LinkedIn post creation");
    window.linkedInPostHelper.debugLog("Current URL:", window.location.href);

    // Use the LinkedIn post helper functions
    return window.linkedInPostHelper.clickStartPostButton()
      .then(editor => {
        window.linkedInPostHelper.debugLog("Editor found, proceeding to type text");
        return window.linkedInPostHelper.typeIntoEditor(editor, text, delay);
      })
      .then(() => {
        window.linkedInPostHelper.debugLog("Text typed successfully");

        // If autoSubmit is true, find and click the Post button
        if (autoSubmit) {
          window.linkedInPostHelper.debugLog("Looking for Post button to auto-submit");

          // Find the Post button (multi-language support)
          const postButtonSelectors = [
            'button[aria-label="Post"]',
            'button[aria-label="Posten"]',  // German
            'button[aria-label="Publicar"]', // Spanish
            'button[aria-label="Publier"]'   // French
          ];

          let postButton = null;
          for (const selector of postButtonSelectors) {
            const buttons = document.querySelectorAll(selector);
            for (const btn of buttons) {
              if (btn.textContent.trim().match(/post|posten|publicar|publier/i)) {
                postButton = btn;
                break;
              }
            }
            if (postButton) break;
          }

          // If button not found by aria-label, try by text content
          if (!postButton) {
            const allButtons = document.querySelectorAll('button');
            for (const btn of allButtons) {
              const text = btn.textContent.trim().toLowerCase();
              if (text === 'post' || text === 'posten' || text === 'publicar' || text === 'publier') {
                postButton = btn;
                break;
              }
            }
          }

          if (postButton) {
            window.linkedInPostHelper.debugLog("Post button found, clicking it");
            postButton.click();
            return { success: true, message: "Post created and submitted successfully" };
          } else {
            window.linkedInPostHelper.debugLog("Post button not found, post was typed but not submitted");
            return { success: true, message: "Post created successfully but not submitted (Post button not found)" };
          }
        }

        return { success: true, message: "Post created successfully" };
      })
      .catch(error => {
        window.linkedInPostHelper.debugLog("Error creating LinkedIn post:", error.message);
        return { success: false, message: error.message };
      });
  } catch (error) {
    PersistentLogger.error("Error in createLinkedInPost:", error);
    return { success: false, message: error.message };
  }
}

// Advanced Post Analytics functionality
const AdvancedPostAnalytics = {
  /**
   * Process advanced post statistics
   * @param {number} tabId - Tab ID for LinkedIn
   * @param {string} email - User email
   * @param {string[]} postUrls - Array of post URLs to process
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Processing results
   */
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
    PersistentLogger.log(`🚀 Starting individual post analytics processing: ${postsToProcess} posts (${totalAvailable} available, limit: ${postsLimit})`);

    const results = {
      processed: 0,
      successful: 0,
      failed: 0,
      uploads: [],
      errors: [],
      totalAvailable: totalAvailable,
      postsLimit: postsLimit
    };

    try {
      // Process each post URL (limited by user setting)
      for (let i = 0; i < limitedPostUrls.length; i++) {
        const postUrl = limitedPostUrls[i];
        
        // Enhanced logging for each URL processing
        logger.log(`Processing post ${i + 1}/${limitedPostUrls.length}: ${postUrl}`);
        PersistentLogger.log(`🔄 Processing individual post analytics ${i + 1}/${limitedPostUrls.length}: ${postUrl}`);

        try {
          // Transform URL to analytics format
          const analyticsUrl = this.transformToAnalyticsUrl(postUrl);
          PersistentLogger.log(`📊 Transformed to analytics URL: ${analyticsUrl}`);

          // Navigate to the post analytics page
          await this.navigateToPostAnalytics(tabId, analyticsUrl, logger);

          // Wait for page to load
          await this.waitForAnalyticsPageLoad(tabId, logger);

          // Export the post analytics
          const downloadInfo = await this.exportPostAnalytics(tabId, analyticsUrl, logger);

          if (downloadInfo) {
            // Upload immediately after download
            const uploadResult = await this.uploadSinglePostAnalytics(
              email,
              postUrl,
              analyticsUrl,
              downloadInfo,
              logger
            );

            if (uploadResult.success) {
              results.uploads.push({
                postUrl: postUrl,
                analyticsUrl: analyticsUrl,
                downloadInfo: downloadInfo,
                uploadResult: uploadResult
              });
              results.successful++;
              logger.log(`✅ Post ${i + 1}/${limitedPostUrls.length} uploaded successfully`);
              PersistentLogger.log(`✅ Successfully processed post ${i + 1}/${limitedPostUrls.length}: ${postUrl}`);
            } else {
              logger.error(`❌ Upload failed for post ${postUrl}: ${uploadResult.error}`);
              PersistentLogger.log(`❌ Upload failed for post ${i + 1}/${limitedPostUrls.length}: ${postUrl} - ${uploadResult.error}`);
              results.errors.push({
                postUrl: postUrl,
                error: `Upload failed: ${uploadResult.error}`
              });
              results.failed++;
            }
          } else {
            logger.error(`❌ Download failed for post: ${postUrl}`);
            PersistentLogger.log(`❌ Download failed for post ${i + 1}/${limitedPostUrls.length}: ${postUrl}`);
            results.errors.push({
              postUrl: postUrl,
              error: 'Download failed - no file detected'
            });
            results.failed++;
          }

          results.processed++;

          // Add significant delay between posts to avoid Chrome download blocking
          if (i < limitedPostUrls.length - 1) {
            const delayTime = 8000 + Math.random() * 7000; // 8-15 second delay
            logger.log(`Waiting ${Math.round(delayTime/1000)} seconds before next post to avoid download blocking...`);
            PersistentLogger.log(`⏳ Waiting ${Math.round(delayTime/1000)} seconds before processing next post (${i + 2}/${limitedPostUrls.length})`);
            await this.delay(delayTime);
          }

        } catch (error) {
          logger.error(`❌ Failed to process post ${postUrl}: ${error.message}`);
          PersistentLogger.log(`❌ Failed to process post ${i + 1}/${limitedPostUrls.length}: ${postUrl} - ${error.message}`);
          
          // Check if this is a critical validation error
          if (error.message.includes('STRICT VALIDATION FAILED') || 
              error.message.includes('CRITICAL ERROR') ||
              error.message.includes('Export button clicked but no download detected')) {
            logger.error(`🚨 CRITICAL ERROR detected for post ${postUrl}`);
            logger.error('This indicates LinkedIn export is not working properly');
            
            results.errors.push({
              postUrl: postUrl,
              error: `CRITICAL: ${error.message}`,
              isCritical: true
            });
          } else {
            results.errors.push({
              postUrl: postUrl,
              error: error.message,
              isCritical: false
            });
          }
          
          results.failed++;
          results.processed++;
          
          // Still add delay even on error to avoid rapid requests
          if (i < limitedPostUrls.length - 1) {
            const delayTime = 5000 + Math.random() * 3000; // 5-8 second delay on error
            logger.log(`Error occurred, waiting ${Math.round(delayTime/1000)} seconds before next post...`);
            await this.delay(delayTime);
          }
        }
      }

      logger.log(`Advanced post statistics processing completed. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`);
      PersistentLogger.log(`🏁 Individual post analytics processing completed: ${results.successful}/${results.processed} successful (${results.failed} failed)`);
      
      if (results.successful > 0) {
        PersistentLogger.log(`✅ Successfully uploaded ${results.successful} individual post analytics files`);
      }
      if (results.failed > 0) {
        PersistentLogger.log(`⚠️ Failed to process ${results.failed} posts - check individual error messages above`);
      }
      
      return results;

    } catch (error) {
      logger.error(`Advanced post statistics processing failed: ${error.message}`);
      throw error;
    }
  },

  /**
   * Transform LinkedIn post URL to analytics URL format
   * @param {string} postUrl - Original LinkedIn post URL
   * @returns {string} Analytics URL format
   */
  transformToAnalyticsUrl(postUrl) {
    try {
      // Extract the activity URN from various LinkedIn post URL formats
      let activityUrn = null;

      // Format 1: https://www.linkedin.com/posts/username_activity-7341072233987026944-abcd
      const postsMatch = postUrl.match(/\/posts\/[^_]+_activity-(\d+)-/);
      if (postsMatch) {
        activityUrn = postsMatch[1];
      }

      // Format 2: https://www.linkedin.com/feed/update/urn:li:activity:7341072233987026944/
      const feedMatch = postUrl.match(/\/feed\/update\/urn:li:activity:(\d+)/);
      if (feedMatch) {
        activityUrn = feedMatch[1];
      }

      // Format 3: Direct activity ID in URL
      const activityMatch = postUrl.match(/activity[:-](\d{19})/);
      if (activityMatch) {
        activityUrn = activityMatch[1];
      }

      if (!activityUrn) {
        throw new Error(`Could not extract activity URN from URL: ${postUrl}`);
      }

      // Transform to analytics URL format
      const analyticsUrl = `https://www.linkedin.com/analytics/post-summary/urn:li:activity:${activityUrn}/`;

      return analyticsUrl;

    } catch (error) {
      throw new Error(`Error transforming URL ${postUrl}: ${error.message}`);
    }
  },

  /**
   * Navigate to post analytics page
   * @param {number} tabId - Tab ID
   * @param {string} analyticsUrl - Analytics URL to navigate to
   * @param {Object} logger - Logger instance
   */
  async navigateToPostAnalytics(tabId, analyticsUrl, logger) {
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
  },

  /**
   * Wait for analytics page to load completely
   * @param {number} tabId - Tab ID
   * @param {Object} logger - Logger instance
   */
  async waitForAnalyticsPageLoad(tabId, logger) {
    const maxWait = 15000; // 15 seconds
    const startTime = Date.now();
    let attempts = 0; // Track number of attempts

    return new Promise((resolve, reject) => {
      const checkInterval = setInterval(() => {
        attempts++; // Increment attempts counter
        
        if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          reject(new Error('Analytics page load timeout'));
          return;
        }

        chrome.scripting.executeScript({
          target: { tabId },
          func: () => {
            // Check if the analytics page has loaded with more flexible selectors
            const exportButtons = [
              document.querySelector('button[data-test-id="export-button"]'),
              document.querySelector('button[aria-label*="Export"]'),
              document.querySelector('button[aria-label*="export"]'),
              ...Array.from(document.querySelectorAll('button')).filter(btn => 
                btn.textContent && btn.textContent.toLowerCase().includes('export')
              ),
              ...Array.from(document.querySelectorAll('button')).filter(btn => 
                btn.textContent && btn.textContent.toLowerCase().includes('download')
              )
            ].filter(Boolean);

            const loadingIndicators = [
              document.querySelector('[data-test-id="loading"]'),
              document.querySelector('.loading'),
              document.querySelector('.spinner'),
              document.querySelector('[role="progressbar"]'),
              document.querySelector('.loading-spinner')
            ].filter(Boolean);

            // Check for analytics content indicators
            const analyticsContent = [
              document.querySelector('[data-test-id="analytics"]'),
              document.querySelector('.analytics'),
              document.querySelector('[data-test-id="post-analytics"]'),
              document.querySelector('.post-analytics'),
              document.querySelector('[data-test-id="insights"]'),
              document.querySelector('.insights')
            ].filter(Boolean);

            return {
              hasExportButton: exportButtons.length > 0,
              exportButtonCount: exportButtons.length,
              exportButtonTexts: exportButtons.map(btn => btn.textContent?.trim() || btn.getAttribute('aria-label') || 'No text'),
              isLoading: loadingIndicators.length > 0,
              hasAnalyticsContent: analyticsContent.length > 0,
              readyState: document.readyState,
              url: window.location.href,
              title: document.title
            };
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            clearInterval(checkInterval);
            reject(new Error(`Script execution failed: ${chrome.runtime.lastError.message}`));
            return;
          }

          if (results && results[0] && results[0].result) {
            const { 
              hasExportButton, 
              exportButtonCount, 
              exportButtonTexts, 
              isLoading, 
              hasAnalyticsContent, 
              readyState, 
              url, 
              title 
            } = results[0].result;

            // More flexible loading criteria
            const pageReady = readyState === 'complete' && !isLoading;
            const hasContent = hasExportButton || hasAnalyticsContent;

            // Only log every few attempts to reduce verbosity
            if (attempts % 3 === 0 || pageReady) {
              logger.log(`Page loading... (${readyState}, ${exportButtonCount} export buttons)`);
            }

            if (pageReady && hasContent) {
              clearInterval(checkInterval);
              logger.log('Analytics page loaded successfully');
              resolve();
            } else if (pageReady && !hasContent) {
              // Page is loaded but might not have export functionality
              // Let's try to proceed anyway after a short wait
              setTimeout(() => {
                clearInterval(checkInterval);
                logger.warn('Analytics page loaded but no export button found, proceeding anyway');
                resolve();
              }, 2000);
            }
          }
        });
      }, 1000);
    });
  },

  /**
   * Export post analytics data with URL tracking (same as main download)
   * @param {number} tabId - Tab ID
   * @param {string} analyticsUrl - Analytics URL for post_id extraction
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Download information with URL
   */
  async exportPostAnalytics(tabId, analyticsUrl, logger) {
    return new Promise((resolve, reject) => {
      // Track downloads before clicking export (same as main download)
      const downloadsBeforeExport = [];

      chrome.downloads.search({ limit: 10 }, (items) => {
        items.forEach(item => downloadsBeforeExport.push(item.id));

        // Set up download URL tracking (same as WebRequestTracker)
        const downloadTracker = this.trackPostAnalyticsDownload(tabId, logger);

        // Try multiple approaches to click the export button
        this.tryClickExportButton(tabId, logger)
          .then(() => {
            logger.log('Export button clicked successfully');
            
            // Wait for download URL to be captured (same as main download)
            downloadTracker
              .then((downloadUrl) => {
                resolve({ url: downloadUrl, source: 'url_tracking' });
              })
              .catch((error) => {
                logger.error(`Download URL tracking failed: ${error.message}`);
                reject(error);
              });
          })
          .catch(error => {
            reject(new Error(`Export button click failed: ${error.message}`));
          });
      });
    });
  },

  /**
   * Track post analytics download URL (similar to WebRequestTracker)
   * @param {number} tabId - Tab ID
   * @param {Object} logger - Logger instance
   * @returns {Promise<string>} Download URL
   */
  async trackPostAnalyticsDownload(tabId, logger) {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Download URL tracking timeout'));
      }, 15000); // 15 second timeout

      // Listen for web requests to capture download URL
      const requestListener = (details) => {
        if (details.tabId === tabId && 
            details.url.includes('linkedin.com') && 
            (details.url.includes('download') || 
             details.url.includes('export') ||
             details.url.includes('.xlsx') ||
             details.responseHeaders?.some(header => 
               header.name.toLowerCase() === 'content-disposition' && 
               header.value.includes('attachment')
             ))) {
          
          logger.log(`📥 Download URL captured`);
          
          // Clean up
          clearTimeout(timeout);
          chrome.webRequest.onBeforeRequest.removeListener(requestListener);
          chrome.webRequest.onHeadersReceived.removeListener(headerListener);
          
          resolve(details.url);
        }
      };

      const headerListener = (details) => {
        if (details.tabId === tabId && 
            details.responseHeaders?.some(header => 
              header.name.toLowerCase() === 'content-disposition' && 
              header.value.includes('attachment')
            )) {
          
          logger.log(`📥 Download URL captured`);
          
          // Clean up
          clearTimeout(timeout);
          chrome.webRequest.onBeforeRequest.removeListener(requestListener);
          chrome.webRequest.onHeadersReceived.removeListener(headerListener);
          
          resolve(details.url);
        }
      };

      // Add listeners
      chrome.webRequest.onBeforeRequest.addListener(
        requestListener,
        { urls: ["*://www.linkedin.com/*"] },
        ["requestBody"]
      );

      chrome.webRequest.onHeadersReceived.addListener(
        headerListener,
        { urls: ["*://www.linkedin.com/*"] },
        ["responseHeaders"]
      );
    });
  },

  /**
   * Try multiple approaches to click the export button
   * @param {number} tabId - Tab ID
   * @param {Object} logger - Logger instance
   * @returns {Promise<void>}
   */
  async tryClickExportButton(tabId, logger) {
    // First try the standard MultilingualTabInteractions approach
    try {
      await MultilingualTabInteractions.clickButton(tabId, 'export');
      logger.log('Export button clicked using MultilingualTabInteractions');
      return;
    } catch (error) {
      logger.warn(`MultilingualTabInteractions export click failed: ${error.message}`);
    }

    // Try direct button clicking with flexible selectors
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          // Try multiple selectors for export buttons
          const exportSelectors = [
            'button[data-test-id="export-button"]',
            'button[aria-label*="Export"]',
            'button[aria-label*="export"]',
            'button[data-test-id*="export"]',
            'button[data-test-id*="download"]',
            '[role="button"][aria-label*="Export"]',
            '[role="button"][aria-label*="export"]'
          ];

          let exportButton = null;

          // Try each selector
          for (const selector of exportSelectors) {
            exportButton = document.querySelector(selector);
            if (exportButton) {
              PersistentLogger.log(`Found export button with selector: ${selector}`);
              break;
            }
          }

          // If no button found with specific selectors, try text-based search
          if (!exportButton) {
            const allButtons = Array.from(document.querySelectorAll('button'));
            exportButton = allButtons.find(btn => {
              const text = btn.textContent?.toLowerCase() || '';
              const ariaLabel = btn.getAttribute('aria-label')?.toLowerCase() || '';
              return text.includes('export') || text.includes('download') || 
                     ariaLabel.includes('export') || ariaLabel.includes('download');
            });

            if (exportButton) {
              PersistentLogger.log(`Found export button by text search: ${exportButton.textContent || exportButton.getAttribute('aria-label')}`);
            }
          }

          if (exportButton) {
            exportButton.click();
            return { success: true, buttonText: exportButton.textContent || exportButton.getAttribute('aria-label') };
          } else {
            // Log available buttons for debugging
            const allButtons = Array.from(document.querySelectorAll('button'));
            const buttonInfo = allButtons.map(btn => ({
              text: btn.textContent?.trim(),
              ariaLabel: btn.getAttribute('aria-label'),
              dataTestId: btn.getAttribute('data-test-id'),
              className: btn.className
            }));
            
            return { 
              success: false, 
              error: 'No export button found',
              availableButtons: buttonInfo.slice(0, 10) // Limit to first 10 for debugging
            };
          }
        }
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new Error(`Script execution failed: ${chrome.runtime.lastError.message}`));
          return;
        }

        if (results && results[0] && results[0].result) {
          const result = results[0].result;
          
          if (result.success) {
            logger.log(`Export button clicked successfully: ${result.buttonText}`);
            resolve();
          } else {
            logger.error(`Export button not found: ${result.error}`);
            logger.log('Available buttons:', result.availableButtons);
            reject(new Error(result.error));
          }
        } else {
          reject(new Error('No result from export button click script'));
        }
      });
    });
  },

  /**
   * Perform extended download detection - track ANY PostAnalytics file
   * @param {Array} downloadsBeforeExport - Downloads before export
   * @param {string} analyticsUrl - Analytics URL for post_id extraction
   * @param {Object} logger - Logger instance
   * @param {Function} resolve - Promise resolve function
   * @param {Function} reject - Promise reject function
   */
  async performExtendedDownloadDetection(downloadsBeforeExport, analyticsUrl, logger, resolve, reject) {
    const currentPostIdMatch = analyticsUrl.match(/urn:li:activity:(\d+)/);
    const urlPostId = currentPostIdMatch ? currentPostIdMatch[1] : null;
    
    logger.log(`🔍 Extended detection for URL post_id: ${urlPostId}`);
    logger.log('Searching more aggressively for PostAnalytics files...');
    
    // First extended attempt - shorter wait
    setTimeout(() => {
      chrome.downloads.search({ limit: 25 }, (items) => {
        // Look for PostAnalytics files that are new
        let postAnalyticsFiles = items.filter(item => {
          const isNewDownload = !downloadsBeforeExport.includes(item.id);
          const isXlsx = item.filename.endsWith('.xlsx');
          const isPostAnalytics = item.filename.toLowerCase().includes('postanalytics');
          
          logger.log(`Extended search: ${item.filename} - New: ${isNewDownload}, XLSX: ${isXlsx}, PostAnalytics: ${isPostAnalytics}`);
          
          return isNewDownload && isXlsx && isPostAnalytics;
        });

        if (postAnalyticsFiles.length > 0) {
          const downloadInfo = postAnalyticsFiles[0];
          const filenamePostId = downloadInfo.filename.match(/(\d{19})/);
          
          logger.log(`✅ PostAnalytics file found in extended search: ${downloadInfo.filename}`);
          logger.log(`📊 URL post_id: ${urlPostId} | File post_id: ${filenamePostId ? filenamePostId[1] : 'unknown'}`);
          logger.log(`🎯 API will receive URL post_id (${urlPostId})`);
          
          resolve(downloadInfo);
        } else {
          logger.log('Still searching... checking for very recent PostAnalytics files');
          
          // Second attempt - look for ANY PostAnalytics file from recent time
          setTimeout(() => {
            chrome.downloads.search({ limit: 30 }, (finalItems) => {
              // Get current time and look for files downloaded in last 2 minutes
              const twoMinutesAgo = Date.now() - (2 * 60 * 1000);
              
              let recentPostAnalyticsFiles = finalItems.filter(item => {
                const isXlsx = item.filename.endsWith('.xlsx');
                const isPostAnalytics = item.filename.toLowerCase().includes('postanalytics');
                const isRecent = new Date(item.startTime).getTime() > twoMinutesAgo;
                const isNotInOriginalList = !downloadsBeforeExport.includes(item.id);
                
                logger.log(`Recent search: ${item.filename} - XLSX: ${isXlsx}, PostAnalytics: ${isPostAnalytics}, Recent: ${isRecent}, NotInOriginal: ${isNotInOriginalList}`);
                
                return isXlsx && isPostAnalytics && (isNotInOriginalList || isRecent);
              });

              if (recentPostAnalyticsFiles.length > 0) {
                // Sort by start time, get the most recent
                recentPostAnalyticsFiles.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
                const downloadInfo = recentPostAnalyticsFiles[0];
                const filenamePostId = downloadInfo.filename.match(/(\d{19})/);
                
                logger.log(`✅ Recent PostAnalytics file found: ${downloadInfo.filename}`);
                logger.log(`📊 URL post_id: ${urlPostId} | File post_id: ${filenamePostId ? filenamePostId[1] : 'unknown'}`);
                logger.log(`🎯 API will receive URL post_id (${urlPostId})`);
                logger.log(`⏰ File download time: ${downloadInfo.startTime}`);
                
                resolve(downloadInfo);
              } else {
                logger.error(`❌ No PostAnalytics file found after extensive search for URL post_id: ${urlPostId}`);
                logger.log('All recent downloads:');
                finalItems.slice(0, 10).forEach(item => {
                  logger.log(`  - ${item.filename} (${item.startTime})`);
                });
                
                reject(new Error(`No PostAnalytics file detected after extensive search for URL post_id: ${urlPostId}`));
              }
            });
          }, 3000); // 3 second wait for second attempt
        }
      });
    }, 2000); // 2 second wait for first extended attempt
  },

  /**
   * Upload single post analytics to API immediately after download
   * @param {string} email - User email
   * @param {string} originalUrl - Original post URL
   * @param {string} analyticsUrl - Analytics URL
   * @param {Object} downloadInfo - Download information
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Upload result
   */
  async uploadSinglePostAnalytics(email, originalUrl, analyticsUrl, downloadInfo, logger) {
    const API_ENDPOINT = 'https://mlew54d2u3dfar47trgs2rjjgi0vfopc.lambda-url.us-east-1.on.aws/';

    try {
      logger.log(`Uploading post analytics for: ${analyticsUrl}`);

      // Get the file from the download URL
      let fileBase64 = null;
      let filename = 'PostAnalytics_Individual.xlsx'; // Default filename
      
      try {
        if (downloadInfo.url) {
          logger.log(`Fetching post analytics file from URL: ${downloadInfo.url}`);
          const response = await fetch(downloadInfo.url);
          if (response.ok) {
            const fileBlob = await response.blob();
            // Convert blob to base64
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            fileBase64 = btoa(String.fromCharCode.apply(null, uint8Array));
            logger.log(`File converted to base64 (${fileBase64.length} chars)`);
            
            // Extract filename from URL parameters
            try {
              const urlParams = new URLSearchParams(new URL(downloadInfo.url).search);
              const urlFilename = urlParams.get('x-ambry-um-filename');
              if (urlFilename) {
                filename = urlFilename;
                logger.log(`Extracted filename from URL: ${filename}`);
              }
            } catch (urlError) {
              logger.warn(`Could not extract filename from URL: ${urlError.message}`);
            }
          } else {
            throw new Error(`Could not fetch file from URL: ${response.status}`);
          }
        } else if (downloadInfo.filename) {
          // Fallback to filename-based approach (shouldn't happen with new URL tracking)
          logger.warn('Using fallback filename-based approach');
          const response = await fetch(downloadInfo.filename);
          if (response.ok) {
            const fileBlob = await response.blob();
            const arrayBuffer = await fileBlob.arrayBuffer();
            const uint8Array = new Uint8Array(arrayBuffer);
            fileBase64 = btoa(String.fromCharCode.apply(null, uint8Array));
            filename = downloadInfo.filename.split('\\').pop().split('/').pop();
          } else {
            throw new Error(`Could not fetch file from path: ${response.status}`);
          }
        } else {
          throw new Error('Neither download URL nor filename available');
        }
      } catch (fileError) {
        logger.error(`Failed to get post analytics file: ${fileError.message}`);
        return { success: false, error: fileError.message };
      }

      // Extract post_id from analytics URL (this is the correct post_id for API)
      const postIdMatch = analyticsUrl.match(/urn:li:activity:(\d+)/);
      const urlPostId = postIdMatch ? postIdMatch[1] : 'unknown';
      
      // Extract just the filename from the full path if needed
      filename = filename.split('\\').pop().split('/').pop();
      
      // Extract post_id from filename for logging comparison
      const filenamePostIdMatch = filename.match(/(\d{19})/);
      const filenamePostId = filenamePostIdMatch ? filenamePostIdMatch[1] : 'unknown';
      
      // Validate that we have a PostAnalytics file
      const isPostAnalyticsFile = filename.toLowerCase().includes('postanalytics');
      
      if (!isPostAnalyticsFile) {
        const errorMsg = `CRITICAL ERROR: File is not a PostAnalytics file: ${filename}`;
        logger.error(errorMsg);
        return { success: false, error: errorMsg };
      }
      
      logger.log(`✅ Uploading: ${filename} (post_id: ${urlPostId})`);
      
      // Prepare FormData for Lambda (use URL post_id, not filename post_id)
      const formData = new FormData();
      formData.append('Email', email);
      formData.append('post_id', urlPostId); // Use URL post_id, not filename post_id
      formData.append('filename', filename);
      formData.append('analytics_url', analyticsUrl);
      formData.append('file_validation', JSON.stringify({
        is_postanalytics_file: isPostAnalyticsFile,
        url_post_id: urlPostId,
        filename_post_id: filenamePostId,
        post_ids_match: urlPostId === filenamePostId
      }));
      
      // Convert base64 back to blob for FormData
      const binaryString = atob(fileBase64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const fileBlob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      formData.append('xlsx', fileBlob, filename); // Use filename here too
      
      // Upload to API with FormData (same as main upload)
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      logger.log(`Post analytics uploaded successfully`);

      return { success: true, result: result };

    } catch (error) {
      logger.error(`Failed to upload single post analytics: ${error.message}`);
      return { success: false, error: error.message };
    }
  },

  /**
   * Utility function to add delay
   * @param {number} ms - Milliseconds to delay
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
};

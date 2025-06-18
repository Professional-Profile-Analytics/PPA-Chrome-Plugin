/**
 * Professional Profile Analytics - Background Service Worker
 *
 * This script handles the automated download and upload of LinkedIn analytics data
 * to the Professional Profile Analytics service.
 * 
 * It also provides an interface for the Shiny web app to trigger the extension
 * to open tabs and simulate human typing.
 */

// Force reset retry count on startup
chrome.storage.local.get(['retryCount'], (data) => {
  if (data.retryCount) {
    console.log(`Found existing retry count on startup: ${data.retryCount}. Resetting to 0.`);
    chrome.storage.local.set({ retryCount: 0 });
    chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
    console.log('Retry count reset to 0 and retry flags cleared on startup.');
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

        // Log the detected language information
        Logger.log(`Language detected: ${detectedLang} (Source: ${langInfo.source}, Original value: ${langInfo.value})`, 'info');

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
      await fileUploader.uploadToWebhook(apiURL, email);

      // Update successful execution status
      await configManager.updateExecutionStatus('✅Success');
      // Reset retry count on success
      await configManager.resetRetryCount();

    } catch (error) {
      // Log and update failed execution status
      logger.error(`LinkedIn automation failed: ${error.message}`);
      await configManager.updateExecutionStatus('Failed', error);
      throw error;
    } finally {
      // Always close the tab safely
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
    try {
      // Wait for initial page load
      await MultilingualTabInteractions.waitForPageLoad(tabId);

      // Attempt to download file with multiple button click strategies
      await this.clickExportButton(tabId, email, webRequestTracker, fileUploader, logger);

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
          await this.processAdvancedPostStatistics(tabId, email, logger);
        } catch (error) {
          logger.error(`Advanced post statistics failed: ${error.message}`);
          // Continue with main automation
        }
      } else {
        logger.log('Advanced post statistics disabled, skipping individual post processing');
      }

      // Update successful execution status
      await configManager.updateExecutionStatus('✅Success');
      // Reset retry count on success
      await configManager.resetRetryCount();

    } catch (error) {
      // Log and update failed execution status
      logger.error(`LinkedIn direct automation failed: ${error.message}`);
      await configManager.updateExecutionStatus('Failed', error);
      throw error;
    } finally {
      // Always close the tab safely
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
   * @returns {Promise<void>}
   */
  async processAdvancedPostStatistics(tabId, email, logger) {
    try {
      logger.log('Starting advanced post statistics processing...');
      
      // Get the most recent download (should be the main analytics file)
      const recentDownloads = await new Promise((resolve) => {
        chrome.downloads.search({ 
          limit: 5,
          orderBy: ['-startTime']
        }, resolve);
      });
      
      const mainAnalyticsFile = recentDownloads.find(download => 
        download.filename.toLowerCase().includes('analytics') && 
        download.filename.endsWith('.xlsx') &&
        download.state === 'complete'
      );
      
      if (!mainAnalyticsFile) {
        logger.warn('Main analytics file not found in recent downloads, skipping advanced statistics');
        return;
      }
      
      logger.log(`Found main analytics file: ${mainAnalyticsFile.filename}`);
      
      // Read the Excel file and extract post URLs
      const postUrls = await this.extractPostUrlsFromDownload(mainAnalyticsFile, logger);
      
      if (postUrls.length === 0) {
        logger.log('No post URLs found in analytics file, skipping advanced statistics');
        return;
      }
      
      logger.log(`Found ${postUrls.length} post URLs for advanced processing`);
      
      // Process each post's analytics
      const results = await AdvancedPostAnalytics.processAdvancedStatistics(
        tabId, 
        email, 
        postUrls, 
        logger
      );
      
      // Upload advanced statistics if any were successfully processed
      if (results.successful > 0) {
        await AdvancedPostAnalytics.uploadAdvancedStatistics(
          email, 
          results.downloads, 
          logger
        );
      } else {
        logger.log('No posts were successfully processed, skipping upload');
      }
      
      logger.log(`Advanced post statistics processing completed. Processed: ${results.processed}, Successful: ${results.successful}, Failed: ${results.failed}`);
      
    } catch (error) {
      logger.error(`Advanced post statistics processing failed: ${error.message}`);
      // Don't throw the error - we don't want to fail the main automation
      // if advanced statistics fail
      logger.log('Continuing with main automation despite advanced statistics failure');
    }
  },

  /**
   * Extract post URLs from downloaded Excel file
   * @param {Object} downloadInfo - Download information from Chrome downloads API
   * @param {Object} logger - Logger instance
   * @returns {Promise<string[]>} Array of post URLs
   */
  async extractPostUrlsFromDownload(downloadInfo, logger) {
    try {
      logger.log(`Attempting to extract post URLs from: ${downloadInfo.filename}`);
      
      // For Chrome extensions, we have limited access to downloaded files
      // We'll use a simplified approach for now
      
      // Option 1: Try to read the file if it's still accessible via URL
      if (downloadInfo.url && downloadInfo.url.startsWith('blob:')) {
        try {
          logger.log('Attempting to read Excel file via blob URL...');
          
          // Since XLSX library is not available in service worker context,
          // we'll use a simulated approach for now
          // In production, you might need to process the file server-side
          
          logger.log('Excel file processing simulated - using fallback URLs');
          
        } catch (error) {
          logger.warn(`Failed to read file via blob URL: ${error.message}`);
        }
      }
      
      // Fallback: Use simulated URLs for demonstration
      // In a production environment, you would need to:
      // 1. Process the Excel file server-side after upload
      // 2. Return the extracted URLs via API
      // 3. Or use a different file processing approach
      
      logger.log('Using fallback method - simulated post URLs for testing');
      const simulatedUrls = [
        'https://www.linkedin.com/posts/username_activity-7341072233987026944-abcd',
        'https://www.linkedin.com/feed/update/urn:li:activity:7341072233987026945/',
        'https://www.linkedin.com/posts/username_activity-7341072233987026946-efgh'
      ];
      
      logger.log(`Extracted ${simulatedUrls.length} simulated post URLs`);
      return simulatedUrls;
      
    } catch (error) {
      logger.error(`Failed to extract post URLs: ${error.message}`);
      return [];
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

      // If download is successful, upload the file
      await fileUploader.uploadToWebhook(apiURL, email);
      downloadTracked = true;
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
 * Logging utility for consistent logging and storage of log messages
 */
const Logger = {
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
        Logger.log(`Execution status updated: ${status}`);
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
        Logger.log(`Retry count updated: ${count}`);
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
        Logger.log('Retry count reset to 0');
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
      Logger.log(`Execution interval set to ${EXECUTION_INTERVAL / (24 * 60 * 60 * 1000)} days`);
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
      Logger.log(`Fetching file from URL: ${fileUrl}`);
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
      Logger.log('Uploading file to webhook...');
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

      Logger.log('File successfully uploaded');
      return await uploadResponse.json();

    } catch (error) {
      Logger.error(`File upload error: ${error.message}`);
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
  Logger.log(`Current retry count before scheduling: ${currentRetryCount}`);

  // Reset retry count if it's already at or above the maximum
  if (currentRetryCount >= CONFIG.RETRY.MAX_ATTEMPTS) {
    Logger.log(`Retry count ${currentRetryCount} is at or above maximum ${CONFIG.RETRY.MAX_ATTEMPTS}. Resetting to 0.`);
    await ConfigManager.resetRetryCount();
    // Clear retry flags
    chrome.storage.local.remove(['nextRetryTime', 'retryScheduled']);
    Logger.log('Retry count has been reset to 0 and retry flags cleared.');
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

  // Also create an alarm as a backup mechanism
  chrome.alarms.create(CONFIG.ALARMS.RETRY, { when: retryTime });

  // DIRECT APPROACH: Set a JavaScript timeout as a third backup mechanism
  setTimeout(() => {
    Logger.log(`=== DIRECT TIMEOUT RETRY TRIGGERED at ${new Date().toISOString()} ===`);
    Logger.log(`Direct timeout retry for attempt #${newRetryCount}`);

    // Get current retry state
    chrome.storage.local.get(['retryCount', 'retryScheduled'], (data) => {
        Logger.log(`Current retry count in timeout: ${data.retryCount}`);
        Logger.log(`Retry still scheduled: ${data.retryScheduled ? 'Yes' : 'No'}`);

        // Only run if retry is still scheduled (hasn't been handled by alarm or watchdog)
        if (data.retryScheduled) {
          Logger.log('Running automation from direct timeout');
          chrome.storage.local.set({ retryScheduled: false });
          runAutomationScript();
        } else {
          Logger.log('Retry already handled by alarm or watchdog, skipping direct timeout execution');
        }
      });
    }, CONFIG.RETRY.INTERVAL + 500); // Add 500ms buffer

    Logger.log(`Scheduled retry #${newRetryCount} in 2 minutes. Time: ${retryTimeISO}`);

    // Debug information about all alarms
    //chrome.alarms.getAll((alarms) => {
    //  Logger.log(`Current alarms: ${JSON.stringify(alarms.map(a => ({
    //    name: a.name,
    //    scheduledTime: new Date(a.scheduledTime).toISOString(),
    //    periodInMinutes: a.periodInMinutes
    //  })))}`);
    //});
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
    Logger.log(`=== AUTOMATION SCRIPT STARTED at ${timestamp} ===`);

    // Randomly choose between the existing and new solution
    const useDirect = Math.random() < 0.5; // 50% chance for each
    Logger.log(`Using direct approach: ${useDirect}`);

    if (useDirect) {
      // New solution: use executeStepsDirect with multi-language support
      chrome.tabs.create({
        url: CONFIG.LINKEDIN.ANALYTICS,
        active: false
      }, async (tab) => {
        if (!tab || !tab.id) {
          const error = new Error('Failed to create tab');
          Logger.error(`Tab creation failed: ${error.message}`);
          await scheduleRetry();
          return;
        }

        const tabId = tab.id;
        Logger.log(`Created tab with ID: ${tabId}`);

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
          Logger.log(`=== AUTOMATION COMPLETED SUCCESSFULLY at ${new Date().toISOString()} ===`);
          
          // Check if company page upload is needed
          await checkAndRunCompanyPageUpload();
        } catch (error) {
          Logger.error(`Direct automation script failed: ${error.message}`);
          await scheduleRetry();
          // Close the tab if it still exists
          try {
            Logger.log(`Attempting to close tab ${tabId}`);
            chrome.tabs.remove(tabId);
          } catch (e) {
            Logger.log(`Tab ${tabId} already closed or doesn't exist`);
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
          Logger.error(`Tab creation failed: ${error.message}`);
          await scheduleRetry();
          return;
        }

        const tabId = tab.id;
        Logger.log(`Created tab with ID: ${tabId}`);

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
          Logger.log(`=== AUTOMATION COMPLETED SUCCESSFULLY at ${new Date().toISOString()} ===`);
          
          // Check if company page upload is needed
          await checkAndRunCompanyPageUpload();
        } catch (error) {
          Logger.error(`Automation script failed: ${error.message}`);
          await scheduleRetry();
          // Close the tab if it still exists
          try {
            Logger.log(`Attempting to close tab ${tabId}`);
            chrome.tabs.remove(tabId);
          } catch (e) {
            Logger.log(`Tab ${tabId} already closed or doesn't exist`);
          }
        }
      });
    }
  } catch (error) {
    Logger.error(`Automation initialization failed: ${error.message}`);
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
      Logger.log('Company automation already running, skipping duplicate request');
      return;
    }
    
    Logger.log('Checking if company page upload is needed...');
    
    // Get company ID from storage
    const result = await new Promise((resolve) => {
      chrome.storage.local.get(['companyId', 'lastCompanyExecutionTime'], resolve);
    });
    
    if (!result.companyId) {
      Logger.log('No company ID configured, skipping company page upload');
      return;
    }
    
    const companyId = result.companyId;
    const lastCompanyExecution = result.lastCompanyExecutionTime;
    const now = Date.now();
    const sevenDaysAgo = now - (7 * 24 * 60 * 60 * 1000); // 7 days in milliseconds
    
    // Check if last execution was more than 7 days ago or never executed
    if (!lastCompanyExecution || lastCompanyExecution < sevenDaysAgo) {
      Logger.log(`Company page upload needed. Last execution: ${lastCompanyExecution ? new Date(lastCompanyExecution).toISOString() : 'Never'}`);
      await runCompanyPageAutomation(companyId);
    } else {
      Logger.log(`Company page upload not needed. Last execution: ${new Date(lastCompanyExecution).toISOString()}`);
      // Update next execution time
      const nextExecution = lastCompanyExecution + (7 * 24 * 60 * 60 * 1000);
      chrome.storage.local.set({ nextCompanyExecution: nextExecution });
    }
  } catch (error) {
    Logger.error(`Error checking company page upload: ${error.message}`);
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
    Logger.log(`Starting company page automation for company ${companyId}`);
    
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
        Logger.error(`Company tab creation failed: ${error.message}`);
        await updateCompanyExecutionStatus('Failed', error);
        companyAutomationRunning = false; // Reset flag
        return;
      }
      
      const tabId = tab.id;
      Logger.log(`Created company analytics tab with ID: ${tabId}`);
      
      try {
        await executeCompanyPageSteps(tabId, companyId, email);
        
        // Update success status
        await updateCompanyExecutionStatus('Success');
        
        // Schedule next execution (7 days from now)
        const nextExecution = now + (7 * 24 * 60 * 60 * 1000);
        chrome.storage.local.set({ nextCompanyExecution: nextExecution });
        
        Logger.log(`Company page automation completed successfully`);
      } catch (error) {
        Logger.error(`Company page automation failed: ${error.message}`);
        await updateCompanyExecutionStatus('Failed', error);
        
        // Close the tab if it still exists
        try {
          chrome.tabs.remove(tabId);
        } catch (e) {
          Logger.log(`Company tab ${tabId} already closed or doesn't exist`);
        }
      } finally {
        // Always reset the running flag
        companyAutomationRunning = false;
      }
    });
  } catch (error) {
    Logger.error(`Company page automation initialization failed: ${error.message}`);
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
        Logger.log(`Company analytics download started: ${downloadItem.filename.split('/').pop() || downloadItem.filename.split('\\').pop()}`);
        
        // Monitor download completion
        const checkDownload = () => {
          chrome.downloads.search({ id: downloadItem.id }, (results) => {
            if (results.length > 0) {
              const download = results[0];
              
              if (download.state === 'complete') {
                downloadCompleted = true;
                Logger.log(`Company analytics download completed successfully`);
                
                // Upload the file
                uploadCompanyFile(download.filename, companyId, email)
                  .then(() => {
                    // Clean up - safely remove tab
                    try {
                      chrome.tabs.remove(tabId, () => {
                        if (chrome.runtime.lastError) {
                          // Tab already closed or doesn't exist - this is fine
                          Logger.log(`Tab ${tabId} was already closed`);
                        }
                      });
                    } catch (e) {
                      // Ignore tab removal errors
                      Logger.log(`Tab ${tabId} cleanup skipped - already closed`);
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
        
        Logger.log('Company analytics page loaded, looking for first export button...');
        
        // Wait a bit for the page to fully render
        setTimeout(() => {
          // Inject script to find and click first export button
          chrome.scripting.executeScript({
            target: { tabId },
            function: findAndClickCompanyExportButton
          }, (results) => {
            if (results && results[0] && results[0].result) {
              Logger.log('First company export button clicked successfully');
              
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
      Logger.log('Looking for second export button in popup/modal...');
      
      chrome.scripting.executeScript({
        target: { tabId },
        function: findAndClickSecondExportButton
      }, (results) => {
        if (results && results[0] && results[0].result) {
          Logger.log('Second company export button clicked successfully');
          exportPopupHandled = true;
          secondExportClicked = true;
          
          // Wait longer for download to start after second click (5 seconds)
          setTimeout(() => {
            if (!downloadStarted) {
              Logger.log('Checking for recent company analytics downloads...');
              
              // Check for any recent downloads that might be the company file
              checkForRecentDownloads(companyId, email)
                .then(() => {
                  chrome.downloads.onCreated.removeListener(downloadListener);
                  // Safely remove tab
                  try {
                    chrome.tabs.remove(tabId, () => {
                      if (chrome.runtime.lastError) {
                        Logger.log(`Tab ${tabId} was already closed`);
                      }
                    });
                  } catch (e) {
                    Logger.log(`Tab ${tabId} cleanup skipped - already closed`);
                  }
                  resolve();
                })
                .catch(() => {
                  Logger.log('No recent downloads found, trying alternative export methods...');
                  // Try clicking again or look for alternative buttons
                  chrome.scripting.executeScript({
                    target: { tabId },
                    function: findAndClickAlternativeExportButton
                  }, (altResults) => {
                    if (altResults && altResults[0] && altResults[0].result) {
                      Logger.log('Alternative export button clicked');
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
          Logger.log('Second export button not found, trying alternative approaches...');
          
          // Try alternative approaches for the popup
          setTimeout(() => {
            chrome.scripting.executeScript({
              target: { tabId },
              function: findAndClickAlternativeExportButton
            }, (altResults) => {
              if (altResults && altResults[0] && altResults[0].result) {
                Logger.log('Alternative export button clicked successfully');
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
        Logger.log('Company automation timeout - checking for recent downloads...');
        
        if (secondExportClicked) {
          // If we clicked the second export button, check for recent downloads
          checkForRecentDownloads(companyId, email)
            .then(() => {
              chrome.downloads.onCreated.removeListener(downloadListener);
              // Safely remove tab
              try {
                chrome.tabs.remove(tabId, () => {
                  if (chrome.runtime.lastError) {
                    Logger.log(`Tab ${tabId} was already closed`);
                  }
                });
              } catch (e) {
                Logger.log(`Tab ${tabId} cleanup skipped - already closed`);
              }
              resolve();
            })
            .catch(() => {
              chrome.downloads.onCreated.removeListener(downloadListener);
              // Safely remove tab
              try {
                chrome.tabs.remove(tabId, () => {
                  if (chrome.runtime.lastError) {
                    Logger.log(`Tab ${tabId} was already closed`);
                  }
                });
              } catch (e) {
                Logger.log(`Tab ${tabId} cleanup skipped - already closed`);
              }
              reject(new Error('Company page automation timed out - no download detected'));
            });
        } else {
          chrome.downloads.onCreated.removeListener(downloadListener);
          // Safely remove tab
          try {
            chrome.tabs.remove(tabId, () => {
              if (chrome.runtime.lastError) {
                Logger.log(`Tab ${tabId} was already closed`);
              }
            });
          } catch (e) {
            Logger.log(`Tab ${tabId} cleanup skipped - already closed`);
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
            
            Logger.log(`Found recent company analytics file`);
            
            if (download.state === 'complete') {
              try {
                await uploadCompanyFile(download.filename, companyId, email);
                resolve();
                return;
              } catch (error) {
                Logger.error(`Failed to upload recent download: ${error.message}`);
              }
            } else if (download.state === 'in_progress') {
              // Wait for it to complete
              Logger.log('Download in progress, waiting for completion...');
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
      Logger.log(`Found company analytics file: ${download.filename}`);
      
      try {
        // Get the download URL - LinkedIn provides direct download URLs
        const downloadUrl = download.url;
        
        if (!downloadUrl) {
          reject(new Error('Download URL not available'));
          return;
        }
        
        Logger.log(`Fetching company file from URL: ${downloadUrl}`);
        
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
            console.log(`[DEBUG] Original filename: "${download.filename}"`);
            
            // Handle Windows paths (C:\Users\...)
            if (justFilename.includes('\\')) {
              justFilename = justFilename.split('\\').pop();
              console.log(`[DEBUG] After Windows split: "${justFilename}"`);
            }
            
            // Handle Unix paths (/home/user/...)
            if (justFilename.includes('/')) {
              justFilename = justFilename.split('/').pop();
              console.log(`[DEBUG] After Unix split: "${justFilename}"`);
            }
            
            // Fallback if extraction failed
            if (!justFilename || justFilename === download.filename) {
              // Try to extract from the end of the path using regex
              const match = download.filename.match(/[^\\\/]+$/);
              justFilename = match ? match[0] : 'company_analytics.xls';
              console.log(`[DEBUG] After regex fallback: "${justFilename}"`);
            }
            
            console.log(`[DEBUG] Final filename: "${justFilename}"`);
            
            // Prepare the payload for the company API
            const payload = {
              company_id: String(companyId), // Ensure it's a string
              user_email: String(email),     // Ensure it's a string
              file: base64Data,
              file_name: justFilename
            };
            
            Logger.log(`Uploading company analytics file for company ${companyId}`);
            
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
              Logger.log('Company analytics file uploaded successfully');
              resolve(responseData);
            } else {
              const errorText = await uploadResponse.text();
              Logger.error(`Company file upload failed: ${uploadResponse.status} - ${errorText}`);
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
  Logger.log(`Company execution status updated: ${status}`);
}

// ============================================================================
// ALARM MANAGER
// ============================================================================

/**
 * Manages Chrome alarms for scheduling tasks
 */
const AlarmManager = {
  /**
   * Set up the initial alarm
   * @returns {Promise<void>}
   */
  setupInitialAlarm: async function() {
    await initializeExecutionInterval();

    chrome.storage.local.get("nextExecution", (data) => {
      const now = new Date();
      let nextExecution;

      if (data.nextExecution) {
        nextExecution = new Date(data.nextExecution);

        // Check if stored execution time is in the past
        if (now >= nextExecution) {
          Logger.log("Stored execution time is in the past. Running task now.");
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

      Logger.log(`Alarm set. Next execution: ${nextExecution}`);
    });
  },

  /**
   * Set up the watchdog alarm
   */
  setupWatchdogAlarm() {
    // Run the watchdog more frequently (every 1 minute) to catch missed retries
    chrome.alarms.create(CONFIG.ALARMS.WATCHDOG, { periodInMinutes: 1 });
    Logger.log("Watchdog alarm set to run every minute");
    
    // Mark alarms as enabled
    chrome.storage.local.set({ alarmsEnabled: true });
    Logger.log("Alarms marked as enabled in storage");

    // Debug current alarms
    //chrome.alarms.getAll((alarms) => {
    //  Logger.log(`Initial alarms: ${JSON.stringify(alarms.map(a => ({
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
      Logger.log(`Alarm triggered: ${alarm.name} at ${new Date().toISOString()}`);

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

    Logger.log(`Main alarm triggered. Next execution: ${nextExecution}`);
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
          Logger.log(`=== WATCHDOG DETECTED MISSED RETRY at ${timestamp} ===`);
          Logger.log("Watchdog detected missed retry execution. Running retry now.");

          // Clear the retry scheduled flag
          chrome.storage.local.set({ retryScheduled: false });

          // Log the retry count
          Logger.log(`Current retry count: ${data.retryCount || 0}`);
          Logger.log(`Next retry time was: ${data.nextRetryTime}`);
          Logger.log(`Current time is: ${timestamp}`);
          Logger.log(`Time difference: ${now - nextRetryTime}ms`);

          // Run the automation script
          runAutomationScript();
          return; // Exit early to avoid running regular execution check
        }
      }

      // Check for missed regular execution
      if (data.nextExecution) {
        const nextExecution = new Date(data.nextExecution);
        if (now >= nextExecution) {
          Logger.log("Watchdog detected missed execution. Running task now.");
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
    Logger.log(`=== RETRY ALARM TRIGGERED at ${timestamp} ===`);
    Logger.log(`Retry alarm handler started. Time: ${timestamp}`);

    // Debug information about retry state
    chrome.storage.local.get(['retryCount', 'nextRetryTime', 'retryScheduled'], (data) => {
      Logger.log(`Current retry count before execution: ${data.retryCount || 0}`);
      Logger.log(`Retry scheduled: ${data.retryScheduled ? 'Yes' : 'No'}`);
      Logger.log(`Next retry time: ${data.nextRetryTime || 'Not set'}`);

      // Run the automation script with error handling
      try {
        Logger.log('Starting automation script from retry handler');
        runAutomationScript().catch(error => {
          Logger.error(`Retry execution failed: ${error.message}`);
        });
      } catch (error) {
        Logger.error(`Error in retry handler: ${error.message}`);
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

      Logger.log(`Manual execution triggered. Next execution: ${nextExecution}`);
      runAutomationScript();
    }
    else if (message.action === 'executeCompanyScript') {
      // Check if company automation is already running
      if (companyAutomationRunning) {
        Logger.log('Company automation already running, ignoring manual request');
        return;
      }
      
      Logger.log(`Manual company execution triggered for company ID: ${message.companyId}`);
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

          Logger.log(`Execution interval updated to ${EXECUTION_INTERVAL / (24 * 60 * 60 * 1000)} days. Next execution: ${nextExecution}`);
        }
      });
    }
  });

  // Handle browser startup and extension installation
  // Handle browser startup and extension installation
  chrome.runtime.onInstalled.addListener(() => {
    // Explicitly set alarmsEnabled flag immediately on installation
    chrome.storage.local.set({ alarmsEnabled: true }, () => {
      Logger.log("alarmsEnabled flag set to true on installation");
    });
    
    AlarmManager.setupInitialAlarm();
    AlarmManager.setupWatchdogAlarm();
    AlarmManager.initializeAlarmListeners();
  });

  chrome.runtime.onStartup.addListener(() => {
    // Explicitly set alarmsEnabled flag immediately on browser startup
    chrome.storage.local.set({ alarmsEnabled: true }, () => {
      Logger.log("alarmsEnabled flag set to true on browser startup");
    });
    
    AlarmManager.setupInitialAlarm();
    AlarmManager.setupWatchdogAlarm();
    AlarmManager.initializeAlarmListeners();
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
  Logger.log("Extension initialized with alarms enabled");
}

// Initialize the extension
initializeExtension();
/**
 * Professional Profile Analytics - Shiny App Integration
 * 
 * This script handles the integration with Shiny web applications,
 * allowing them to trigger LinkedIn post creation with human-like typing.
 */

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

// Enable or disable verbose debugging
const DEBUG_MODE = true;

// Debug logging function
function debugLog(message, data = null) {
  if (!DEBUG_MODE) return;
  
  const timestamp = new Date().toISOString();
  console.log(`[PPA-DEBUG ${timestamp}] ${message}`);
  if (data) {
    console.log('[PPA-DEBUG DATA]', data);
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
      console.error("LinkedIn post helper not found");
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
    console.error("Error in createLinkedInPost:", error);
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
          const analyticsUrl = this.transformToAnalyticsUrl(postUrl);
          
          // Navigate to the post analytics page
          await this.navigateToPostAnalytics(tabId, analyticsUrl, logger);
          
          // Wait for page to load
          await this.waitForAnalyticsPageLoad(tabId, logger);
          
          // Export the post analytics
          const downloadInfo = await this.exportPostAnalytics(tabId, logger);
          
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
            await this.delay(2000 + Math.random() * 3000); // 2-5 second delay
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
  },

  /**
   * Export post analytics data
   * @param {number} tabId - Tab ID
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Download information
   */
  async exportPostAnalytics(tabId, logger) {
    return new Promise((resolve, reject) => {
      // Track downloads before clicking export
      const downloadsBeforeExport = [];
      
      chrome.downloads.search({ limit: 10 }, (items) => {
        items.forEach(item => downloadsBeforeExport.push(item.id));
        
        // Click the export button using the existing MultilingualTabInteractions
        MultilingualTabInteractions.clickButton(tabId, 'export')
          .then(() => {
            logger.log('Export button clicked successfully');
            
            // Wait for download to start
            setTimeout(() => {
              chrome.downloads.search({ limit: 10 }, (newItems) => {
                const newDownloads = newItems.filter(item => 
                  !downloadsBeforeExport.includes(item.id) && 
                  (item.filename.toLowerCase().includes('post') || 
                   item.filename.toLowerCase().includes('analytics'))
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
          })
          .catch(error => {
            reject(new Error(`Export button click failed: ${error.message}`));
          });
      });
    });
  },

  /**
   * Upload advanced post statistics to API
   * @param {string} email - User email
   * @param {Array} downloadInfos - Array of download information
   * @param {Object} logger - Logger instance
   * @returns {Promise<Object>} Upload result
   */
  async uploadAdvancedStatistics(email, downloadInfos, logger) {
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
      formData.append('Email', email);
      formData.append('metadata', JSON.stringify(uploadData));
      
      // Add each downloaded file to the form data
      for (let i = 0; i < downloadInfos.length; i++) {
        const downloadInfo = downloadInfos[i].downloadInfo;
        
        try {
          // Get the file from the download URL if available
          if (downloadInfo.url) {
            const response = await fetch(downloadInfo.url);
            if (response.ok) {
              const fileBlob = await response.blob();
              formData.append(`post_analytics_${i}`, fileBlob, downloadInfo.filename);
              logger.log(`Added file ${downloadInfo.filename} to upload`);
            } else {
              logger.warn(`Could not fetch file ${downloadInfo.filename} from URL`);
            }
          }
        } catch (error) {
          logger.warn(`Failed to add file ${downloadInfo.filename}: ${error.message}`);
        }
      }
      
      // Upload to API
      logger.log(`Uploading to endpoint: ${API_ENDPOINT}`);
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        body: formData
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Upload failed with status ${response.status}: ${errorText}`);
      }
      
      const result = await response.json();
      logger.log('Advanced post statistics uploaded successfully');
      
      return result;
      
    } catch (error) {
      logger.error(`Failed to upload advanced post statistics: ${error.message}`);
      throw error;
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

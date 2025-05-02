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
      // Always close the tab
      chrome.tabs.remove(tabId);
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
      // Always close the tab
      chrome.tabs.remove(tabId);
    }
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

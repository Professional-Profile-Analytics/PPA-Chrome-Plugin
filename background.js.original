/**
 * Professional Profile Analytics - Background Service Worker
 * 
 * This script handles the automated download and upload of LinkedIn analytics data
 * to the Professional Profile Analytics service.
 */

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
    INTERVAL: 5 * 60 * 1000, // 5 minutes in milliseconds
    MAX_ATTEMPTS: 2
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
// TAB INTERACTIONS
// ============================================================================

/**
 * Utilities for interacting with browser tabs
 */
const TabInteractions = {
  /**
   * Wait for a page to fully load
   * @param {number} tabId - The ID of the tab to wait for
   * @param {number} maxWait - Maximum wait time in milliseconds
   * @returns {Promise<void>}
   * @throws {AutomationError} If page load times out or script execution fails
   */
  waitForPageLoad(tabId, maxWait = 50000) {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkInterval = setInterval(() => {
        // Check if we've exceeded max wait time
        if (Date.now() - startTime > maxWait) {
          clearInterval(checkInterval);
          reject(new AutomationError('Page load timeout', {
            tabId,
            maxWait
          }));
        }

        chrome.scripting.executeScript({
          target: { tabId },
          func: () => document.readyState
        }, (results) => {
          if (chrome.runtime.lastError) {
            clearInterval(checkInterval);
            reject(new AutomationError('Script execution error', {
              error: chrome.runtime.lastError
            }));
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
   * Click a button in a tab
   * @param {number} tabId - The ID of the tab
   * @param {string} buttonText - The text content of the button to click
   * @returns {Promise<void>}
   * @throws {AutomationError} If button is not found or script execution fails
   */
  clickButton(tabId, buttonText) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (text) => {
          const button = Array.from(document.querySelectorAll('button'))
            .find((btn) => btn.textContent.includes(text));

          if (button) {
            button.scrollIntoView({ behavior: "smooth", block: "center" });
            button.click();
            return true;
          }
          return false;
        },
        args: [buttonText]
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new AutomationError('Button click script error', {
            buttonText,
            error: chrome.runtime.lastError
          }));
        } else if (!results[0]?.result) {
          reject(new AutomationError('Button not found', {
            buttonText
          }));
        } else {
          // Wait a bit after clicking to allow for potential UI updates
          setTimeout(resolve, 5000);
        }
      });
    });
  },

  /**
   * Click a link in a tab
   * @param {number} tabId - The ID of the tab
   * @param {string} linkText - The text content of the link to click
   * @returns {Promise<void>}
   * @throws {AutomationError} If link is not found or script execution fails
   */
  clickLink(tabId, linkText) {
    return new Promise((resolve, reject) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (text) => {
          const links = Array.from(document.querySelectorAll('a'));
          const link = links.find((a) => a.textContent.includes(text));

          if (link) {
            link.scrollIntoView({ behavior: "smooth", block: "center" });
            link.click();
            return true;
          }
          return false;
        },
        args: [linkText]
      }, (results) => {
        if (chrome.runtime.lastError) {
          reject(new AutomationError('Link click script error', {
            linkText,
            error: chrome.runtime.lastError
          }));
        } else if (!results[0]?.result) {
          reject(new AutomationError('Link not found', {
            linkText
          }));
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
   * @param {string} linkText - The text content of the link to click
   * @returns {Promise<void>}
   */
  clickLinkSoft(tabId, linkText) {
    return new Promise((resolve) => {
      chrome.scripting.executeScript({
        target: { tabId },
        func: (text) => {
          const links = Array.from(document.querySelectorAll('a'));
          const link = links.find((a) => a.textContent.includes(text));

          if (link) {
            link.scrollIntoView({ behavior: "smooth", block: "center" });
            link.click();
            return true;
          }
          return false;
        },
        args: [linkText]
      }, (results) => {
        if (chrome.runtime.lastError) {
          console.warn('Link click script error:', chrome.runtime.lastError);
          resolve(); // Proceed silently
        } else if (!results[0]?.result) {
          console.info(`Link "${linkText}" not found, continuing...`);
          resolve(); // Link not found, continue
        } else {
          // Wait a bit after clicking to allow for potential UI updates
          setTimeout(resolve, 5000);
        }
      });
    });
  },

  /**
   * Select an option in a list
   * @param {number} tabId - The ID of the tab
   * @param {string} forAttributeValue - The value of the "for" attribute of the label
   * @returns {Promise<void>}
   * @throws {AutomationError} If option is not found or script execution fails
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
          reject(new AutomationError('List option selection script error', {
            forAttributeValue,
            error: chrome.runtime.lastError
          }));
        } else if (!results[0]?.result) {
          reject(new AutomationError('List option not found', {
            forAttributeValue
          }));
        } else {
          // Wait a bit after selecting to allow for potential UI updates
          setTimeout(resolve, 5000);
        }
      });
    });
  }
};
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
// LINKEDIN AUTOMATION
// ============================================================================

/**
 * Handles LinkedIn automation workflows
 */
const LinkedInAutomation = {
  /**
   * Execute the standard LinkedIn automation steps
   * @param {number} tabId - The ID of the tab
   * @param {string} email - The user's email address
   * @returns {Promise<void>}
   */
  async executeSteps(tabId, email) {
    try {
      // Wait for initial page load
      await TabInteractions.waitForPageLoad(tabId);

      // Navigate through LinkedIn analytics
      await TabInteractions.clickLink(tabId, 'Post impressions');
      await TabInteractions.waitForPageLoad(tabId);
      // 3.4.2025 - LinkedIn removed this step for some accounts
      await TabInteractions.clickLinkSoft(tabId, 'Post impressions');
      await TabInteractions.waitForPageLoad(tabId);

      // Configure time range
      await TabInteractions.clickButton(tabId, 'Past 7 days');
      // 3.4.2025 - LinkedIn renamed this option
      await TabInteractions.selectListOption(tabId, "timeRange-past_28_days");
      await TabInteractions.clickButton(tabId, 'Show results');
      await TabInteractions.waitForPageLoad(tabId);

      // Track and download file
      const downloadTracker = WebRequestTracker.trackDownload(tabId);
      let buttonClicked = false;
      try {
        await TabInteractions.clickButton(tabId, 'Export');
        buttonClicked = true;
      } catch (error) {
        Logger.warn("First attempt to click 'Export' failed, retrying in 15 seconds...");
        await new Promise(resolve => setTimeout(resolve, 15000));
        await TabInteractions.clickButton(tabId, 'Export');
      }

      // Get download URL and upload file
      const apiURL = await downloadTracker;
      await FileUploader.uploadToWebhook(apiURL, email);

      // Update successful execution status
      await ConfigManager.updateExecutionStatus('✅Success');
      // Reset retry count on success
      await ConfigManager.resetRetryCount();

    } catch (error) {
      // Log and update failed execution status
      Logger.error(`LinkedIn automation failed: ${error.message}`);
      await ConfigManager.updateExecutionStatus('Failed', error);
      // Schedule retry
      await scheduleRetry();
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
   * @returns {Promise<void>}
   */
  async executeStepsDirect(tabId, email) {
    try {
      // Wait for initial page load
      await TabInteractions.waitForPageLoad(tabId);

      // Attempt to download file with multiple button click strategies
      await this.clickExportButton(tabId, email);

      // Update successful execution status
      await ConfigManager.updateExecutionStatus('✅Success');
      // Reset retry count on success
      await ConfigManager.resetRetryCount();

    } catch (error) {
      // Log and update failed execution status
      Logger.error(`LinkedIn direct automation failed: ${error.message}`);
      await ConfigManager.updateExecutionStatus('Failed', error);
      // Schedule retry
      await scheduleRetry();
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
   * @returns {Promise<void>}
   * @throws {AutomationError} If all click attempts fail
   */
  async clickExportButton(tabId, email) {
    const exportButtonTexts = ['Export', 'Export', 'Export'];
    let downloadTracked = false;

    for (const buttonText of exportButtonTexts) {
      try {
        // Track download before clicking
        const downloadTracker = WebRequestTracker.trackDownload(tabId);

        // Attempt to click the button
        await TabInteractions.clickButton(tabId, buttonText);

        // Wait for potential download
        const apiURL = await Promise.race([
          downloadTracker,
          new Promise((_, reject) =>
            setTimeout(() => reject(new AutomationError('Download timeout')), 30000)
          )
        ]);

        // If download is successful, upload the file
        await FileUploader.uploadToWebhook(apiURL, email);
        downloadTracked = true;
        break;
      } catch (error) {
        Logger.warn(`Attempt to click '${buttonText}' failed: ${error.message}`);

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }

    if (!downloadTracked) {
      throw new AutomationError('Failed to download file after multiple attempts', {
        buttonTexts: exportButtonTexts
      });
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

  if (currentRetryCount < CONFIG.RETRY.MAX_ATTEMPTS) {
    const newRetryCount = currentRetryCount + 1;
    await ConfigManager.updateRetryCount(newRetryCount);

    // Schedule retry alarm for 5 minutes later
    const retryTime = Date.now() + CONFIG.RETRY.INTERVAL;
    chrome.alarms.create(CONFIG.ALARMS.RETRY, { when: retryTime });

    Logger.log(`Scheduled retry #${newRetryCount} in 5 minutes. Time: ${new Date(retryTime).toISOString()}`);
  } else {
    Logger.log(`Maximum retry attempts (${CONFIG.RETRY.MAX_ATTEMPTS}) reached. No more retries will be scheduled.`);
    // Reset retry count after max attempts
    await ConfigManager.resetRetryCount();
  }
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

    // Randomly choose between the existing and new solution
    const useDirect = Math.random() < 0.5; // 50% chance for each

    if (useDirect) {
      // New solution: use executeStepsDirect
      chrome.tabs.create({ 
        url: CONFIG.LINKEDIN.ANALYTICS, 
        active: false 
      }, (tab) => {
        LinkedInAutomation.executeStepsDirect(tab.id, email)
          .catch(error => {
            Logger.error(`Direct automation script failed: ${error.message}`);
          });
      });
    } else {
      // Existing solution: use executeSteps
      chrome.tabs.create({ 
        url: CONFIG.LINKEDIN.HOME, 
        active: false 
      }, (tab) => {
        LinkedInAutomation.executeSteps(tab.id, email)
          .catch(error => {
            Logger.error(`Automation script failed: ${error.message}`);
          });
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

      // Save next execution time
      chrome.storage.local.set({
        nextExecution: nextExecution.toISOString()
      });

      Logger.log(`Alarm set. Next execution: ${nextExecution}`);
    });
  },

  /**
   * Set up the watchdog alarm
   */
  setupWatchdogAlarm() {
    chrome.alarms.create(CONFIG.ALARMS.WATCHDOG, { periodInMinutes: 5 });
  },

  /**
   * Initialize alarm listeners
   */
  initializeAlarmListeners() {
    chrome.alarms.onAlarm.addListener((alarm) => {
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
    chrome.storage.local.get("nextExecution", (data) => {
      const now = new Date();
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
    Logger.log("Retry alarm triggered. Attempting automation again.");
    runAutomationScript();
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
  chrome.runtime.onInstalled.addListener(() => {
    AlarmManager.setupInitialAlarm();
    AlarmManager.setupWatchdogAlarm();
    AlarmManager.initializeAlarmListeners();
  });

  chrome.runtime.onStartup.addListener(() => {
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
}

// Initialize the extension
initializeExtension();

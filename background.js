// Constants
let EXECUTION_INTERVAL = 3 * 24 * 60 * 60 * 1000; // 3 days in milliseconds
const ALARM_NAME = "autoDownloadAndUpload";
const WATCHDOG_ALARM_NAME = "watchdog";
const WEBHOOK_URL = "https://cwf6tbhekvwzbb35oe3psa7lza0oiaoj.lambda-url.us-east-1.on.aws/";

// Logging utility
const Logger = {
    log(message, level = 'info') {
        const timestamp = new Date().toISOString();
        console.log(`[${level.toUpperCase()}] ${timestamp}: ${message}`);

        // Optionally, store logs in chrome storage for persistent logging
        chrome.storage.local.get(['logs'], (result) => {
            const logs = result.logs || [];
            logs.push({ timestamp, level, message });

            // Keep only the last 100 logs to prevent storage overflow
            const trimmedLogs = logs.slice(-100);
            chrome.storage.local.set({ logs: trimmedLogs });
        });
    },
    error(message) {
        this.log(message, 'error');
    },
    warn(message) {
        this.log(message, 'warn');
    }
};

// Error handling utility
class AutomationError extends Error {
    constructor(message, context = {}) {
        super(message);
        this.name = 'AutomationError';
        this.context = context;
    }
}

// Configuration and state management
const ConfigManager = {
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
  }
  }

// Web Request Utilities
const WebRequestTracker = {
    trackDownload(tabId, timeout = 15000) {
        return new Promise((resolve, reject) => {
            const listener = (details) => {
                if (details.method === "GET" && details.url.includes(".xlsx")) {
                    chrome.webRequest.onCompleted.removeListener(listener);
                    resolve(details.url);
                }
            };

            chrome.webRequest.onCompleted.addListener(
                listener,
                { urls: ["<all_urls>"] }
            );

            // Set a timeout to reject if no download is detected
            setTimeout(() => {
                chrome.webRequest.onCompleted.removeListener(listener);
                reject(new AutomationError('No .xlsx download detected', {
                    tabId,
                    timeout
                }));
            }, timeout);
        });
    }
};



// Add this function to initialize the interval based on stored settings
async function initializeExecutionInterval() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['uploadFrequency'], (result) => {
            if (result.uploadFrequency) {
                switch(result.uploadFrequency) {
                    case 'daily':
                        EXECUTION_INTERVAL = 24 * 60 * 60 * 1000; // 1 day
                        break;
                    default:
                        EXECUTION_INTERVAL = 3 * 24 * 60 * 60 * 1000; // 3 days (default)
                }
            }
            Logger.log(`Execution interval set to ${EXECUTION_INTERVAL / (24 * 60 * 60 * 1000)} days`);
            resolve();
        });
    });
}


// Browser Tab Interaction Utilities
const TabInteractions = {
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
                        setTimeout(resolve, 2000);
                    }
                });
            }, 500);
        });
    },

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
                    setTimeout(resolve, 2000);
                }
            });
        });
    },

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
                    setTimeout(resolve, 2000);
                }
            });
        });
    },

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
                    setTimeout(resolve, 2000);
                }
            });
        });
    }
};

// File Upload Utility
const FileUploader = {
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
            const uploadResponse = await fetch(WEBHOOK_URL, {
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

// LinkedIn Automation Flow
const LinkedInAutomation = {
    async executeSteps(tabId, email) {
        try {
            // Wait for initial page load
            await TabInteractions.waitForPageLoad(tabId);

            // Navigate through LinkedIn analytics
            await TabInteractions.clickLink(tabId, 'Post impressions');
            await TabInteractions.waitForPageLoad(tabId);
            await TabInteractions.clickLink(tabId, 'Post impressions');
            await TabInteractions.waitForPageLoad(tabId);

            // Configure time range
            await TabInteractions.clickButton(tabId, 'Past 7 days');
            await TabInteractions.selectListOption(tabId, "timeRange-past_4_weeks");
            await TabInteractions.clickButton(tabId, 'Show results');
            await TabInteractions.waitForPageLoad(tabId);

            // Track and download file
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

        } catch (error) {
            // Log and update failed execution status
            Logger.error(`LinkedIn automation failed: ${error.message}`);
            await ConfigManager.updateExecutionStatus('Failed', error);
            throw error;
        } finally {
            // Always close the tab
            chrome.tabs.remove(tabId);
        }
    },


    async executeStepsDirect(tabId, email) {
    try {
        // Wait for initial page load
        await TabInteractions.waitForPageLoad(tabId);

        // Attempt to download file with multiple button click strategies
        await this.clickExportButton(tabId, email);

        // Update successful execution status
        await ConfigManager.updateExecutionStatus('✅Success');

    } catch (error) {
        // Log and update failed execution status
        Logger.error(`LinkedIn direct automation failed: ${error.message}`);
        await ConfigManager.updateExecutionStatus('Failed', error);
        throw error;
    } finally {
        // Always close the tab
        chrome.tabs.remove(tabId);
    }
    },

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

// Main Automation Script
async function runAutomationScript() {
    try {
        // Retrieve email
        const email = await ConfigManager.getEmail();

        // Randomly choose between the existing and new solution
        const useDirect = Math.random() < 0.5; // 50% chance for each

        if (useDirect) {
            // New solution: use executeStepsDirect
            chrome.tabs.create({ url: "https://www.linkedin.com/analytics/creator/content/?metricType=IMPRESSIONS&timeRange=past_4_weeks", active: false }, (tab) => { // Example: Change URL here
                LinkedInAutomation.executeStepsDirect(tab.id, email)
                    .catch(error => {
                        Logger.error(`Direct automation script failed: ${error.message}`);
                    });
            });
        } else {
            // Existing solution: use executeSteps
            chrome.tabs.create({ url: "https://linkedin.com", active: false }, (tab) => {
                LinkedInAutomation.executeSteps(tab.id, email)
                    .catch(error => {
                        Logger.error(`Automation script failed: ${error.message}`);
                    });
            });
        }

    } catch (error) {
        Logger.error(`Automation initialization failed: ${error.message}`);
        await ConfigManager.updateExecutionStatus('Failed', error);
    }
}

// Alarm and Scheduling Management
const AlarmManager = {
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
          chrome.alarms.create(ALARM_NAME, {
              periodInMinutes: EXECUTION_INTERVAL / (60 * 1000)
          });

          // Save next execution time
          chrome.storage.local.set({
              nextExecution: nextExecution.toISOString()
          });

          Logger.log(`Alarm set. Next execution: ${nextExecution}`);
      });
  },


    setupWatchdogAlarm() {
        chrome.alarms.create(WATCHDOG_ALARM_NAME, { periodInMinutes: 60 });
    },

    initializeAlarmListeners() {
        chrome.alarms.onAlarm.addListener((alarm) => {
            switch(alarm.name) {
                case ALARM_NAME:
                    this.handleMainAlarm();
                    break;
                case WATCHDOG_ALARM_NAME:
                    this.checkForMissedExecutions();
                    break;
            }
        });
    },

    handleMainAlarm() {
        const nextExecution = new Date(Date.now() + EXECUTION_INTERVAL);
        chrome.storage.local.set({
            nextExecution: nextExecution.toISOString()
        });

        Logger.log(`Main alarm triggered. Next execution: ${nextExecution}`);
        runAutomationScript();
    },

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
                    chrome.alarms.create(ALARM_NAME, {
                        when: newExecutionTime.getTime()
                    });
                    chrome.storage.local.set({
                        nextExecution: newExecutionTime.toISOString()
                    });
                }
            }
        });
    }
};

// Runtime Event Listeners
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
            chrome.alarms.clear(ALARM_NAME, (wasCleared) => {
                if (wasCleared) {
                    const nextExecution = new Date(Date.now() + EXECUTION_INTERVAL);
                    chrome.alarms.create(ALARM_NAME, {
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

// Initialize the extension
async function initializeExtension() {
    await initializeExecutionInterval();
    setupRuntimeListeners();
}

// Initialize the extension
initializeExtension();

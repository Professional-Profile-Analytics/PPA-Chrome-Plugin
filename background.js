// Set up time interval (e.g., 2 hours in milliseconds)
const tt = 3 * 24 * 60 * 60 * 1000; // 3*24 hours from now (in milliseconds)

// Set up an alarm to trigger every X hours
chrome.runtime.onInstalled.addListener(() => {
    // Retrieve stored next execution time or use default
    chrome.storage.local.get("nextExecution", (data) => {
        const now = new Date();
        let nextExecution;

        if (data.nextExecution) {
            nextExecution = new Date(data.nextExecution);
            console.log("Found stored next execution:", nextExecution);

            // Check if the stored execution time is in the past
            if (now >= nextExecution) {
                console.log("Stored execution time is in the past. Running task now.");
                // Run the automation task immediately
                runAutomationScript();

                // Calculate and set the new next execution time
                nextExecution = new Date(now.getTime() + tt);
                console.log("Updated next execution after immediate run:", nextExecution);

            }
        } else {
            // If no execution time is stored, set it for the first time
            nextExecution = new Date(now.getTime() + tt); // Set it to the desired time interval
            console.log("Setting initial next execution:", nextExecution);
        }

        // Create an alarm that triggers every period
        chrome.alarms.create("autoDownloadAndUpload", { periodInMinutes: tt / (60 * 1000) });

        // Save the next execution time in storage
        chrome.storage.local.set({ nextExecution: nextExecution.toISOString() });
        console.log("Alarm set. Next execution:", nextExecution);
    });
});


// Update the next execution time whenever the alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "autoDownloadAndUpload") {
        const nextExecution = new Date(Date.now() + tt);
        chrome.storage.local.set({ nextExecution: nextExecution.toISOString() });
        console.log("Alarm triggered. Next execution:", nextExecution);

        // Start the automation process
        runAutomationScript();
    }
});

// Handle situations where Chrome is started after a missed execution
chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get("nextExecution", (data) => {
        const now = new Date(); // Use Date object for current time
        if (data.nextExecution) {
            const nextExecution = new Date(data.nextExecution); // Convert stored time to Date object

            // If the scheduled time has passed, trigger the task immediately
            if (now >= nextExecution) {
                console.log("Missed scheduled execution. Running task now.");
                runAutomationScript();

                // Schedule the next execution time
                const newExecutionTime = new Date(now.getTime() + tt); // Use Date object for new time
                chrome.alarms.create("autoDownloadAndUpload", { when: newExecutionTime.getTime() });
                chrome.storage.local.set({ nextExecution: newExecutionTime.toISOString() });
            }
        }
    });
});


// Listen for system idle state changes
chrome.idle.onStateChanged.addListener((newState) => {
  if (newState === "active") {
    // Check if we missed any alarms while the system was idle/locked
    chrome.storage.local.get("nextExecution", (data) => {
      const now = new Date();
      if (data.nextExecution) {
        const nextExecution = new Date(data.nextExecution);
        if (now >= nextExecution) {
          console.log("Detected missed alarm after system idle. Running task now.");
          runAutomationScript();
          // Schedule the next execution
          const newExecutionTime = new Date(now.getTime() + tt);
          chrome.alarms.create("autoDownloadAndUpload", { when: newExecutionTime.getTime() });
          chrome.storage.local.set({ nextExecution: newExecutionTime.toISOString() });
        }
      }
    });
  }
});



// Start the automation when the user clicks "Download and Upload NOW"
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'executeScript') {
    runAutomationScript();

    // Update the next execution time after the script runs
    const nextExecution = new Date(Date.now() + tt); // Set it to +tt (2 hours from now)
    chrome.storage.local.set({ nextExecution: nextExecution.toISOString() });
    console.log("Next execution updated after manual trigger:", nextExecution);
  }
});



// BASIC script with console.log
async function runAutomationScript() {
  let email = null;

  // Store the execution start time
  const executionTime = new Date().toISOString();


  // Use Promise to get email from chrome storage synchronously
  await new Promise((resolve, reject) => {
    chrome.storage.local.get(['email'], (result) => {
      email = result.email;
      if (email) {
        resolve(email);  // Successfully fetched email, resolve promise
      } else {
        reject('No email found. Please set your email address in the options page first.');
      }
    });
  }).catch((error) => {
    console.log(error);  // Log error to console instead of alert
    return; // Stop the function if email is not found
  });

  // If email is found, continue with the automation process
  // console.log(email);  // Log the email for verification

  // Open LinkedIn tab and proceed
  chrome.tabs.create({ url: "https://linkedin.com", active: false }, (tab) => {
    const tabId = tab.id;
    executeLinkedInSteps(tabId);
  });

}







let downloadedFilePath = null;

// Listen for a file download to capture the path
chrome.downloads.onCreated.addListener((downloadItem) => {
  // Define a condition to identify LinkedIn analytics files
  const linkedInExportUrlPattern = "linkedin.com"; // Match LinkedIn domain
  const expectedFileExtension = ".xlsx"; // Ensure it's an Excel file

  // Check if the download is from LinkedIn and matches expected criteria
  if (downloadItem.finalUrl.includes(linkedInExportUrlPattern)) {
    if (downloadItem.filename && downloadItem.filename.endsWith(expectedFileExtension)) {
      // If filename is already set, use it directly
      downloadedFilePath = downloadItem.filename;
      console.log("LinkedIn analytics file downloaded:", downloadedFilePath);
    } else if (!downloadItem.filename && downloadItem.finalUrl) {
      // Try to extract the filename from the URL if not directly available
      const url = new URL(downloadItem.finalUrl);
      const fileNameFromUrl = url.searchParams.get("x-ambry-um-filename");

      if (fileNameFromUrl && fileNameFromUrl.endsWith(expectedFileExtension)) {
        downloadedFilePath = fileNameFromUrl;
        console.log("LinkedIn analytics file downloaded (from URL):", downloadedFilePath);
      } else {
        console.error("No valid .xlsx file found in the URL for LinkedIn analytics:", fileNameFromUrl);
      }
    }
  } else {
    // Ignore downloads that don't match LinkedIn analytics export criteria
    //console.log("Download ignored (not LinkedIn analytics):", downloadItem.finalUrl);
  }
});



// Helper function to wait for the page to load
function waitForPageLoad(tabId) {
  return new Promise((resolve, reject) => {
    let checkInterval = setInterval(() => {
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => document.readyState
      }, (results) => {
        if (chrome.runtime.lastError) {
          clearInterval(checkInterval);
          reject(chrome.runtime.lastError);
        } else if (results && results[0]?.result === 'complete') {
          clearInterval(checkInterval);
          setTimeout(resolve, 5000); // Wait 1 second before proceeding
        }
      });
    }, 500); // Check every 500ms
  });
}

// Helper function to click on a link
function clickLink(tabId, linkText) {
    return new Promise((resolve, reject) => {
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: (text) => {
                const links = Array.from(document.querySelectorAll('a'));
                const link = links.find((a) => a.textContent.includes(text));

                if (link) {
                    link.scrollIntoView({ behavior: "smooth", block: "center" }); // Scroll into view
                    setTimeout(() => {
                        link.click();
                    }, 1500); // Wait 1.5s before clicking
                    return true;
                } else {
                    return false;
                }
            },
            args: [linkText]
        }, (results) => {
            if (chrome.runtime.lastError || !results[0]?.result) {
                reject(new Error(`Failed to click link: ${linkText}`));
            } else {
                setTimeout(resolve, 3000); // Give time before the next step
            }
        });
    });
}


function selectListOptionByForAttribute(tabId, forAttributeValue) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        func: (attributeValue) => {
          // Find the label with the matching `for` attribute
          const label = document.querySelector(`label[for="${attributeValue}"]`);
          if (label) {
            label.click(); // Click the label to select the associated radio button
            return true;
          } else {
            throw new Error(`Label with for="${attributeValue}" not found.`);
          }
        },
        args: [forAttributeValue],
      },
      (results) => {
        if (chrome.runtime.lastError || !results[0]?.result) {
          reject(new Error(`Failed to select option with for="${forAttributeValue}".`));
        } else {
          resolve(); // Successfully clicked the label
        }
      }
    );
  });
}



// Helper function to click a button
function clickButton(tabId, buttonText) {
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (text) => {
        const button = Array.from(document.querySelectorAll('button')).find((btn) => btn.textContent.includes(text));
        if (button) {
          button.click();
          return true;
        } else {
          throw new Error(`Button with text "${text}" not found.`);  // Corrected this line
        }
      },
      args: [buttonText]
    }, (results) => {
      if (chrome.runtime.lastError || !results[0]?.result) {
        reject(new Error(`Failed to click button: ${buttonText}`));  // Corrected this line
      } else {
        setTimeout(resolve, 1000); // Wait 1 second before continuing
      }
    });
  });
}




// The main script execution flow
const executeLinkedInSteps = async (tabId) => {
  try {
    // Get email from storage
    let email = null;
    chrome.storage.local.get(['email'], (result) => {
      email = result.email;

      if (!email) {
        console.error("Email not found. Please set your email in the options.");
        alert('Please set your email address in the options page first.');
        return;  // Exit if email is not found
      }

      // Continue with the rest of the steps if email is found
      proceedWithLinkedInSteps(tabId, email);
    });

  } catch (err) {
    console.error('Error during automation process:', err);
  }
};



const proceedWithLinkedInSteps = async (tabId, email) => {
  try {
    // Wait for the page to load before interacting
    await waitForPageLoad(tabId); // Wait for the initial page load

    // Wait for and click the first "Post impressions" link
    await clickLink(tabId, 'Post impressions');

    // Wait for the page to load after clicking
    await waitForPageLoad(tabId);

    // Wait for and click the second "Post impressions" link
    await clickLink(tabId, 'Post impressions');

    // Wait for the page to load again
    await waitForPageLoad(tabId);

    // Step 1: Click "Past 7 days" button to open the dropdown
    await clickButton(tabId, 'Past 7 days');

    // Step 2: Select "Past 28 days" from the dropdown
    await selectListOptionByForAttribute(tabId, "timeRange-past_4_weeks");

    // Step 3: Click "Show results" button
    await clickButton(tabId, 'Show results');

    // Wait for the results to load
    await waitForPageLoad(tabId);


    // Wait for and click the "Export" button, and track the download
    const apiURL = await clickButtonAndTrackDownload(tabId, 'Export');

    // Check if the API URL is valid
    if (!apiURL) {
      console.error("No API URL found.");
      return;
    }

    // Send the downloaded file to the webhook
    await sendFileToWebhook(apiURL, email);

  } catch (err) {
    console.error('Error during automation process:', err);
    // ❌ Set execution status as failed
    chrome.storage.local.set({
        lastExecution: new Date().toISOString(),
        lastExecutionStatus: `❌ Failed: ${err.message}`
    });
  } finally {
    // Clean up by closing the tab
    chrome.tabs.remove(tabId);
  }
};



async function sendFileToWebhook(fileUrl, email) {
    const webhookUrl = "https://cwf6tbhekvwzbb35oe3psa7lza0oiaoj.lambda-url.us-east-1.on.aws/";

    try {
        if (!fileUrl) {
            throw new Error("File URL is not provided.");
        }

        // Fetch the file from the given URL
        console.log("Fetching the file from URL:", fileUrl);
        const response = await fetch(fileUrl);

        if (!response.ok) {
            throw new Error(`Failed to fetch file from URL. Status: ${response.status}`);
        }

        // Create a Blob from the file content
        const fileBlob = await response.blob();
        // Extract the file name from the URL parameter "x-ambry-um-filename"
        const urlParams = new URLSearchParams(new URL(fileUrl).search);
        const fileName = urlParams.get('x-ambry-um-filename') || 'default_filename.xlsx'; // Fallback in case the parameter is missing

        if (!fileName.endsWith('.xlsx')) {
            throw new Error("The extracted file name is not a valid .xlsx file.");
        }

        // Construct FormData to send the file
        const formData = new FormData();
        formData.append("Email", email);
        formData.append("xlsx", fileBlob, fileName);

        // Upload the file to the webhook
        console.log("Uploading file to webhook...");
        const uploadResponse = await fetch(webhookUrl, {
            method: "POST",
            body: formData,
        });

        if (!uploadResponse.ok) {
            throw new Error(`Upload failed with status ${uploadResponse.status}: ${await uploadResponse.text()}`);
        }

        console.log("File successfully uploaded:", await uploadResponse.json());

        // ✅ Set execution status only if upload is successful
        chrome.storage.local.set({
            lastExecution: new Date().toISOString(),
            lastExecutionStatus: "✅ Success"
        });

    } catch (error) {
        console.error("Error during the upload process:", error);

        // ❌ Set execution status as failed
        chrome.storage.local.set({
            lastExecution: new Date().toISOString(),
            lastExecutionStatus: `❌ Failed: ${error.message}`
        });
    }
}



async function clickButtonAndTrackDownload(tabId, buttonText, retryCount = 2) {
    return new Promise((resolve, reject) => {
        let downloadTimeout = 15000; // Timeout after 15 seconds if no file is downloaded
        let retryDelay = 10000; // Wait 10 seconds before retrying
        let apiURL = null;
        let attempt = 0; // Track the number of attempts

        function attemptClick() {
            attempt++;
            console.log(`Attempt ${attempt}: Clicking button "${buttonText}"`);

            try {
                // Start tracking network requests
                let listener = (details) => {
                    if (details.method === "GET" && details.url.includes(".xlsx")) {
                        apiURL = details.url;
                        console.log("Excel file request detected:", apiURL);
                        chrome.webRequest.onCompleted.removeListener(listener);
                        resolve(apiURL); // Resolve the promise with the URL
                    }
                };

                chrome.webRequest.onCompleted.addListener(listener, { urls: ["<all_urls>"] });

                // Execute the button click
                chrome.scripting.executeScript(
                    {
                        target: { tabId: tabId },
                        func: (text) => {
                            const button = Array.from(document.querySelectorAll("button"))
                                .find((btn) => btn.textContent.includes(text));
                            if (button) {
                                button.click();
                                return true;
                            } else {
                                throw new Error(`Button with text "${text}" not found.`);
                            }
                        },
                        args: [buttonText],
                    },
                    (results) => {
                        if (chrome.runtime.lastError || !results[0]?.result) {
                            reject(new Error(`Failed to click button: ${buttonText}`));
                        }
                    }
                );

                // Retry logic
                setTimeout(() => {
                    if (!apiURL && attempt <= retryCount) {
                        console.log(`Retrying... Attempt ${attempt + 1}`);
                        attemptClick(); // Retry clicking the button
                    } else if (!apiURL) {
                        reject(new Error("No .xlsx download request detected within the timeout period."));
                    }
                }, retryDelay);
            } catch (error) {
                // ❌ Set execution status as failed
                chrome.storage.local.set({
                    lastExecution: new Date().toISOString(),
                    lastExecutionStatus: `❌ Failed: ${error.message}`
                });
                reject(new Error("Error during button click and tracking: " + error.message));
            }
        }

        attemptClick(); // Start the first attempt
    });
}


//////
// Alarm check
//////

function checkAlarmsPermission() {
    return new Promise((resolve) => {
        let testAlarmName = "testAlarm";

        // Create a short-lived test alarm
        chrome.alarms.create(testAlarmName, { delayInMinutes: 0.1 });

        // Listen for the test alarm
        chrome.alarms.onAlarm.addListener(function testListener(alarm) {
            if (alarm.name === testAlarmName) {
                chrome.alarms.onAlarm.removeListener(testListener); // Cleanup
                resolve(true); // Alarms are working
            }
        });

        // Timeout if no alarm triggers (meaning alarms are disabled)
        setTimeout(() => {
            resolve(false); // Alarms are disabled or blocked
        }, 10000); // Wait 10 seconds before assuming failure
    });
}

async function detectAlarmsSupport() {
    const alarmsEnabled = await checkAlarmsPermission();
    chrome.storage.local.set({ alarmsEnabled });
}

chrome.runtime.onInstalled.addListener(detectAlarmsSupport);
chrome.runtime.onStartup.addListener(detectAlarmsSupport);



/////////
// Watchdog to check for missed executio
/////////

// Create a watchdog alarm that checks every 5 minutes
chrome.alarms.create("watchdog", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "watchdog") {
    // Check if main task execution was missed
    checkForMissedExecutions();
  } else if (alarm.name === "autoDownloadAndUpload") {
      const nextExecution = new Date(Date.now() + tt);
      chrome.storage.local.set({ nextExecution: nextExecution.toISOString() });
      console.log("Alarm triggered. Next execution:", nextExecution);

      // Start the automation process
      runAutomationScript();
  }
});

function checkForMissedExecutions() {
  chrome.storage.local.get("nextExecution", (data) => {
    const now = new Date();
    if (data.nextExecution) {
      const nextExecution = new Date(data.nextExecution);
      if (now >= nextExecution) {
        console.log("Watchdog detected missed execution. Running task now.");
        runAutomationScript();
        // Schedule next execution
        const newExecutionTime = new Date(now.getTime() + tt);
        chrome.alarms.create("autoDownloadAndUpload", { when: newExecutionTime.getTime() });
        chrome.storage.local.set({ nextExecution: newExecutionTime.toISOString() });
      }
    }
  });
}

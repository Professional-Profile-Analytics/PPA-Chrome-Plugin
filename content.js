/**
 * Professional Profile Analytics - Content Script
 * 
 * This script interacts with LinkedIn pages to find and trigger the "Export" button
 * for downloading analytics data.
 */

// Debug configuration for content script - set to false for production
const CONTENT_DEBUG_MODE = false;

// Enhanced Logger with conditional logging for content script
const ContentLogger = {
  log: (message) => {
    if (CONTENT_DEBUG_MODE) console.log(`[PPA Content] ${message}`);
  },
  error: (message) => {
    // Always log errors, even in production
    console.error(`[PPA Content Error] ${message}`);
  },
  warn: (message) => {
    if (CONTENT_DEBUG_MODE) console.warn(`[PPA Content Warning] ${message}`);
  }
};

/**
 * Finds and clicks the Export button on LinkedIn analytics pages
 * @returns {boolean} True if button was found and clicked, false otherwise
 */
function findAndClickExportButton() {
  ContentLogger.log("Searching for Export button");
  
  const button = Array.from(document.querySelectorAll(".artdeco-button")).find(
    btn => btn.textContent.trim() === "Export"
  );
  
  if (button) {
    ContentLogger.log("Export button found, simulating click");
    const event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    });
    button.dispatchEvent(event);
    return true;
  } else {
    ContentLogger.warn("Export button not found");
    return false;
  }
}

/**
 * Sets up a mutation observer to watch for the Export button to appear in the DOM
 */
function setupButtonObserver() {
  ContentLogger.log("Setting up mutation observer to watch for Export button");
  
  const observer = new MutationObserver(() => {
    if (findAndClickExportButton()) {
      observer.disconnect(); // Stop observing once the button is found and clicked
    }
  });

  observer.observe(document.body, { childList: true, subtree: true });
  
  // Safety timeout to disconnect observer after 2 minutes if button never appears
  setTimeout(() => {
    if (observer) {
      ContentLogger.warn("Observer timeout reached (2 minutes), disconnecting");
      observer.disconnect();
    }
  }, 120000);
}

/**
 * Message handler for communication with background script
 */
function setupMessageListeners() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // Handle download data request
    if (message.action === "downloadData") {
      ContentLogger.log("Received downloadData request");
      const success = findAndClickExportButton();
      sendResponse({ success });
    }
    
    // Handle upload data request
    else if (message.action === "uploadData") {
      ContentLogger.log(`Received uploadData request with email: ${message.email}`);
      
      try {
        const fileInput = document.querySelector('input[type="file"]');
        const emailInput = document.querySelector('input[type="email"]');
        const uploadButton = document.querySelector('button[type="submit"]');

        if (fileInput && emailInput && uploadButton) {
          // Create dummy file for testing purposes
          // In production, this would use the actual downloaded file
          const file = new File(["dummy content"], "linkedin_data.csv", {
            type: "text/csv"
          });
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;

          // Set email value
          emailInput.value = message.email;

          // Submit form
          uploadButton.click();
          sendResponse({ success: true });
        } else {
          throw new Error("Required form elements not found");
        }
      } catch (error) {
        ContentLogger.error(`Upload failed: ${error.message}`);
        sendResponse({ success: false, error: error.message });
      }
    }
    
    // Return true to indicate we'll respond asynchronously
    return true;
  });
}

/**
 * Initialize the content script
 */
function initialize() {
  ContentLogger.log("Content script initialized");
  
  // Try to find and click the button immediately
  if (!findAndClickExportButton()) {
    // If button not found, set up observer to watch for it
    setupButtonObserver();
  }
  
  // Set up message listeners for background script communication
  setupMessageListeners();
}

// Start the script
initialize();

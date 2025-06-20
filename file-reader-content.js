/**
 * Content script for reading downloaded Excel files
 * This script runs in the context of web pages and can access file inputs
 */

// Debug configuration for file reader - set to false for production
const FILE_READER_DEBUG_MODE = false;

// Enhanced Logger with conditional logging for file reader
const FileReaderLogger = {
  log: (message) => {
    if (FILE_READER_DEBUG_MODE) console.log(`[File Reader] ${message}`);
  },
  error: (message) => {
    // Always log errors, even in production
    console.error(`[File Reader Error] ${message}`);
  }
};

// Listen for messages from the background script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'readExcelFile') {
    readExcelFileFromDownload(request.downloadInfo)
      .then(urls => sendResponse({ success: true, urls }))
      .catch(error => sendResponse({ success: false, error: error.message }));
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});

/**
 * Read Excel file from download information
 * @param {Object} downloadInfo - Download information from Chrome downloads API
 * @returns {Promise<string[]>} Array of post URLs
 */
async function readExcelFileFromDownload(downloadInfo) {
  try {
    // Create a hidden file input to trigger file reading
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.xlsx,.xls';
    fileInput.style.display = 'none';
    document.body.appendChild(fileInput);
    
    return new Promise((resolve, reject) => {
      // Since we can't directly access downloaded files in Chrome extensions,
      // we'll need to use an alternative approach
      
      // Option 1: Use fetch with the download URL if available
      if (downloadInfo.url && downloadInfo.url.startsWith('blob:')) {
        fetch(downloadInfo.url)
          .then(response => response.arrayBuffer())
          .then(buffer => {
            const workbook = XLSX.read(buffer, { type: 'array' });
            const urls = extractUrlsFromWorkbook(workbook);
            resolve(urls);
          })
          .catch(reject);
      } else {
        // Option 2: Create a file input and ask user to select the file
        // This is not ideal for automation but may be necessary
        reject(new Error('Cannot automatically read downloaded file. Chrome extension limitations.'));
      }
      
      // Clean up
      setTimeout(() => {
        if (fileInput.parentNode) {
          fileInput.parentNode.removeChild(fileInput);
        }
      }, 1000);
    });
    
  } catch (error) {
    throw new Error(`Failed to read Excel file: ${error.message}`);
  }
}

/**
 * Extract URLs from Excel workbook
 * @param {Object} workbook - XLSX workbook object
 * @returns {string[]} Array of LinkedIn post URLs
 */
function extractUrlsFromWorkbook(workbook) {
  try {
    // Get the 3rd sheet (index 2)
    const sheetNames = workbook.SheetNames;
    if (sheetNames.length < 3) {
      throw new Error('Excel file must have at least 3 sheets');
    }
    
    const thirdSheet = workbook.Sheets[sheetNames[2]];
    const jsonData = XLSX.utils.sheet_to_json(thirdSheet, { header: 1 });
    
    // Extract URLs from first column, starting from row 4 (index 3)
    const urls = [];
    for (let i = 3; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (row && row[0] && typeof row[0] === 'string') {
        const url = row[0].trim();
        if (url && isLinkedInPostUrl(url)) {
          urls.push(url);
        }
      }
    }
    
    FileReaderLogger.log(`Extracted ${urls.length} LinkedIn post URLs from Excel file`);
    return urls;
    
  } catch (error) {
    throw new Error(`Failed to extract URLs from workbook: ${error.message}`);
  }
}

/**
 * Check if URL is a valid LinkedIn post URL
 * @param {string} url - URL to validate
 * @returns {boolean} True if valid LinkedIn post URL
 */
function isLinkedInPostUrl(url) {
  const linkedInPatterns = [
    /linkedin\.com\/posts\//,
    /linkedin\.com\/feed\/update\//,
    /activity[:-]\d{19}/
  ];
  
  return linkedInPatterns.some(pattern => pattern.test(url));
}

/**
 * Excel Processor for Advanced Post Statistics
 * Handles reading Excel files and extracting post URLs for detailed analytics
 */

class ExcelProcessor {
  /**
   * Read Excel file and extract post URLs from the 3rd tab
   * @param {File} file - The Excel file to process
   * @returns {Promise<string[]>} Array of LinkedIn post URLs
   */
  static async extractPostUrls(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = function(e) {
        try {
          // Use SheetJS library to parse Excel file
          const data = new Uint8Array(e.target.result);
          const workbook = XLSX.read(data, { type: 'array' });
          
          // Get the 3rd sheet (index 2)
          const sheetNames = workbook.SheetNames;
          if (sheetNames.length < 3) {
            reject(new Error('Excel file must have at least 3 sheets'));
            return;
          }
          
          const thirdSheet = workbook.Sheets[sheetNames[2]];
          const jsonData = XLSX.utils.sheet_to_json(thirdSheet, { header: 1 });
          
          // Extract URLs from first column, starting from row 4 (index 3)
          const urls = [];
          for (let i = 3; i < jsonData.length; i++) {
            const row = jsonData[i];
            if (row && row[0] && typeof row[0] === 'string') {
              const url = row[0].trim();
              if (url && ExcelProcessor.isLinkedInPostUrl(url)) {
                urls.push(url);
              }
            }
          }
          
          console.log(`Extracted ${urls.length} LinkedIn post URLs from Excel file`);
          resolve(urls);
          
        } catch (error) {
          console.error('Error processing Excel file:', error);
          reject(new Error(`Failed to process Excel file: ${error.message}`));
        }
      };
      
      reader.onerror = function() {
        reject(new Error('Failed to read Excel file'));
      };
      
      reader.readAsArrayBuffer(file);
    });
  }
  
  /**
   * Transform LinkedIn post URL to analytics URL format
   * @param {string} postUrl - Original LinkedIn post URL
   * @returns {string} Analytics URL format
   */
  static transformToAnalyticsUrl(postUrl) {
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
      console.log(`Transformed URL: ${postUrl} -> ${analyticsUrl}`);
      
      return analyticsUrl;
      
    } catch (error) {
      console.error(`Error transforming URL ${postUrl}:`, error);
      throw error;
    }
  }
  
  /**
   * Check if URL is a valid LinkedIn post URL
   * @param {string} url - URL to validate
   * @returns {boolean} True if valid LinkedIn post URL
   */
  static isLinkedInPostUrl(url) {
    const linkedInPatterns = [
      /linkedin\.com\/posts\//,
      /linkedin\.com\/feed\/update\//,
      /activity[:-]\d{19}/
    ];
    
    return linkedInPatterns.some(pattern => pattern.test(url));
  }
  
  /**
   * Validate that all URLs can be transformed to analytics format
   * @param {string[]} urls - Array of URLs to validate
   * @returns {Object} Validation result with valid/invalid URLs
   */
  static validateUrls(urls) {
    const valid = [];
    const invalid = [];
    
    urls.forEach(url => {
      try {
        const analyticsUrl = ExcelProcessor.transformToAnalyticsUrl(url);
        valid.push({ original: url, analytics: analyticsUrl });
      } catch (error) {
        invalid.push({ url, error: error.message });
      }
    });
    
    return { valid, invalid };
  }
}

// Make ExcelProcessor available globally
if (typeof window !== 'undefined') {
  window.ExcelProcessor = ExcelProcessor;
}

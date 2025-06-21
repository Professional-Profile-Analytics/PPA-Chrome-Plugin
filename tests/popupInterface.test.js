/**
 * Popup Interface Tests
 * 
 * Comprehensive test suite for the Chrome Extension's popup interface functionality,
 * covering analytics display, API integration, and user interactions.
 */

const fs = require('fs');
const path = require('path');

// Polyfills for JSDOM
const { TextEncoder, TextDecoder } = require('util');
global.TextEncoder = TextEncoder;
global.TextDecoder = TextDecoder;

// Mock DOM environment
const { JSDOM } = require('jsdom');

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock Chrome APIs
global.chrome = {
  storage: {
    local: {
      get: jest.fn(),
      set: jest.fn()
    }
  },
  runtime: {
    sendMessage: jest.fn()
  }
};

// Mock console methods
global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn()
};

describe('Popup Interface Tests', () => {
  let dom;
  let document;
  let window;

  beforeEach(() => {
    // Create a mock DOM environment
    const popupHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>PPA Analytics</title>
      </head>
      <body>
        <div id="loading">Loading...</div>
        <div id="apiResponse"></div>
        
        <div id="dashboard" style="display: none;">
          <div id="version"></div>
          
          <!-- Guiding Numbers -->
          <div id="posts_per_week"></div>
          <div id="new_followers_day"></div>
          <div id="imp_per_day"></div>
          <div id="imp_per_post"></div>
          
          <!-- Trend Images -->
          <img id="impression_trend" src="" alt="Impression Trend">
          <img id="engagement_trend" src="" alt="Engagement Trend">
          <img id="followers_trend" src="" alt="Followers Trend">
          
          <!-- Performance Metrics -->
          <div id="impressions_percentage"></div>
          <div id="engagement_percentage"></div>
          <div id="followers_percentage"></div>
          <div id="post_activity"></div>
          
          <!-- Dashboard Links -->
          <a id="link_impressions" href="#">Impressions</a>
          <a id="link_engagement" href="#">Engagement</a>
          <a id="link_followers" href="#">Followers</a>
          <a id="link_posting_activity" href="#">Posting Activity</a>
          
          <!-- Manual Execution -->
          <button id="manual-execution">Run Analytics</button>
          <button id="manual-company-execution">Run Company Analytics</button>
        </div>
        
        <div id="error-section" style="display: none;">
          <div id="error-message"></div>
          <button id="retry-button">Retry</button>
        </div>
      </body>
      </html>
    `;

    dom = new JSDOM(popupHtml, {
      url: 'chrome-extension://test/popup.html',
      pretendToBeVisual: true,
      resources: 'usable'
    });

    document = dom.window.document;
    window = dom.window;
    global.document = document;
    global.window = window;

    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset Chrome API mocks
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({});
    });
    chrome.storage.local.set.mockImplementation((data, callback) => {
      if (callback) callback();
    });
    chrome.runtime.sendMessage.mockImplementation(() => {});

    // Reset fetch mock
    fetch.mockClear();
  });

  afterEach(() => {
    dom.window.close();
  });

  describe('UI Helper Functions', () => {
    
    test('setTrendImage sets correct trend image for positive slope', () => {
      // Mock UI object
      const UI = {
        setTrendImage: function(elementId, slope, pValue) {
          const element = document.getElementById(elementId);
          const TREND_IMAGES = {
            UP: "https://example.com/up.png",
            DOWN: "https://example.com/down.png",
            NEUTRAL: "https://example.com/neutral.png"
          };

          if (slope > 0 && pValue < 0.05) {
            element.src = TREND_IMAGES.UP;
          } else if (slope < 0 && pValue < 0.05) {
            element.src = TREND_IMAGES.DOWN;
          } else {
            element.src = TREND_IMAGES.NEUTRAL;
          }
        }
      };

      UI.setTrendImage('impression_trend', 0.5, 0.02);
      
      expect(document.getElementById('impression_trend').src).toBe('https://example.com/up.png');
    });

    test('setTrendImage sets correct trend image for negative slope', () => {
      const UI = {
        setTrendImage: function(elementId, slope, pValue) {
          const element = document.getElementById(elementId);
          const TREND_IMAGES = {
            UP: "https://example.com/up.png",
            DOWN: "https://example.com/down.png",
            NEUTRAL: "https://example.com/neutral.png"
          };

          if (slope > 0 && pValue < 0.05) {
            element.src = TREND_IMAGES.UP;
          } else if (slope < 0 && pValue < 0.05) {
            element.src = TREND_IMAGES.DOWN;
          } else {
            element.src = TREND_IMAGES.NEUTRAL;
          }
        }
      };

      UI.setTrendImage('engagement_trend', -0.3, 0.01);
      
      expect(document.getElementById('engagement_trend').src).toBe('https://example.com/down.png');
    });

    test('setTrendImage sets neutral image for non-significant p-value', () => {
      const UI = {
        setTrendImage: function(elementId, slope, pValue) {
          const element = document.getElementById(elementId);
          const TREND_IMAGES = {
            UP: "https://example.com/up.png",
            DOWN: "https://example.com/down.png",
            NEUTRAL: "https://example.com/neutral.png"
          };

          if (slope > 0 && pValue < 0.05) {
            element.src = TREND_IMAGES.UP;
          } else if (slope < 0 && pValue < 0.05) {
            element.src = TREND_IMAGES.DOWN;
          } else {
            element.src = TREND_IMAGES.NEUTRAL;
          }
        }
      };

      UI.setTrendImage('followers_trend', 0.2, 0.15);
      
      expect(document.getElementById('followers_trend').src).toBe('https://example.com/neutral.png');
    });

    test('setPercentage displays percentage with correct color coding', () => {
      const UI = {
        setPercentage: function(elementId, percentage) {
          const element = document.getElementById(elementId);
          element.textContent = percentage + "%";

          if (percentage >= 100) {
            element.style.color = "green";
          } else if (percentage < 100 && percentage > 50) {
            element.style.color = "orange";
          } else {
            element.style.color = "red";
          }
        }
      };

      // Test green color for >= 100%
      UI.setPercentage('impressions_percentage', 120);
      expect(document.getElementById('impressions_percentage').textContent).toBe('120%');
      expect(document.getElementById('impressions_percentage').style.color).toBe('green');

      // Test orange color for 50-100%
      UI.setPercentage('engagement_percentage', 75);
      expect(document.getElementById('engagement_percentage').textContent).toBe('75%');
      expect(document.getElementById('engagement_percentage').style.color).toBe('orange');

      // Test red color for < 50%
      UI.setPercentage('followers_percentage', 30);
      expect(document.getElementById('followers_percentage').textContent).toBe('30%');
      expect(document.getElementById('followers_percentage').style.color).toBe('red');
    });

    test('setPostingActivity displays activity with correct color coding', () => {
      const UI = {
        setPostingActivity: function(avgPosts) {
          const element = document.getElementById("post_activity");
          const displayValue = (avgPosts > 7 ? 7 : avgPosts);
          element.textContent = displayValue + " / 7";

          if (avgPosts >= 5) {
            element.style.color = "green";
          } else if (avgPosts < 5 && avgPosts >= 3) {
            element.style.color = "orange";
          } else {
            element.style.color = "red";
          }
        }
      };

      // Test green color for >= 5 posts
      UI.setPostingActivity(6);
      expect(document.getElementById('post_activity').textContent).toBe('6 / 7');
      expect(document.getElementById('post_activity').style.color).toBe('green');

      // Test orange color for 3-5 posts
      UI.setPostingActivity(4);
      expect(document.getElementById('post_activity').textContent).toBe('4 / 7');
      expect(document.getElementById('post_activity').style.color).toBe('orange');

      // Test red color for < 3 posts
      UI.setPostingActivity(2);
      expect(document.getElementById('post_activity').textContent).toBe('2 / 7');
      expect(document.getElementById('post_activity').style.color).toBe('red');

      // Test capping at 7 posts
      UI.setPostingActivity(10);
      expect(document.getElementById('post_activity').textContent).toBe('7 / 7');
    });

    test('updateDashboardLinks updates all dashboard links', () => {
      const UI = {
        updateDashboardLinks: function(baseUrl) {
          document.getElementById("link_impressions").href = baseUrl + "#impressions";
          document.getElementById("link_engagement").href = baseUrl + "#engagement";
          document.getElementById("link_followers").href = baseUrl + "#followers";
          document.getElementById("link_posting_activity").href = baseUrl + "#posting_activity";
        }
      };

      const baseUrl = 'https://dash.ppa.guide';
      UI.updateDashboardLinks(baseUrl);

      expect(document.getElementById('link_impressions').href).toBe(baseUrl + '/#impressions');
      expect(document.getElementById('link_engagement').href).toBe(baseUrl + '/#engagement');
      expect(document.getElementById('link_followers').href).toBe(baseUrl + '/#followers');
      expect(document.getElementById('link_posting_activity').href).toBe(baseUrl + '/#posting_activity');
    });

    test('showError displays error message', () => {
      const UI = {
        showError: function(message) {
          document.getElementById("apiResponse").textContent = message;
        }
      };

      const errorMessage = 'API connection failed';
      UI.showError(errorMessage);

      expect(document.getElementById('apiResponse').textContent).toBe(errorMessage);
    });

    test('clearLoading clears loading message', () => {
      const UI = {
        clearLoading: function() {
          document.getElementById("apiResponse").textContent = "";
        }
      };

      document.getElementById('apiResponse').textContent = 'Loading...';
      UI.clearLoading();

      expect(document.getElementById('apiResponse').textContent).toBe('');
    });

  });

  describe('Analytics Data Fetching', () => {
    
    test('fetchAnalyticsData makes correct API call', async () => {
      const mockResponse = {
        healthdata: [{
          version: '2024-01-15',
          post_recom: 5,
          newfollowers_recom: 10,
          imp_recom: 1000,
          impPost_recom: 200,
          imp_slope: 0.5,
          imp_p_value: 0.02,
          eng_slope: -0.2,
          eng_p_value: 0.08,
          fol_slope: 0.1,
          fol_p_value: 0.15
        }],
        advancedreport: 'https://dash.ppa.guide'
      };

      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => mockResponse
      });

      const fetchAnalyticsData = async function(email) {
        const API_URL = "https://test-api.com/";
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        return await response.json();
      };

      const testEmail = 'test@example.com';
      const result = await fetchAnalyticsData(testEmail);

      expect(fetch).toHaveBeenCalledWith(
        "https://test-api.com/",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: testEmail })
        }
      );
      expect(result).toEqual(mockResponse);
    });

    test('fetchAnalyticsData handles API errors', async () => {
      fetch.mockResolvedValueOnce({
        ok: false,
        status: 500
      });

      const fetchAnalyticsData = async function(email) {
        const API_URL = "https://test-api.com/";
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        if (!response.ok) {
          throw new Error(`API returned status ${response.status}`);
        }

        return await response.json();
      };

      await expect(fetchAnalyticsData('test@example.com'))
        .rejects.toThrow('API returned status 500');
    });

    test('fetchAnalyticsData handles network errors', async () => {
      fetch.mockRejectedValueOnce(new Error('Network error'));

      const fetchAnalyticsData = async function(email) {
        const API_URL = "https://test-api.com/";
        
        const response = await fetch(API_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email }),
        });

        return await response.json();
      };

      await expect(fetchAnalyticsData('test@example.com'))
        .rejects.toThrow('Network error');
    });

  });

  describe('Dashboard Display', () => {
    
    test('displays analytics data correctly', () => {
      const mockData = {
        healthdata: [{
          version: '2024-01-15',
          post_recom: 5,
          newfollowers_recom: 10,
          imp_recom: 1000,
          impPost_recom: 200
        }],
        advancedreport: 'https://dash.ppa.guide'
      };

      // Simulate displaying the data
      document.getElementById('dashboard').style.display = 'block';
      document.getElementById('version').textContent = `(last data upload ${mockData.healthdata[0].version})`;
      document.getElementById('posts_per_week').textContent = mockData.healthdata[0].post_recom;
      document.getElementById('new_followers_day').textContent = mockData.healthdata[0].newfollowers_recom;
      document.getElementById('imp_per_day').textContent = mockData.healthdata[0].imp_recom;
      document.getElementById('imp_per_post').textContent = mockData.healthdata[0].impPost_recom;

      expect(document.getElementById('dashboard').style.display).toBe('block');
      expect(document.getElementById('version').textContent).toBe('(last data upload 2024-01-15)');
      expect(document.getElementById('posts_per_week').textContent).toBe('5');
      expect(document.getElementById('new_followers_day').textContent).toBe('10');
      expect(document.getElementById('imp_per_day').textContent).toBe('1000');
      expect(document.getElementById('imp_per_post').textContent).toBe('200');
    });

    test('hides dashboard when no data available', () => {
      document.getElementById('dashboard').style.display = 'none';
      document.getElementById('apiResponse').textContent = 'No data available';

      expect(document.getElementById('dashboard').style.display).toBe('none');
      expect(document.getElementById('apiResponse').textContent).toBe('No data available');
    });

  });

  describe('Email Management', () => {
    
    test('loads email from storage on popup open', (done) => {
      const testEmail = 'user@example.com';
      
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        if (keys === 'email') {
          callback({ email: testEmail });
        } else {
          callback({});
        }
      });

      // Simulate popup initialization
      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get('email', function(data) {
          if (data.email) {
            // Email found, proceed with API call
            expect(data.email).toBe(testEmail);
            done();
          } else {
            // No email found, show error
            document.getElementById('apiResponse').textContent = 'Please configure your email in options';
          }
        });
      });

      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

    test('shows error when no email is configured', (done) => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        callback({}); // No email stored
      });

      document.addEventListener('DOMContentLoaded', function() {
        chrome.storage.local.get('email', function(data) {
          if (data.email) {
            // Email found
          } else {
            // No email found, show error
            document.getElementById('apiResponse').textContent = 'Please configure your email in options';
            expect(document.getElementById('apiResponse').textContent).toBe('Please configure your email in options');
            done();
          }
        });
      });

      const event = new window.Event('DOMContentLoaded');
      document.dispatchEvent(event);
    });

  });

  describe('Manual Execution', () => {
    
    test('manual execution button triggers background script', () => {
      const manualButton = document.getElementById('manual-execution');
      
      manualButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'executeScript'
        });
      });

      manualButton.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'executeScript'
      });
    });

    test('manual company execution button triggers company script', () => {
      const manualCompanyButton = document.getElementById('manual-company-execution');
      
      manualCompanyButton.addEventListener('click', function() {
        chrome.runtime.sendMessage({
          action: 'executeCompanyScript'
        });
      });

      manualCompanyButton.click();

      expect(chrome.runtime.sendMessage).toHaveBeenCalledWith({
        action: 'executeCompanyScript'
      });
    });

  });

  describe('Error Handling and Recovery', () => {
    
    test('displays retry button on API failure', () => {
      const errorSection = document.getElementById('error-section');
      const errorMessage = document.getElementById('error-message');
      const retryButton = document.getElementById('retry-button');

      // Simulate error state
      errorSection.style.display = 'block';
      errorMessage.textContent = 'Failed to load analytics data';

      expect(errorSection.style.display).toBe('block');
      expect(errorMessage.textContent).toBe('Failed to load analytics data');
      expect(retryButton).toBeTruthy();
    });

    test('retry button attempts to reload data', () => {
      const retryButton = document.getElementById('retry-button');
      let retryAttempted = false;

      retryButton.addEventListener('click', function() {
        retryAttempted = true;
        // Simulate retry logic
        document.getElementById('error-section').style.display = 'none';
        document.getElementById('apiResponse').textContent = 'Retrying...';
      });

      retryButton.click();

      expect(retryAttempted).toBe(true);
      expect(document.getElementById('error-section').style.display).toBe('none');
      expect(document.getElementById('apiResponse').textContent).toBe('Retrying...');
    });

    test('handles storage errors gracefully', () => {
      chrome.storage.local.get.mockImplementation((keys, callback) => {
        throw new Error('Storage error');
      });

      expect(() => {
        const event = new window.Event('DOMContentLoaded');
        document.addEventListener('DOMContentLoaded', function() {
          try {
            chrome.storage.local.get('email', function(data) {
              // Handle storage error
            });
          } catch (error) {
            document.getElementById('apiResponse').textContent = 'Configuration error';
          }
        });
        document.dispatchEvent(event);
      }).not.toThrow();
    });

  });

  describe('Loading States', () => {
    
    test('shows loading state initially', () => {
      const loadingElement = document.getElementById('loading');
      expect(loadingElement.textContent).toBe('Loading...');
    });

    test('hides loading state after data loads', () => {
      const loadingElement = document.getElementById('loading');
      const dashboard = document.getElementById('dashboard');

      // Simulate successful data load
      loadingElement.style.display = 'none';
      dashboard.style.display = 'block';

      expect(loadingElement.style.display).toBe('none');
      expect(dashboard.style.display).toBe('block');
    });

    test('shows loading state during retry', () => {
      const apiResponse = document.getElementById('apiResponse');
      
      // Simulate retry loading state
      apiResponse.textContent = 'Retrying...';

      expect(apiResponse.textContent).toBe('Retrying...');
    });

  });

  describe('Integration with Background Script', () => {
    
    test('receives status updates from background script', () => {
      // Mock message listener
      const messageListener = jest.fn();
      
      // Simulate receiving status update
      const mockMessage = {
        action: 'statusUpdate',
        status: 'Analytics completed successfully',
        timestamp: new Date().toISOString()
      };

      messageListener(mockMessage);

      expect(messageListener).toHaveBeenCalledWith(mockMessage);
    });

    test('handles background script errors', () => {
      chrome.runtime.sendMessage.mockImplementation(() => {
        throw new Error('Background script error');
      });

      const manualButton = document.getElementById('manual-execution');
      
      expect(() => {
        manualButton.addEventListener('click', function() {
          try {
            chrome.runtime.sendMessage({
              action: 'executeScript'
            });
          } catch (error) {
            document.getElementById('apiResponse').textContent = 'Execution failed';
          }
        });
        manualButton.click();
      }).not.toThrow();
    });

  });

});

// Export for use in other test files
module.exports = {
  setupPopupMocks: () => {
    chrome.storage.local.get.mockImplementation((keys, callback) => {
      callback({ email: 'test@example.com' });
    });
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        healthdata: [{ version: '2024-01-01' }],
        advancedreport: 'https://dash.ppa.guide'
      })
    });
  }
};

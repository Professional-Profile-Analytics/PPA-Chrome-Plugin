/**
 * Professional Profile Analytics - Popup Script
 *
 * This script handles the popup UI functionality, fetching and displaying
 * LinkedIn analytics data from the PPA service.
 */

// API endpoint for fetching analytics data
const API_URL = "https://bzgaehjpqf45zsi4t32zuf6g7m0nrctb.lambda-url.us-east-1.on.aws/";
const DASHBOARD_URL = "https://dash.ppa.guide";

// Trend image URLs
const TREND_IMAGES = {
  UP: "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b849264c9295eed70ca.png",
  DOWN: "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/674f7b84251b397cd5eea9cb.png",
  NEUTRAL: "https://storage.googleapis.com/msgsndr/PdMChW3b3rqeve2L755O/media/67805cbdc845015f8a12761e.png"
};

/**
 * Helper functions for UI updates
 */
const UI = {
  /**
   * Set the trend image based on slope and p-value
   * @param {string} elementId - ID of the image element
   * @param {number} slope - Trend slope
   * @param {number} pValue - Statistical p-value
   */
  setTrendImage: function(elementId, slope, pValue) {
    const element = document.getElementById(elementId);

    if (slope > 0 && pValue < 0.05) {
      element.src = TREND_IMAGES.UP;
    } else if (slope < 0 && pValue < 0.05) {
      element.src = TREND_IMAGES.DOWN;
    } else {
      element.src = TREND_IMAGES.NEUTRAL;
    }
  },

  /**
   * Set percentage value with color coding
   * @param {string} elementId - ID of the element
   * @param {number} percentage - Percentage value
   */
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
  },

  /**
   * Set posting activity with color coding
   * @param {number} avgPosts - Average posts per week
   */
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
  },

  /**
   * Update dashboard links
   * @param {string} baseUrl - Base URL for the dashboard
   */
  updateDashboardLinks: function(baseUrl) {
    document.getElementById("link_impressions").href = baseUrl + "#impressions";
    document.getElementById("link_engagement").href = baseUrl + "#engagement";
    document.getElementById("link_followers").href = baseUrl + "#followers";
    document.getElementById("link_posting_activity").href = baseUrl + "#posting_activity";
  },

  /**
   * Show error message
   * @param {string} message - Error message to display
   */
  showError: function(message) {
    document.getElementById("apiResponse").textContent = message;
  },

  /**
   * Clear loading message
   */
  clearLoading: function() {
    document.getElementById("apiResponse").textContent = "";
  }
};

/**
 * Fetch and display analytics data
 * @param {string} email - User's email address
 */
async function fetchAnalyticsData(email) {
  try {
    // Call the API with the stored email
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

    const result = await response.json();

    // Clear loading message
    UI.clearLoading();

    // Show dashboard
    document.getElementById("dashboard").style.display = "block";

    // Update version info
    document.getElementById("version").textContent =
      "(last data upload " + result.healthdata[0].version + ")";

    // Update guiding numbers
    document.getElementById("posts_per_week").textContent = result.healthdata[0].post_recom;
    document.getElementById("new_followers_day").textContent = result.healthdata[0].newfollowers_recom;
    document.getElementById("imp_per_day").textContent = result.healthdata[0].imp_recom;
    document.getElementById("imp_per_post").textContent = result.healthdata[0].impPost_recom;

    // Update dashboard links
    UI.updateDashboardLinks(result.advancedreport);

    // Update trend images
    UI.setTrendImage("impression_trend",
      result.healthdata[0].imp_slope,
      result.healthdata[0].imp_p_value);

    UI.setTrendImage("engagement_trend",
      result.healthdata[0].eng_slope,
      result.healthdata[0].eng_p_value);

    UI.setTrendImage("follower_trend",
      result.healthdata[0].foll_slope,
      result.healthdata[0].foll_p_value);

    UI.setTrendImage("post_activity_trend",
      result.healthdata[0].activity_slope,
      result.healthdata[0].activity_p_value);

    // Update health dashboard benchmarks
    //UI.setPostingActivity(result.healthdata[0].avgposts);
    //UI.setPercentage("impressions", result.healthdata[0].imp_percentage);
    //UI.setPercentage("engagement", result.healthdata[0].eng_percentage);
    //UI.setPercentage("new_followers", result.healthdata[0].foll_percentage);

  } catch (error) {
    console.error("Error fetching analytics data:", error);
    UI.showError("An error occurred while fetching data. Please try again later.");
  }
}

/**
 * Initialize the popup
 */
function initializePopup() {
  const errorMessage = document.getElementById("error-message");
  const settingsButton = document.getElementById("settings");
  const dashboardButton = document.getElementById("go-to-dashboard");

  // Check if email is configured
  chrome.storage.local.get("email", function(data) {
    if (data.email) {
      // Email is configured, fetch analytics data
      fetchAnalyticsData(data.email);
    } else {
      // No email configured, show error
      errorMessage.style.display = "block";
      UI.clearLoading();
    }
  });

  // Set up settings button
  settingsButton.addEventListener("click", function() {
    chrome.runtime.openOptionsPage();
  });

  // Set up dashboard button
  dashboardButton.addEventListener("click", function() {
    chrome.tabs.create({ url: DASHBOARD_URL });
  });
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", initializePopup);

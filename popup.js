

document.addEventListener("DOMContentLoaded", function () {
  const reportLink = document.getElementById("report-link");
  const dasbboard = document.getElementById("dashboard");
  const errorMessage = document.getElementById("error-message");
  const settingsButton = document.getElementById("settings");

  // Check if the email is stored in local storage
  chrome.storage.local.get("email", function (data) {
    if (data.email) {
      // If email is configured, show the report link
      reportLink.style.display = "block";
      dashboard.style.display = "block"
    } else {
      // If no email is found, show the error message
      errorMessage.style.display = "block";
    }
  });

  // Open the plugin options/settings page
  settingsButton.addEventListener("click", function () {
    chrome.runtime.openOptionsPage();
  });
});

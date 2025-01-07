document.addEventListener("DOMContentLoaded", () => {

  // Open the settings page when the "Open Settings" button is clicked
  document.getElementById("settings").addEventListener("click", () => {
    chrome.runtime.openOptionsPage();
  });
});

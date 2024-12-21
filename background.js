// Create or update the alarm based on the selected frequency
// Create or update the alarm based on the selected frequency
function updateAlarm(frequencyInDays) {
    // If testing, use minutes directly; otherwise, convert days to minutes
    const periodInMinutes = frequencyInDays === 2 ? 2 : frequencyInDays * 24 * 60;
    chrome.alarms.create("configurableDownload", { periodInMinutes });
    console.log(`Alarm updated to trigger every ${frequencyInDays === 2 ? 2 : frequencyInDays} ${frequencyInDays === 2 ? "minutes (testing)" : "days"}.`);
}

// Set a default alarm on installation or update
chrome.runtime.onInstalled.addListener(() => {
    chrome.storage.sync.get(["downloadFrequency"], (result) => {
        const frequency = result.downloadFrequency || 7; // Default to 7 days
        updateAlarm(frequency);
    });
});

// Listen for updates to the alarm
chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "updateAlarm") {
        updateAlarm(message.frequency);
    }
});

// Listen for the alarm to trigger the download
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "configurableDownload") {
        openHiddenTabAndDownload();
    }
});

// Function to open a hidden tab and interact with it
function openHiddenTabAndDownload() {
    chrome.tabs.create({ url: "https://www.linkedin.com/analytics/creator/content/?metricType=IMPRESSIONS&timeRange=past_7_days", active: false }, (tab) => {
        chrome.scripting.executeScript({
            target: { tabId: tab.id },
            files: ["content.js"],
        });

        // Close the tab after the download is triggered
        setTimeout(() => {
            chrome.tabs.remove(tab.id);
        }, 5000); // Adjust based on how long it takes to trigger the download
    });
}

document.addEventListener("DOMContentLoaded", () => {
    // Load saved settings from storage
    chrome.storage.sync.get(["downloadFrequency", "emailAddress"], (result) => {
        const frequency = result.downloadFrequency || 7; // Default to 7 days
        const email = result.emailAddress || ""; // Default to empty

        document.getElementById("frequency").value = frequency;
        document.getElementById("email").value = email;
    });

    // Save settings when the user clicks "Save"
    document.getElementById("save").addEventListener("click", () => {
        const frequency = parseInt(document.getElementById("frequency").value);
        const email = document.getElementById("email").value.trim();

        // Save the frequency and email address to storage
        chrome.storage.sync.set({ downloadFrequency: frequency, emailAddress: email }, () => {
            console.log(`Download frequency set to ${frequency === 2 ? "2 minutes (testing)" : `${frequency} days`}`);
            console.log(`Email address saved as: ${email}`);
            chrome.runtime.sendMessage({ action: "updateAlarm", frequency });
            alert("Settings updated!");
        });
    });
});

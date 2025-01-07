//  interacts directly with the DOM to press the button and start the download.
console.log("Content script loaded");

// Function to find and click the button
function downloadFile() {
    const button = Array.from(document.querySelectorAll(".artdeco-button")).find(
      btn => btn.textContent.trim() === "Export"
    );
    if (button) {
        console.log("Button found, simulating click.");
        const event = new MouseEvent("click", {
            bubbles: true,
            cancelable: true,
            view: window,
        });
        button.dispatchEvent(event);
    } else {
        console.error("Button not found. Page might not be ready.");
    }
}

// Execute immediately or add fallback
const button = Array.from(document.querySelectorAll(".artdeco-button")).find(
  btn => btn.textContent.trim() === "Export"
);
if (button) {
    console.log("Button found immediately.");
    downloadFile();
} else {
    console.log("Setting up fallback to wait for the button.");

    const observer = new MutationObserver(() => {
        const button = Array.from(document.querySelectorAll(".artdeco-button")).find(
          btn => btn.textContent.trim() === "Export"
        );
        if (button) {
            console.log("Button found via MutationObserver.");
            downloadFile();
            observer.disconnect(); // Stop observing once the button is found
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}



chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "uploadFile") {
        const filePath = message.filePath;
        console.log(`Attempting to upload file from path: ${filePath}`);

        // Retrieve the email address from storage
        chrome.storage.sync.get("emailAddress", (result) => {
            const email = result.emailAddress || "example@example.com";  // Use default if email is not found
            console.log(`Using email address: ${email}`);

            // Here we simulate the file upload
            // Let's assume the form selectors are as follows:
            const fileInput = document.querySelector("input[name='xlsx']");  // Update with the actual file input selector
            const uploadButton = document.querySelector("button[type='submit']");  // Update with the actual upload button selector
            const emailInput = document.querySelector("input[name='email']");

            // Locate form elements on the page
            //const fileInput = document.querySelector(fileInputSelector);
            //const emailInput = document.querySelector(emailInputSelector);
            //const uploadButton = document.querySelector(uploadButtonSelector);

            if (!fileInput || !emailInput || !uploadButton) {
                console.error("Form elements not found!");
                return;
            }

            // Add the downloaded file to the file input
            const file = new File([new Blob([filePath])], "downloaded-file.txt", { type: "application/octet-stream" });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            fileInput.files = dataTransfer.files;
            console.log("File added to file input.");

            // Add the email address to the email input field
            emailInput.value = email;
            console.log("Email added to the form.");

            // Trigger the form submission
            uploadButton.click();
            console.log("Form submitted.");
        });
    }
});




chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "downloadData") {
    console.log("Downloading LinkedIn data...");
    const downloadButton = document.querySelector('button[data-test-icon="download-small"]');
    if (downloadButton) {
      downloadButton.click();
      sendResponse({ success: true });
    } else {
      console.error("Download button not found.");
      sendResponse({ success: false });
    }
  }

  if (message.action === "uploadData") {
    const email = message.email;
    console.log("Uploading to PPA with email:", email);

    const fileInput = document.querySelector('input[type="file"]');
    const emailInput = document.querySelector('input[type="email"]');
    const uploadButton = document.querySelector('button[type="submit"]');

    if (fileInput && emailInput && uploadButton) {
      const file = new File(["dummy content"], "linkedin_data.csv", {
        type: "text/csv"
      });
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(file);
      fileInput.files = dataTransfer.files;

      emailInput.value = email;

      uploadButton.click();
      sendResponse({ success: true });
    } else {
      console.error("Form elements not found.");
      sendResponse({ success: false });
    }
  }
});

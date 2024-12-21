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

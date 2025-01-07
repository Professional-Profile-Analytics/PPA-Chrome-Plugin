document.addEventListener("DOMContentLoaded", function () {
  // Get the email from storage and set it in the input field if it's available
  chrome.storage.local.get("email", function (data) {
    if (data.email) {
      document.getElementById("email").value = data.email;  // Set the stored email to the input field
    }
  });

  // Save the email when the user clicks the "Save Email" button
  document.getElementById("save-email").addEventListener("click", function () {
    const email = document.getElementById("email").value;
    if (email) {
      // Save the email to chrome storage
      chrome.storage.local.set({ email: email }, function () {
        alert("Email saved!");
      });
    } else {
      alert("Please enter a valid email address.");
    }
  });

});



// 
document.getElementById('run-script').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'executeScript' });
});


document.addEventListener("DOMContentLoaded", () => {
    const nextExecutionElement = document.getElementById("nextExecution");

    // Retrieve the next execution time from storage
    chrome.storage.local.get("nextExecution", (data) => {
        if (data.nextExecution) {
            const nextExecution = new Date(data.nextExecution);
            nextExecutionElement.textContent = `The next execution is scheduled for: ${nextExecution.toLocaleString()}`;
        } else {
            nextExecutionElement.textContent = "No execution scheduled yet.";
        }
    });
});

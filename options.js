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


  chrome.storage.local.get(['uploadFrequency'], function(result) {
     if (result.uploadFrequency) {
       document.getElementById('uploadFrequency').value = result.uploadFrequency;
     }
   });

   // Save frequency setting
   document.getElementById('saveFrequency').addEventListener('click', function() {
     const frequency = document.getElementById('uploadFrequency').value;

     chrome.storage.local.set({ uploadFrequency: frequency }, function() {
       // Update the interval in milliseconds based on selection
       let interval;
       switch(frequency) {
         case 'daily':
           interval = 24 * 60 * 60 * 1000; // 1 day
           break;
         default:
           interval = 3 * 24 * 60 * 60 * 1000; // 3 days (default)
       }

       // Send message to background script to update interval
       chrome.runtime.sendMessage({
         action: 'updateInterval',
         interval: interval
       });

       // Show status message
       const statusElement = document.getElementById('frequencyStatus');
       statusElement.textContent = 'Frequency saved!';
       statusElement.style.color = 'green';

       // Clear status message after 3 seconds
       setTimeout(() => {
         statusElement.textContent = '';
       }, 3000);
     });
   });

});



//
document.getElementById('run-script').addEventListener('click', () => {
  chrome.runtime.sendMessage({ action: 'executeScript' });
});


///////
// get next and last execution information
//////
document.addEventListener("DOMContentLoaded", () => {
    const nextExecutionElement = document.getElementById("nextExecution");
    const lastExecutionElement = document.getElementById("lastExecution");

    chrome.storage.local.get(["nextExecution", "lastExecutionTime", "lastExecutionStatus", "lastExecutionError"], (data) => {
    // Show next execution time
    if (data.nextExecution) {
        const nextExecution = new Date(data.nextExecution);
        nextExecutionElement.textContent = `The next execution is scheduled for: ${nextExecution.toLocaleString()}`;
    } else {
        nextExecutionElement.textContent = "No execution scheduled yet.";
    }

    // Show last execution time and status
    if (data.lastExecutionTime) {
        const lastExecutionTime = new Date(data.lastExecutionTime);
        let statusMessage = `Last execution: ${lastExecutionTime.toLocaleString()} <br>Status: ${data.lastExecutionStatus}`;

        if (data.lastExecutionError) {
            try {
                const errorDetails = JSON.parse(data.lastExecutionError);
                statusMessage += `<br>Error Name: ${errorDetails.name}`;
                statusMessage += `<br>Error Message: ${errorDetails.message}`;

                // Add context details if available
                if (errorDetails.context && Object.keys(errorDetails.context).length > 0) {
                    statusMessage += `<br>Error Context: ${JSON.stringify(errorDetails.context, null, 2)}`;
                }
            } catch (parseError) {
                // Fallback if JSON parsing fails
                statusMessage += `<br>Error: ${data.lastExecutionError}`;
            }
        }

        lastExecutionElement.innerHTML = statusMessage;
    } else {
        lastExecutionElement.textContent = "No execution has run yet.";
    }
});
});




/////
// alarm checker
/////
document.addEventListener("DOMContentLoaded", () => {
    chrome.storage.local.get("alarmsEnabled", (data) => {
        let message = data.alarmsEnabled
            ? "✅ Chrome Alarms and Scheduling are enabled!"
            : "⚠️ Warning: Chrome Alarms and Scheduling are disabled. Automated data upload will not not work.";

        document.getElementById("alarmStatus").innerText = message;
        document.getElementById("alarmStatus").style.color = data.alarmsEnabled ? "green" : "red";
    });
});

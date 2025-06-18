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
        showStatusMessage("emailStatus", "Email saved successfully!", "success");
      });
    } else {
      showStatusMessage("emailStatus", "Please enter a valid email address.", "error");
    }
  });

  // Get the company ID from storage and set it in the input field if it's available
  chrome.storage.local.get("companyId", function (data) {
    if (data.companyId) {
      document.getElementById("companyId").value = data.companyId;
    }
  });

  // Save the company ID when the user clicks the "Save Company ID" button
  document.getElementById("save-company-id").addEventListener("click", function () {
    const companyId = document.getElementById("companyId").value.trim();
    
    // Validate company ID (should be numeric)
    if (companyId && /^\d+$/.test(companyId)) {
      // Save the company ID to chrome storage
      chrome.storage.local.set({ companyId: companyId }, function () {
        showStatusMessage("companyIdStatus", "Company ID saved successfully!", "success");
        // Update company execution displays
        updateCompanyExecutionDisplays();
      });
    } else if (companyId === "") {
      // Allow clearing the company ID
      chrome.storage.local.remove("companyId", function () {
        showStatusMessage("companyIdStatus", "Company ID cleared.", "success");
        updateCompanyExecutionDisplays();
      });
    } else {
      showStatusMessage("companyIdStatus", "Please enter a valid numeric Company ID.", "error");
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

       // Calculate and display the next execution time
       updateNextExecutionDisplay(interval);

       // Show status message
       showStatusMessage("frequencyStatus", "Frequency saved successfully!", "success");
     });
   });

});

// Function to show status messages with proper styling
function showStatusMessage(elementId, message, type) {
  const statusElement = document.getElementById(elementId);
  statusElement.textContent = message;
  statusElement.className = `status-message ${type}`;
  statusElement.style.display = 'block';

  // Clear status message after 5 seconds
  setTimeout(() => {
    statusElement.textContent = '';
    statusElement.style.display = 'none';
  }, 5000);
}

// Function to update the next execution display
function updateNextExecutionDisplay(interval) {
  const nextExecutionElement = document.getElementById("nextExecution");

  // Get the current time
  const now = new Date();

  // Calculate the next execution time based on the new interval
  const nextExecution = new Date(now.getTime() + interval);

  // Update the storage with the new next execution time
  chrome.storage.local.set({ nextExecution: nextExecution.getTime() });

  // Update the display
  nextExecutionElement.textContent = `The next execution is scheduled for: ${nextExecution.toLocaleString()}`;
}

//
document.getElementById('run-script').addEventListener('click', () => {
  // Set alarmsEnabled to true when manually running the script
  chrome.storage.local.set({ alarmsEnabled: true }, () => {
    console.log("alarmsEnabled flag set to true when manually running script");
  });
  
  chrome.runtime.sendMessage({ action: 'executeScript' });
});

// Manual company script execution
document.getElementById('run-company-script').addEventListener('click', () => {
  // Check if company ID is configured
  chrome.storage.local.get("companyId", function (data) {
    if (!data.companyId) {
      showStatusMessage("companyIdStatus", "Please configure Company ID first before running company analytics.", "error");
      return;
    }
    
    // Set alarmsEnabled to true when manually running the script
    chrome.storage.local.set({ alarmsEnabled: true }, () => {
      console.log("alarmsEnabled flag set to true when manually running company script");
    });
    
    // TODO: Send message to background script to execute company analytics
    chrome.runtime.sendMessage({ 
      action: 'executeCompanyScript',
      companyId: data.companyId 
    });
    
    // Show feedback to user
    showStatusMessage("companyIdStatus", "Company analytics download initiated...", "success");
  });
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

    // Load and display company execution information
    updateCompanyExecutionDisplays();
});

// Function to update company execution displays
function updateCompanyExecutionDisplays() {
    const nextCompanyExecutionElement = document.getElementById("nextCompanyExecution");
    const lastCompanyExecutionElement = document.getElementById("lastCompanyExecution");

    chrome.storage.local.get([
        "companyId", 
        "nextCompanyExecution", 
        "lastCompanyExecutionTime", 
        "lastCompanyExecutionStatus", 
        "lastCompanyExecutionError"
    ], (data) => {
        if (!data.companyId) {
            nextCompanyExecutionElement.textContent = "Company ID not configured. Company uploads disabled.";
            lastCompanyExecutionElement.textContent = "Configure Company ID to enable company analytics.";
            return;
        }

        // Show next company execution time
        if (data.nextCompanyExecution) {
            const nextExecution = new Date(data.nextCompanyExecution);
            nextCompanyExecutionElement.textContent = `Next company upload: ${nextExecution.toLocaleString()}`;
        } else {
            // Calculate next execution (weekly from now)
            const nextWeek = new Date();
            nextWeek.setDate(nextWeek.getDate() + 7);
            nextCompanyExecutionElement.textContent = `Next company upload: ${nextWeek.toLocaleString()} (estimated)`;
        }

        // Show last company execution time and status
        if (data.lastCompanyExecutionTime) {
            const lastExecutionTime = new Date(data.lastCompanyExecutionTime);
            let statusMessage = `Last company upload: ${lastExecutionTime.toLocaleString()} - Status: ${data.lastCompanyExecutionStatus || 'Unknown'}`;

            if (data.lastCompanyExecutionError) {
                try {
                    const errorDetails = JSON.parse(data.lastCompanyExecutionError);
                    statusMessage += `<br>Error: ${errorDetails.message}`;
                } catch (parseError) {
                    statusMessage += `<br>Error: ${data.lastCompanyExecutionError}`;
                }
            }

            lastCompanyExecutionElement.innerHTML = statusMessage;
        } else {
            lastCompanyExecutionElement.textContent = "No company upload has run yet.";
        }
    });
}




/////
// alarm checker
/////
document.addEventListener("DOMContentLoaded", () => {
    // Force set alarmsEnabled to true when options page is opened
    chrome.storage.local.set({ alarmsEnabled: true }, () => {
        console.log("alarmsEnabled flag set to true from options page");
    });
    
    chrome.storage.local.get("alarmsEnabled", (data) => {
        let message = data.alarmsEnabled
            ? "✅ Chrome Alarms and Scheduling are enabled!"
            : "⚠️ Warning: Chrome Alarms and Scheduling are disabled. Automated data upload will not not work.";

        document.getElementById("alarmStatus").innerText = message;
        document.getElementById("alarmStatus").style.color = data.alarmsEnabled ? "green" : "red";
    });
});

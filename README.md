# Professional Profile Analytics - Chrome Plugin

A Chrome extension that automates the download and upload of LinkedIn analytics data to the Professional Profile Analytics service, and provides integration with Shiny web applications for LinkedIn post creation.

## 🧪 Test Coverage Overview

This extension has comprehensive test coverage with **154 automated tests** across 5 test suites:

### **📊 Test Suite Summary**
| Test Suite | Tests | Coverage |
|------------|-------|----------|
| **ConfigManager** | 24 | Configuration management, storage operations |
| **Advanced Post Analytics** | 20 | Posts limit slider, URL processing, success messages |
| **Download Tracking** | 25 | WebRequest API, LinkedIn URL capture, promise management |
| **Language Detection** | 43 | Multi-language support (EN/DE/ES/FR), UI element detection |
| **File Upload Integration** | 42 | API endpoints, base64 encoding, error handling |
| **Total** | **154** | **Complete feature coverage** |

### **🚀 Running Tests**
```bash
cd tests
npm test                    # Run all 154 tests
node run-tests.js config    # ConfigManager tests only
node run-tests.js analytics # Advanced Analytics tests only
node run-tests.js download  # Download Tracking tests only
node run-tests.js language  # Language Detection tests only
node run-tests.js upload    # File Upload tests only
```

### **✅ Quality Assurance**
- **Automated CI/CD** - GitHub Actions run all tests on every push
- **100% Feature Coverage** - All major functionality tested
- **Error Handling** - Comprehensive edge case and error scenario testing
- **Performance Testing** - Memory management and efficiency validation
- **Cross-Language Testing** - Multi-language LinkedIn interface support

## Features

- Automatically downloads LinkedIn analytics data
- Uploads data to the Professional Profile Analytics service
- Configurable execution frequency
- Multi-language support for LinkedIn interfaces
- Retry mechanism for failed executions
- Logging and error tracking
- Shiny app integration for LinkedIn post creation with human-like typing

## Multi-language Support

The extension supports multiple languages for LinkedIn interfaces:

- English (default)
- German
- Spanish
- French

The language detection is automatic, based on the LinkedIn interface language. The extension will try to find UI elements in the appropriate language.

## Implementation Details

### Analytics Collection

The extension automatically:
1. Opens LinkedIn in a background tab
2. Navigates to the analytics section
3. Downloads the analytics data
4. Uploads it to the Professional Profile Analytics service
5. Closes the tab when complete

### Human-like Typing

For the Shiny integration, the extension simulates human typing by:
1. Varying the typing speed between keystrokes
2. Adding natural pauses after punctuation marks
3. Adding longer pauses between paragraphs
4. Occasionally adding "thinking pauses" to make typing appear more natural

### Multi-language Support

The multi-language support is implemented through:
1. A language dictionary that contains translations for UI elements
2. Automatic language detection based on HTML attributes and URL patterns
3. Enhanced tab interactions that try all possible translations when looking for UI elements

## Adding New Languages

To add support for a new language:

1. Locate the `LANGUAGE_DICTIONARY` object in the background.js file
2. Add a new entry with the language code as the key
3. Add translations for all the UI element texts

Example:
```javascript
// Italian translations
it: {
  postImpressions: 'Impressioni del post',
  past7Days: 'Ultimi 7 giorni',
  past28Days: 'Ultimi 28 giorni',
  showResults: 'Mostra risultati',
  export: 'Esporta'
}
```

## Shiny Integration

The extension supports integration with Shiny web applications, allowing you to:

1. Open LinkedIn from your Shiny app
2. Create posts with human-like typing simulation
3. Receive feedback on the operation's success

### Using the Shiny Integration

In your Shiny app, you can use the following JavaScript to communicate with the extension:

```javascript
// Function to send a message to the Chrome extension
function sendToExtension(text, callback) {
  // Extension ID - replace with your actual extension ID after publishing
  const extensionId = "YOUR_EXTENSION_ID";
  
  // Message to send
  const message = {
    action: "openTabAndType",
    url: "https://www.linkedin.com/feed/",
    text: text,
    delay: 100,  // Base typing delay in ms (will vary to simulate human typing)
    autoSubmit: false  // Set to true to automatically submit the post
  };
  
  // Send message to extension
  chrome.runtime.sendMessage(extensionId, message, function(response) {
    if (chrome.runtime.lastError) {
      console.log("Connection error:", chrome.runtime.lastError.message);
      if (callback) {
        callback({
          success: false,
          message: "Extension connection error: " + chrome.runtime.lastError.message
        });
      }
      return;
    }
    
    if (callback) {
      callback(response);
    }
  });
}

// Example usage in Shiny
Shiny.addCustomMessageHandler("sendToLinkedIn", function(message) {
  sendToExtension(message.text, function(response) {
    // Send response back to Shiny
    Shiny.setInputValue("linkedInResponse", response);
  });
});
```

In your R Shiny code:

```r
# UI
actionButton("postButton", "Post to LinkedIn")
textAreaInput("postText", "Post Content", rows = 5)

# Server
observeEvent(input$postButton, {
  # Send message to JavaScript
  session$sendCustomMessage("sendToLinkedIn", list(
    text = input$postText
  ))
})

# Handle response from extension
observeEvent(input$linkedInResponse, {
  if (input$linkedInResponse$success) {
    showNotification("Post created successfully!", type = "success")
  } else {
    showNotification(paste("Error:", input$linkedInResponse$message), type = "error")
  }
})
```

### Troubleshooting Shiny Integration

If you encounter connection errors:

1. Make sure you're using the correct extension ID
2. Verify that the extension is installed and enabled
3. Check that your Shiny app's domain is included in the `externally_connectable` section of the extension's manifest
4. For local testing, include both `http://127.0.0.1:*/*` and `http://localhost:*/*` in the manifest

## Usage

1. Install the extension
2. Configure your email in the options page
3. The extension will automatically run according to the configured schedule
4. You can also trigger a manual execution from the popup menu
5. For Shiny integration, follow the instructions in the Shiny Integration section

## Version History

- 1.7.3: Major refactor to API-based URL extraction with enhanced individual post analytics processing, improved Chrome download blocking prevention, and comprehensive error handling
- 1.7.2: Implemented advanced post statistics backend with Excel processing, individual post analytics extraction, and automated upload to Lambda endpoint
- 1.7.1: Redesigned options page with Bootstrap 5, added advanced post statistics toggle, improved UI/UX with modern card layout and consistent color scheme
- 1.7.0: Added company page analytics automation with weekly scheduling
- 1.6.0: Added Shiny integration with human-like typing simulation
- 1.5.1: Improved retry mechanism and error handling
- 1.5.0: Added multi-language support
- 1.4.0: Added configurable execution frequency
- 1.3.0: Added retry mechanism for failed executions
- 1.2.0: Added logging and error tracking
- 1.1.0: Added upload to Professional Profile Analytics service
- 1.0.0: Initial release with LinkedIn analytics download

/**
 * LinkedIn Post Helper - Human-like Typing Simulation
 * 
 * This script handles the specific workflow for creating LinkedIn posts with human-like typing:
 * 1. Click the "Start a post" button
 * 2. Wait for the post editor to appear
 * 3. Type text into the editor character by character with variable timing
 */

// Debug configuration for typing helper - set to false for production
const TYPING_HELPER_DEBUG_MODE = false;

// Debug logging function for typing helper
function debugLog(message, data = null) {
  if (TYPING_HELPER_DEBUG_MODE) {
    const timestamp = new Date().toISOString();
    console.log(`[PPA-DEBUG ${timestamp}] ${message}`);
    if (data) {
      console.log('[PPA-DEBUG DATA]', data);
    }
  }
}
  }
}

// Function to find and click the "Start a post" button
function clickStartPostButton() {
  return new Promise((resolve, reject) => {
    debugLog('Starting clickStartPostButton function');
    
    // Log the current URL to verify we're on the right page
    debugLog('Current URL:', window.location.href);
    
    // Try different selectors for the "Start a post" button
    const possibleSelectors = [
      'button[aria-label="Start a post"]',
      'button[aria-label="Beitrag erstellen"]', // German
      'button[aria-label="Crear una publicación"]', // Spanish
      'button[aria-label="Commencer un post"]' // French
    ];
    
    // Try to find the button
    let button = null;
    for (const selector of possibleSelectors) {
      try {
        const elements = document.querySelectorAll(selector);
        for (const el of elements) {
          button = el;
          debugLog('Found button with selector:', selector);
          break;
        }
        if (button) break;
      } catch (e) {
        debugLog(`Error with selector ${selector}:`, e.message);
      }
    }
    
    // If we can't find the button with selectors, try a text content search
    if (!button) {
      debugLog('No button found with selectors, trying text content search');
      
      // Look for any element that might be the start post button
      const allButtons = document.querySelectorAll('button');
      debugLog(`Found ${allButtons.length} button elements`);
      
      for (const el of allButtons) {
        const text = el.textContent.trim().toLowerCase();
        if (text.includes('start a post') || 
            text.includes('beitrag erstellen') ||
            text.includes('crear una publicación') ||
            text.includes('commencer un post')) {
          button = el;
          debugLog('Found button by text content:', el.outerHTML);
          break;
        }
      }
    }
    
    if (!button) {
      const error = "Could not find 'Start a post' button";
      debugLog(error);
      reject(new Error(error));
      return;
    }
    
    // Click the button
    debugLog("Found 'Start a post' button, clicking it");
    button.click();
    
    // Wait for the post editor to appear
    let attempts = 0;
    const maxAttempts = 20;
    debugLog(`Waiting for editor to appear, will check ${maxAttempts} times`);
    
    const checkInterval = setInterval(() => {
      attempts++;
      debugLog(`Looking for editor (attempt ${attempts}/${maxAttempts})`);
      
      // Look for the editor
      const editor = document.querySelector('.ql-editor[contenteditable="true"]');
      if (editor) {
        clearInterval(checkInterval);
        debugLog("Post editor found:", editor.outerHTML);
        resolve(editor);
      } else if (attempts >= maxAttempts) {
        clearInterval(checkInterval);
        const error = "Post editor did not appear after clicking 'Start a post'";
        debugLog(error);
        reject(new Error(error));
      }
    }, 500);
  });
}

/**
 * Generate a random delay between keystrokes to simulate human typing
 * @param {string} char - The character being typed
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {number} - Delay in milliseconds
 */
function getHumanLikeDelay(char, baseDelay = 100) {
  // Base variation (±30% of base delay)
  const randomFactor = 0.7 + (Math.random() * 0.6); // 0.7 to 1.3
  let delay = baseDelay * randomFactor;
  
  // Add extra delay for certain characters
  if (['.', '!', '?', ',', ';', ':'].includes(char)) {
    // Longer pause after punctuation (like a human would)
    delay += 100 + Math.random() * 200;
  } else if (char === '\n') {
    // Even longer pause for new paragraphs
    delay += 300 + Math.random() * 400;
  } else if (char === ' ') {
    // Slight pause after spaces
    delay += 10 + Math.random() * 40;
  }
  
  // Occasionally add a "thinking pause" (1% chance)
  if (Math.random() < 0.01) {
    delay += 500 + Math.random() * 1000;
  }
  
  return Math.round(delay);
}

/**
 * Type text into the editor character by character with human-like timing
 * @param {Element} editor - The editor element
 * @param {string} text - The text to type
 * @param {number} baseDelay - Base delay between keystrokes in milliseconds
 * @returns {Promise<void>}
 */
function typeIntoEditorHumanLike(editor, text, baseDelay = 100) {
  return new Promise((resolve) => {
    debugLog("Starting human-like typing");
    debugLog(`Text to type (${text.length} chars):`, text.substring(0, 50) + (text.length > 50 ? '...' : ''));
    
    // Add a short pause before starting to type (simulating human looking at the editor)
    const initialPause = 800 + Math.random() * 1200; // 800-2000ms pause
    debugLog(`Adding initial pause of ${initialPause}ms before typing starts`);
    
    setTimeout(() => {
      // Continue with typing after the pause
    
      // Focus the editor
      editor.focus();
      
      // Clear existing content
      editor.innerHTML = '<p><br></p>';
      
      // Split text into paragraphs
      const paragraphs = text.split('\n');
      let currentParagraphIndex = 0;
      let currentCharIndex = 0;
      let currentContent = '<p>';
      
      // Function to type the next character
    const typeNextChar = () => {
      if (currentParagraphIndex >= paragraphs.length) {
        // We're done typing
        debugLog("Finished typing all text");
        resolve();
        return;
      }
      
      const currentParagraph = paragraphs[currentParagraphIndex];
      
      if (currentCharIndex >= currentParagraph.length) {
        // Move to next paragraph
        currentContent += '</p>';
        editor.innerHTML = currentContent;
        
        // Dispatch input event
        const event = new Event('input', { bubbles: true });
        editor.dispatchEvent(event);
        
        currentParagraphIndex++;
        currentCharIndex = 0;
        
        if (currentParagraphIndex < paragraphs.length) {
          currentContent += '<p>';
          
          // Add a delay between paragraphs
          const paragraphDelay = 500 + Math.random() * 500;
          setTimeout(typeNextChar, paragraphDelay);
        } else {
          // We're done with all paragraphs
          resolve();
        }
        return;
      }
      
      // Get the next character
      const char = currentParagraph[currentCharIndex];
      currentContent += char;
      
      // Update the editor with the current content
      const paragraphContent = currentContent + '</p>';
      editor.innerHTML = paragraphContent;
      
      // Dispatch input event
      const event = new Event('input', { bubbles: true });
      editor.dispatchEvent(event);
      
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.setStart(editor.lastChild, editor.lastChild.childNodes.length);
      range.collapse(true);
      sel.removeAllRanges();
      sel.addRange(range);
      
      // Increment character index
      currentCharIndex++;
      
      // Calculate delay for next character
      const delay = getHumanLikeDelay(char, baseDelay);
      
      // Schedule typing of next character
      setTimeout(typeNextChar, delay);
    };
    
      // Start typing
      typeNextChar();
    }, initialPause);
  });
}

// Export the functions for use in the background script
window.linkedInPostHelper = {
  clickStartPostButton,
  typeIntoEditor: typeIntoEditorHumanLike,
  debugLog
};

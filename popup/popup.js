/**
 * This script runs inside your popup window (popup.html).
 * 1. It finds the button and the suggestion box.
 * 2. When you click the button, it sends a message to background.js to start.
 * 3. It listens for the final answer from background.js and displays it.
 */

document.addEventListener("DOMContentLoaded", () => {
    // Find the two elements from your popup.html
    const button = document.getElementById("get-help-button");
    const suggestionBox = document.getElementById("suggestion-box");
    const apiKeyInput = document.getElementById("api-key-input");
    const saveKeyButton = document.getElementById("save-key-button");
    const saveStatus = document.getElementById("save-status");

    // Try to load and display the key if it's already saved
    // This lets the user know a key is set
    chrome.storage.sync.get('userApiKey', (data) => {
        if (data.userApiKey) {
            apiKeyInput.value = data.userApiKey;
        }
    });

    // Listen for a click on the "Save Key" button
    saveKeyButton.addEventListener("click", () => {
        const newKey = apiKeyInput.value.trim();
        if (newKey) {
            // Save the key to chrome.storage.sync
            chrome.storage.sync.set({ userApiKey: newKey }, () => {
                console.log("API Key was saved.");
                saveStatus.innerText = "API Key saved successfully!";
                // Clear the status message after 3 seconds
                setTimeout(() => { saveStatus.innerText = ""; }, 3000);
            });
        } else {
            saveStatus.innerText = "Please enter an API key.";
        }
    });

    // 1. Listen for a click on the "Get Help" button
    button.addEventListener("click", () => {
        // Show a loading message and disable the button
        suggestionBox.innerText = "Scraping page and asking AI...";
        button.disabled = true;

        // 2. Send the "start" message to your background.js script
        chrome.runtime.sendMessage({ type: "GET_AI_SUGGESTION" });
    });

    // 3. Listen for the FINAL response from background.js
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        
        // We only care about the "AI_RESPONSE" message
        if (request.type === "AI_RESPONSE") {
            console.log("Popup: Received final AI response.", request);
            
            if (request.data) {
                // Success: Show the AI's suggestion
                suggestionBox.innerText = request.data;
            } else {
                // Error: Show the error message
                suggestionBox.innerText = request.error || "An unknown error occurred.";
            }
            
            // Re-enable the button so you can ask again
            button.disabled = false;
        }
    });
});
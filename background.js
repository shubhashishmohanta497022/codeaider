/**
 * This is the "Coordinator" script. It runs in the background.
 * 1. Listens for the "Get Help" click from the popup.
 * 2. Runs the scraper (content_script.js) on the page.
 * 3. Listens for the scraped data from the scraper.
 * 4. Sends that data to the AI.
 * 5. Sends the AI's final answer back to the popup.
 */

// Listen for messages from popup.js or content_script.js
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // --- Part 1: Message from the POPUP ---
    // The user clicked the button in the popup.
    if (request.type === "GET_AI_SUGGESTION") {
        console.log("CodeHelper: Received request from popup. Injecting scraper...");
        
        // 1. Get the current active tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (!activeTab) {
                console.error("CodeHelper: No active tab found.");
                sendResponse({ error: "No active tab found." });
                return;
            }

            // 2. Run the scraper (content_script.js) on that tab
            chrome.scripting.executeScript({
                target: { tabId: activeTab.id },
                files: ["content_script.js"]
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error("Script injection failed: ", chrome.runtime.lastError.message);
                    sendResponse({ error: "Failed to inject script. Reload the page and try again." });
                }
                // The content_script.js will now run and send a "SCRAPED_DATA" message...
            });
        });
        
        // This is crucial: return true to keep the message channel open
        // so we can send a response later (asynchronously).
        return true; 
    }

    // --- Part 2: Message from the SCRAPER ---
    // The content_script.js has finished and sent us the data.
    if (request.type === "SCRAPED_DATA") {
        console.log("CodeHelper: Received scraped data from content script:", request.data);

        // --- !! NEW FALLBACK CHECK !! ---
        // Check if the scraper sent back an error instead of data
        if (request.data.error) {
            console.error("CodeHelper: Scraper failed:", request.data.error);
            // Send this specific error to the popup
            chrome.runtime.sendMessage({ type: "AI_RESPONSE", error: request.data.error });
            return; // Stop here, do not call the AI
        }
        // --- END NEW CHECK ---
        
        // 3. Now, call the AI with the data (only if there was no error)
        callMyAI(request.data)
            .then(aiResponse => {
                // 4. Send the AI's final answer back to the popup
                console.log("CodeHelper: Sending AI response to popup.");
                chrome.runtime.sendMessage({ type: "AI_RESPONSE", data: aiResponse });
            })
            .catch(error => {
                console.error("CodeHelper: Error in AI call:", error);
                // Send the error (e.g., "API Key not set") to the popup
                chrome.runtime.sendMessage({ type: "AI_RESPONSE", error: error.message });
            });
        
        // We don't need to return true here, as this is the end of this message chain.
    }
});


/**
 * This is the "Brain" function.
 * It builds a prompt based on the scraped data and calls the AI API.
 */
async function callMyAI(scrapedData) {
    const { problemText, currentCode, errorText } = scrapedData;
    
    // --- !!! ACTION REQUIRED !!! ---
    // 1. Get the API Key from secure storage
    const storageData = await chrome.storage.sync.get('userApiKey');
    const API_KEY = storageData.userApiKey;

    // If the key isn't set, send an error back
    if (!API_KEY) {
        throw new Error("API Key not set. Please add your key in the extension popup and click Save.");
    }
    
    // 2. This is the corrected endpoint for Google's Gemini.
    const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + API_KEY; 

    // --- 3. This is the dynamic prompt logic ---
    let prompt;
    if (errorText && errorText.trim() !== "") {
        // SCENARIO 1: There IS an error. Use the "debugger" prompt.
        prompt = `
            You are an expert Python debugging assistant.
            A user is working on the following problem:
            --- PROBLEM ---
            ${problemText}
            --- END PROBLEM ---

            This is their code, which is failing:
            --- CODE ---
            ${currentCode}
            --- END CODE ---

            When they run it, they get this error in the "Actual Output" box:
            --- ERROR ---
            ${errorText}
            --- END ERROR ---

            Please provide a single, complete block of corrected Python code to fix this error.
            After the code block, briefly explain the error and what you fixed.
        `;
    } else {
        // SCENARIO 2: There is NO error. Use the "code helper" prompt.
        prompt = `
            You are a helpful Python coding assistant.
            A user is working on the following problem:
            --- PROBLEM ---
            ${problemText}
            --- END PROBLEM ---

            This is their code so far (it might be empty):
            --- CODE ---
            ${currentCode}
            --- END CODE ---

            Please provide the next logical block of code, or the full solution if the code is empty, to solve this problem.
            Only return the code suggestion, with no extra explanation.
        `;
    }

    // 4. This is the API call to Gemini
    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                // This is the specific format for Gemini's API
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AI API Error Response:", errorBody);
            // Handle specific API key error
            if (response.status === 400) {
                 throw new Error(`AI API Error: Bad Request. Is your API key correct and enabled?`);
            }
            throw new Error(`AI API Error: ${response.status} ${response.statusText}`);
        }

        const jsonResponse = await response.json();
        
        // 5. This parses the AI's response (adjust if your AI's format is different)
        const aiSuggestion = jsonResponse.candidates[0].content.parts[0].text;
        return aiSuggestion;

    } catch (error) {
        console.error("Error calling AI:", error);
        // Pass the specific error message (e.g., from the 'throw' statements)
        return `Error: Could not get a suggestion from the AI. \n\n${error.message}`;
    }
}
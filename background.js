/**
 * This is the "Coordinator" script. It runs in the background.
 * 1. Listens for tab updates (e.g., new question) and injects the scraper.
 * 2. Listens for the scraped data from the scraper and *stores it*.
 * 3. Listens for the "Get Help" click from the popup.
 * 4. Sends the *stored* data to the AI.
 * 5. Sends the AI's final answer back to the popup.
 */

let lastScrapedData = null;

// This fires when you click links on the page (even if it doesn't reload)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url && details.url.includes("seek.onlinedegree.iitm.ac.in/courses/ns_25t3_cs1002")) {
        console.log("CodeHelper: Detected navigation. Injecting scraper...");
        chrome.scripting.executeScript({
            target: { tabId: details.tabId },
            files: ["content_script.js"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Script injection failed: ", chrome.runtime.lastError.message);
            }
        });
    }
});

// We also add one for *full page reloads*
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url && tab.url.includes("seek.onlinedegree.iitm.ac.in/courses/ns_25t3_cs1002")) {
        console.log("CodeHelper: Detected tab update. Injecting scraper...");
        chrome.scripting.executeScript({
            target: { tabId: tabId },
            files: ["content_script.js"]
        }, () => {
            if (chrome.runtime.lastError) {
                console.error("Script injection failed: ", chrome.runtime.lastError.message);
            }
        });
    }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    // --- Part 1: Message from the POPUP ---
    if (request.type === "GET_AI_SUGGESTION") {
        console.log("CodeHelper: Received request from popup.");
        
        if (lastScrapedData) {
            console.log("CodeHelper: Using pre-fetched data:", lastScrapedData);

            if (lastScrapedData.error) {
                console.error("CodeHelper: Scraper failed:", lastScrapedData.error);
                chrome.runtime.sendMessage({ type: "AI_RESPONSE", error: lastScrapedData.error });
                return true; 
            }
        
            callMyAI(lastScrapedData)
                .then(aiResponse => {
                    console.log("CodeHelper: Sending AI response to popup.");
                    chrome.runtime.sendMessage({ type: "AI_RESPONSE", data: aiResponse });
                })
                .catch(error => {
                    console.error("CodeHelper: Error in AI call:", error);
                    chrome.runtime.sendMessage({ type: "AI_RESPONSE", error: error.message });
                });
        } else {
            console.warn("CodeHelper: No pre-fetched data. The user might need to wait or reload.");
            sendResponse({ error: "Waiting for scraper... Please wait a few seconds and try again." });
        }
        
        return true; 
    }

    // --- Part 2: Message from the SCRAPER ---
    if (request.type === "SCRAPED_DATA") {
        console.log("CodeHelper: Received and *stored* scraped data.");
        lastScrapedData = request.data;
    }
});


/**
 * This is the "Brain" function.
 * It builds a prompt based on the scraped data and calls the AI API.
 */
async function callMyAI(scrapedData) {
    const { problemText, currentCode, errorText } = scrapedData;
    
    const storageData = await chrome.storage.sync.get('userApiKey');
    const API_KEY = storageData.userApiKey;

    if (!API_KEY) {
        throw new Error("API Key not set. Please add your key in the extension popup and click Save.");
    }
    
    const API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=" + API_KEY; 

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
            You are an expert Python coding assistant acting as a "pair programmer."
            A user is working on the following problem:
            --- PROBLEM ---
            ${problemText}
            --- END PROBLEM ---

            This is their code so far (it might be empty):
            --- CODE ---
            ${currentCode}
            --- END CODE ---

            Your goal is to be a guide, not a solver.
            Do NOT provide the full solution.
            
            Instead, provide only the *very next logical line or small block of code* (1-3 lines maximum) to help the user continue.
            - If the code is empty, provide the first logical step (like a function definition or an initial variable).
            - If the code is on the right track, suggest the next line. (e.g., if they just wrote a 'for' loop, suggest the line that should go *inside* the loop).
            
            After the code block, add a *single-sentence* explanation (on a new line) of *why* this is the next step.

            For example:
            \`\`\`python
            def solve():
            \`\`\`
            Start by defining a function to organize your code.
        `;
    }

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("AI API Error Response:", errorBody);
            if (response.status === 400) {
                 throw new Error(`AI API Error: Bad Request. Is your API key correct and enabled?`);
            }
            throw new Error(`AI API Error: ${response.status} ${response.statusText}`);
        }

        const jsonResponse = await response.json();
        const aiSuggestion = jsonResponse.candidates[0].content.parts[0].text;
        return aiSuggestion;

    } catch (error) {
        console.error("Error calling AI:", error);
        return `Error: Could not get a suggestion from the AI. \n\n${error.message}`;
    }
}
/**
 * This is your "Scraper Mediator" script.
 * It reads the problem, your code, and any error messages from the page.
 */

function scrapeProblemData() {
    // --- Selectors updated based on all your screenshots ---
    
    // 1. The Question Text
    // (UPDATED from image_ebaff8.png)
    const PROBLEM_TEXT_SELECTOR = '.question-description';
    
    // 2. The Code Editor
    // (CONFIRMED from image_ebc284.png & image_ebc60b.png)
    const CODE_EDITOR_SELECTOR = 'div.ace_layer.ace_text-layer';
    
    // 3. The Error/Output Box
    // (CONFIRMED from image_ebbb61.png)
    const ERROR_BOX_SELECTOR = 'div.test-case-block-content-output';

    let problemText = "";
    let currentCode = "";
    let errorText = "";

    // --- Scrape 1: The Problem Text ---
    try {
        const problemEl = document.querySelector(PROBLEM_TEXT_SELECTOR);
        if (problemEl) {
            problemText = problemEl.innerText.trim();
        } else {
            console.warn(`CodeHelper: Selector not found for PROBLEM: "${PROBLEM_TEXT_SELECTOR}"`);
        }
    } catch (e) {
        console.error("CodeHelper: Error scraping problem text:", e);
    }
    
    // --- Scrape 2: The Current Code ---
    try {
        // This selector points to the div that holds all the text lines.
        const codeEl = document.querySelector(CODE_EDITOR_SELECTOR);
        if (codeEl) {
            currentCode = codeEl.innerText.trim();
        } else {
            console.warn(`CodeHelper: Selector not found for CODE: "${CODE_EDITOR_SELECTOR}".`);
        }
    } catch (e) {
        console.error("CodeHelper: Error scraping current code:", e);
    }

    // --- Scrape 3: The Error Message ---
    try {
        const errorEl = document.querySelector(ERROR_BOX_SELECTOR);
        // Check if the element exists AND is visible (offsetParent is not null)
        if (errorEl && errorEl.offsetParent !== null) {
            errorText = errorEl.innerText.trim();
        } else {
            // This is normal if there is no error
            console.log(`CodeHelper: No visible error box found with selector: "${ERROR_BOX_SELECTOR}"`);
        }
    } catch (e) {
        console.error("CodeHelper: Error scraping error text:", e);
    }

    // --- !! NEW FALLBACK LOGIC !! ---
    // Check if the most critical data was found.
    if (!problemText && !currentCode) {
        // If we found neither, the scraper definitely failed.
        return { 
            error: "Scraper Error: Could not find the problem text or code editor. Are you on the right tab? Reload the page and try again." 
        };
    }
    if (!problemText) {
        // If we found code but no problem, it's still a failure.
        return { 
            error: "Scraper Error: Could not find the problem text. Please make sure the 'Question' tab is visible." 
        };
    }
     if (!currentCode) {
        // If we found the problem but no code, let the user know.
        return { 
            error: "Scraper Error: Could not find the code editor. Did you click inside the editor? Try again." 
        };
    }

    // If we're here, we at least have the problem text and code.
    // Send all three pieces of data back to the background script
    return { problemText, currentCode, errorText };
}

// Send the final scraped data OR the error to the background script
// This message will be heard by the onMessage listener in background.js
chrome.runtime.sendMessage({ 
    type: "SCRAPED_DATA", 
    data: scrapeProblemData() 
});
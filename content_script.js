/**
 * This is your "Scraper Mediator" script.
 * It reads the problem, your code, and any error messages from the page.
 */

function scrapeProblemData() {
    // --- !!! ACTION REQUIRED !!! ---
    // You MUST replace these 3 placeholder selectors with the real ones
    // from your IITM course page using the "Inspect" tool.
    
    // 1. Find the selector for the question text
    // (Based on your screenshot, this holds "Seconds to Minute-Seconds", etc.)
    const PROBLEM_TEXT_SELECTOR = 'div.question-content-container'; // <-- 1. REPLACE THIS
    
    // 2. Find the selector for the code editor's text
    // (This is often 'div.monaco-editor', or 'div.view-lines')
    const CODE_EDITOR_SELECTOR = 'div.view-lines'; // <-- 2. REPLACE THIS
    
    // 3. Find the selector for the red "Actual Output" error box
    // (This might be 'div.actual-output', 'pre.error-message', etc.)
    const ERROR_BOX_SELECTOR = 'div.actual-output-box'; // <-- 3. REPLACE THIS

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
        const codeEl = document.querySelector(CODE_EDITOR_SELECTOR);
        if (codeEl) {
            currentCode = codeEl.innerText.trim();
        } else {
            console.warn(`CodeHelper: Selector not found for CODE: "${CODE_EDITOR_SELECTOR}"`);
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

    // Send all three pieces of data back to the background script
    return { problemText, currentCode, errorText };
}

// Send the final scraped data to the background script (background.js)
// This message will be heard by the onMessage listener in background.js
chrome.runtime.sendMessage({ 
    type: "SCRAPED_DATA", 
    data: scrapeProblemData() 
});
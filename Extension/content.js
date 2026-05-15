let latestEmailData = null;
let currentEmailUrl = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    console.log("Content script received message:", message);
    
    if (message.action === "extract_email") {
        const currentUrl = window.location.href;
    
        if (currentEmailUrl && currentEmailUrl !== currentUrl) {
            console.log("URL changed, clearing cached email data");
            latestEmailData = null;
            currentEmailUrl = null;
        }
        
        if (latestEmailData && currentEmailUrl === currentUrl) {
            console.log("Sending cached email data to popup:", latestEmailData);
            sendResponse(latestEmailData);
        } else {
            let emailData = null;
            
            if (window.location.hostname.includes("mail.google.com")) {
                emailData = extractGmailData();
            } else if (window.location.hostname.includes("outlook.live.com") || window.location.hostname.includes("outlook.office.com")) {
                emailData = tryExtractOutlookData();
            }
            
            if (emailData && emailData.sender !== "Unknown Sender") {
                console.log("Extracted email data on demand:", emailData);
                latestEmailData = emailData;
                currentEmailUrl = currentUrl;
                sendResponse(emailData);
            } else {
                console.log("No email data available");
                sendResponse(null);
            }
        }
        return true;
    }
});

function clearEmailDataIfNeeded() {
    const currentUrl = window.location.href;
    
    if (currentUrl.includes('#inbox') || 
        currentUrl.includes('#category') || 
        (!currentUrl.includes('#') && currentUrl.includes('mail.google.com')) ||
        (currentUrl.includes('outlook') && !isViewingSpecificEmail())) {
        
        if (latestEmailData) {
            console.log("Navigated away from email, clearing cached data");
            latestEmailData = null;
            currentEmailUrl = null;
        }
    }
}

function isViewingSpecificEmail() {
    return document.querySelector('[role="main"]')?.querySelector('[data-testid*="message"]') ||
           document.querySelector('div[aria-label="Message body"]') ||
           document.querySelector('.ms-FocusZone');
}

function isInInboxSection() {
    const currentUrl = window.location.href;
    return currentUrl.includes('/inbox') || 
           currentUrl.includes('/mail/') || 
           document.querySelector('[data-testid="message-list"]') ||
           document.querySelector('[role="main"]');
}

let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        console.log("URL changed to:", url);
        clearEmailDataIfNeeded();
    }
}).observe(document, { subtree: true, childList: true });

window.addEventListener('popstate', () => {
    console.log("Browser navigation detected");
    clearEmailDataIfNeeded();
});

function runMailSentinel() {
    if (document.body && !document.body.hasAttribute("data-mailsentinel-injected")) {
        document.body.setAttribute("data-mailsentinel-injected", "true");
        console.log("MailSentinel content script loaded.");

        if (window.location.hostname.includes("mail.google.com")) {
            waitForGmailEmail();
        }

        if (window.location.hostname.includes("outlook.live.com") || window.location.hostname.includes("outlook.office.com")) {
            if (isInInboxSection()) {
                console.log("Starting Outlook observer - in inbox section");
                waitForOutlookEmail();
            } else {
                console.log("Not in inbox section, observer will start when returning to inbox");
            }
        }
    }
}

function waitForGmailEmail() {
    const observer = new MutationObserver(() => {
        const emailBody = document.querySelector('.a3s.aiL');
        const subject = document.querySelector('h2.hP');
        const sender = document.querySelector('span[email]');

        if (emailBody && subject && sender) {
            const currentUrl = window.location.href;
            
            if (!latestEmailData || currentEmailUrl !== currentUrl) {
                observer.disconnect();
                console.log("Running Gmail extractor");
                const emailData = extractGmailData();
                latestEmailData = emailData; 
                currentEmailUrl = currentUrl; 
                console.log("Sending request to backend with data:", emailData);
                sendEmailDataToBackend(emailData);
                
                setTimeout(() => waitForGmailEmail(), 1000);
            }
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function waitForOutlookEmail() {
    let attempts = 0;
    let extractionSuccessful = false;
    let debounceTimer = null;
    let lastEmailId = null; 
    const maxAttempts = 10; 
    
    const observer = new MutationObserver((mutations) => {
        if (extractionSuccessful) return;
        
        const hasEmailContentChange = mutations.some(mutation => {
            if (!mutation.target || mutation.target.nodeType !== Node.ELEMENT_NODE) {
                return false;
            }
            
            try {
                return mutation.target.closest('[role="main"]') || 
                       mutation.target.closest('.ms-FocusZone') ||
                       mutation.target.closest('[data-testid*="message"]') ||
                       (mutation.addedNodes.length > 0 && 
                        Array.from(mutation.addedNodes).some(node => 
                            node.nodeType === Node.ELEMENT_NODE && 
                            (node.innerText?.length > 10 || node.querySelector)
                        ));
            } catch (error) {
                console.log("Error checking mutation:", error);
                return false;
            }
        });
        
        if (!hasEmailContentChange) return;
        
        const currentEmailId = window.location.href + document.title;
        if (currentEmailId === lastEmailId && attempts > 0) return;
        lastEmailId = currentEmailId;
        
        if (debounceTimer) {
            clearTimeout(debounceTimer);
        }
        
        debounceTimer = setTimeout(() => {
            attempts++;
            console.log(`Outlook extraction attempt ${attempts}`);
            
            const emailData = tryExtractOutlookData();
            
            if (emailData.sender !== "Unknown Sender" || attempts >= maxAttempts) {
                observer.disconnect();
                extractionSuccessful = true;
                
                if (emailData.sender !== "Unknown Sender") {
                    console.log("Running Outlook extractor - Success!");
                    latestEmailData = emailData;
                    currentEmailUrl = window.location.href; 
                    console.log("Sending request to backend with data:", emailData);
                    sendEmailDataToBackend(emailData);
                } else {
                    console.log("Failed to extract Outlook data after maximum attempts");
                    logOutlookDOMStructure();
                }
                
                setTimeout(() => {
                    extractionSuccessful = false;
                    attempts = 0;
                    waitForOutlookEmail();
                }, 2000);
            }
        }, 600); 
    });

    observer.observe(document.body, { 
        childList: true, 
        subtree: true,
        attributes: false, 
        characterData: false 
    });
    
    //Immediate extraction attempt
    setTimeout(() => {
        if (!extractionSuccessful) {
            const emailData = tryExtractOutlookData();
            if (emailData.sender !== "Unknown Sender") {
                observer.disconnect();
                extractionSuccessful = true;
                latestEmailData = emailData; 
                currentEmailUrl = window.location.href; 
                console.log("Outlook data extracted immediately");
                sendEmailDataToBackend(emailData);
                
                setTimeout(() => {
                    extractionSuccessful = false;
                    attempts = 0;
                    waitForOutlookEmail();
                }, 2000);
            }
        }
    }, 1500); 
}


function extractGmailData() {
    const senderElem = document.querySelector('span[email]');
    const sender = senderElem?.getAttribute("email") || "Unknown Sender";

    const subjectElem = document.querySelector('h2.hP') || document.querySelector('h2[data-legacy-thread-subject]');
    const subject = subjectElem?.innerText || "No Subject";

    const bodyElem = document.querySelector('.a3s.aiL');
    const body = bodyElem ? bodyElem.innerText : "No Body";

    const urls = Array.from(bodyElem?.querySelectorAll("a") || []).map(a => a.href);

    console.log("Gmail Email Extracted:", { sender, subject, body, urls });
    return { sender, subject, body, urls };
}

function tryExtractOutlookData() {
    console.log("Attempting Outlook data extraction...");
    
    try {
        //Strategy 1: Modern Outlook Web selectors (2024)
        let emailData = extractOutlookModern();
        if (emailData.sender !== "Unknown Sender") {
            console.log("Modern Outlook strategy successful");
            return emailData;
        }
        
        //Strategy 2: Classic selectors
        emailData = extractOutlookDataStrategy1();
        if (emailData.sender !== "Unknown Sender") {
            console.log("Strategy 1 successful");
            return emailData;
        }
        
        //Strategy 3: Alternative selectors
        emailData = extractOutlookDataStrategy2();
        if (emailData.sender !== "Unknown Sender") {
            console.log("Strategy 2 successful");
            return emailData;
        }
        
        //Strategy 4: Generic DOM traversal
        emailData = extractOutlookGeneric();
        if (emailData.sender !== "Unknown Sender") {
            console.log("Generic strategy successful");
            return emailData;
        }
        
        //Strategy 5: Fallback text-based extraction
        emailData = extractOutlookFallback();
        if (emailData.sender !== "Unknown Sender") {
            console.log("Fallback strategy successful");
            return emailData;
        }
        
    } catch (error) {
        console.error("Error in tryExtractOutlookData:", error);
    }
    
    console.log("All strategies failed");
    return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
}

function extractOutlookModern() {
    try {
        console.log("Attempting Modern Outlook extraction");
        const messageContainer = document.querySelector('[data-testid="message-container"]') ||
                                document.querySelector('[role="main"]') ||
                                document.querySelector('.ms-FocusZone');
        
        if (!messageContainer) {
            return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
        }
        
        let senderElem = messageContainer.querySelector('[data-testid="message-from"]') ||
                        messageContainer.querySelector('button[data-testid*="sender"]') ||
                        messageContainer.querySelector('[aria-label*="From"]') ||
                        messageContainer.querySelector('[title*="@"]');
        
        if (!senderElem) {
            const emailPattern = /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/;
            const allElements = messageContainer.querySelectorAll('*');
            for (const elem of allElements) {
                const text = elem.innerText || elem.title || elem.getAttribute('aria-label') || '';
                if (emailPattern.test(text) && !elem.querySelector('input')) {
                    senderElem = elem;
                    break;
                }
            }
        }
        
        const subjectElem = messageContainer.querySelector('[data-testid="message-subject"]') ||
                           messageContainer.querySelector('h1[tabindex="-1"]') ||
                           messageContainer.querySelector('[role="heading"]') ||
                           messageContainer.querySelector('h2, h3');
        
        let bodyElem = messageContainer.querySelector('[data-testid="message-body"]') ||
                      messageContainer.querySelector('.elementToProof') ||
                      messageContainer.querySelector('[contenteditable="true"]') ||
                      messageContainer.querySelector('[role="textbox"]');
        
        if (!bodyElem) {
            const divs = Array.from(messageContainer.querySelectorAll('div')).filter(div => {
                const text = div.innerText || '';
                return text.length > 50 && 
                       !div.querySelector('button') && 
                       !text.includes('@') &&
                       !text.includes('Reply') &&
                       !text.includes('Forward');
            });
            bodyElem = divs[0];
        }
        
        const sender = extractTextFromElement(senderElem) || "Unknown Sender";
        const subject = extractTextFromElement(subjectElem) || "No Subject";
        const body = extractTextFromElement(bodyElem) || "No Body";
        const urls = Array.from(bodyElem?.querySelectorAll("a") || []).map(a => a.href);
        
        console.log("Modern Outlook extracted:", { sender, subject, body: body.substring(0, 100), urls });
        return { sender, subject, body, urls };
        
    } catch (error) {
        console.error("Modern Outlook extraction error:", error);
        return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
    }
}

function extractTextFromElement(element) {
    if (!element) return null;
    
    return element.innerText?.trim() || 
           element.textContent?.trim() || 
           element.title?.trim() || 
           element.getAttribute('aria-label')?.trim() ||
           element.getAttribute('data-original-title')?.trim();
}

function extractOutlookGeneric() {
    try {
        console.log("Attempting generic Outlook extraction");
        
        const mainContent = document.querySelector('[role="main"]') ||
                           document.querySelector('.ms-FocusZone') ||
                           document.body;
        
        if (!mainContent) {
            return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
        }
        
        const emailPattern = /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/;
        let sender = "Unknown Sender";
        
        const textElements = Array.from(mainContent.querySelectorAll('*')).filter(el => {
            const text = extractTextFromElement(el) || '';
            return emailPattern.test(text) && text.length < 200;
        });
        
        if (textElements.length > 0) {
            const senderText = extractTextFromElement(textElements[0]);
            const emailMatch = senderText?.match(emailPattern);
            if (emailMatch) {
                sender = emailMatch[0];
            }
        }
        
        let subject = "No Subject";
        const headings = mainContent.querySelectorAll('h1, h2, h3, [role="heading"]');
        if (headings.length > 0) {
            subject = extractTextFromElement(headings[0]) || subject;
        }
        
        let body = "No Body";
        const contentDivs = Array.from(mainContent.querySelectorAll('div, p')).filter(div => {
            const text = extractTextFromElement(div) || '';
            return text.length > 30 && 
                   !emailPattern.test(text) &&
                   text !== subject &&
                   !div.querySelector('button');
        });
        
        if (contentDivs.length > 0) {
            const longestDiv = contentDivs.reduce((prev, current) => {
                const prevLength = extractTextFromElement(prev)?.length || 0;
                const currentLength = extractTextFromElement(current)?.length || 0;
                return currentLength > prevLength ? current : prev;
            });
            body = extractTextFromElement(longestDiv) || body;
        }
        
        const urls = Array.from(mainContent.querySelectorAll("a")).map(a => a.href).filter(href => href && href.startsWith('http'));
        
        console.log("Generic extraction result:", { sender, subject, body: body.substring(0, 100), urls });
        return { sender, subject, body, urls };
        
    } catch (error) {
        console.error("Generic extraction error:", error);
        return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
    }
}

function extractOutlookFallback() {
    try {
        console.log("Attempting fallback Outlook extraction");
        const emailPattern = /[\w._%+-]+@[\w.-]+\.[A-Za-z]{2,}/;
        let sender = "Unknown Sender";
        const allText = document.body.innerText || '';
        const emailMatch = allText.match(emailPattern);
        if (emailMatch) {
            sender = emailMatch[0];
        }
        
        let subject = document.title || "No Subject";
        if (subject.includes(' - ')) {
            subject = subject.split(' - ')[0];
        }
        
        let body = "No Body";
        const allDivs = Array.from(document.querySelectorAll('div')).filter(div => {
            const text = div.innerText || '';
            return text.length > 50 && !text.includes('@');
        });
        
        if (allDivs.length > 0) {
            const largestDiv = allDivs.reduce((prev, current) => {
                return (current.innerText?.length || 0) > (prev.innerText?.length || 0) ? current : prev;
            });
            body = largestDiv.innerText || body;
        }
        
        const urls = Array.from(document.querySelectorAll("a")).map(a => a.href).filter(href => href && href.startsWith('http'));
        
        console.log("Fallback extraction result:", { sender, subject, body: body.substring(0, 100), urls });
        return { sender, subject, body, urls };
        
    } catch (error) {
        console.error("Fallback extraction error:", error);
        return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
    }
}

function extractOutlookDataStrategy1() {
    try {
        const senderElem = document.querySelector('div[aria-label^="From"] span span');
        const subjectElem = document.querySelector('div[aria-label="Message header"] span[title]');
        const bodyElem = document.querySelector('div[aria-label="Message body"]');

        const sender = extractTextFromElement(senderElem) || "Unknown Sender";
        const subject = extractTextFromElement(subjectElem) || "No Subject";
        const body = extractTextFromElement(bodyElem) || "No Body";
        const urls = Array.from(bodyElem?.querySelectorAll("a") || []).map(a => a.href);

        return { sender, subject, body, urls };
    } catch (error) {
        console.error("Strategy 1 error:", error);
        return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
    }
}

function extractOutlookDataStrategy2() {
    try {
        const senderElem = document.querySelector('[data-testid="message-header-from-field"] [title]') ||
                          document.querySelector('.allowTextSelection .ms-Persona-primaryText');
        const subjectElem = document.querySelector('[data-testid="message-subject"]') ||
                           document.querySelector('div[role="heading"][tabindex="-1"]');
        const bodyElem = document.querySelector('[data-testid="message-body-content"]') ||
                        document.querySelector('div[role="document"]');

        const sender = extractTextFromElement(senderElem) || "Unknown Sender";
        const subject = extractTextFromElement(subjectElem) || "No Subject";
        const body = extractTextFromElement(bodyElem) || "No Body";
        const urls = Array.from(bodyElem?.querySelectorAll("a") || []).map(a => a.href);

        return { sender, subject, body, urls };
    } catch (error) {
        console.error("Strategy 2 error:", error);
        return { sender: "Unknown Sender", subject: "No Subject", body: "No Body", urls: [] };
    }
}

function logOutlookDOMStructure() {
    try {
        console.log("=== OUTLOOK DOM DEBUG INFO ===");
        console.log("Current URL:", window.location.href);
        
        const ariaElements = document.querySelectorAll('[aria-label]');
        console.log("Elements with aria-label:", Array.from(ariaElements).slice(0, 10).map(el => ({
            tag: el.tagName,
            ariaLabel: el.getAttribute('aria-label'),
            text: el.innerText?.substring(0, 50)
        })));
        
        const testIdElements = document.querySelectorAll('[data-testid]');
        console.log("Elements with data-testid:", Array.from(testIdElements).slice(0, 10).map(el => ({
            tag: el.tagName,
            testId: el.getAttribute('data-testid'),
            text: el.innerText?.substring(0, 50)
        })));
        
        const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6, [role="heading"]');
        console.log("Headings found:", Array.from(headings).slice(0, 5).map(h => ({
            tag: h.tagName,
            role: h.getAttribute('role'),
            text: h.innerText?.substring(0, 100)
        })));
        
        const emailElements = Array.from(document.querySelectorAll('*')).filter(el => 
            el && el.innerText && el.innerText.includes('@') && el.children.length === 0
        ).slice(0, 5);
        console.log("Potential email elements:", emailElements.map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.innerText
        })));
        
        console.log("=== END DEBUG INFO ===");
    } catch (error) {
        console.error("Error in logOutlookDOMStructure:", error);
    }
}

async function sendEmailDataToBackend(emailData) {
    try {
        const response = await fetch("http://127.0.0.1:8000/analyze-email", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(emailData)
        });

        const result = await response.json();
        console.log("Trust Score received from backend:", result);
    } catch (error) {
        console.error("Error contacting backend:", error);
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runMailSentinel);
} else {
    runMailSentinel();
}
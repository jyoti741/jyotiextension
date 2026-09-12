const MAX_PAGES = 4;

let selectedPages = [];
let currentTab = null;

// When popup DOM is ready
document.addEventListener("DOMContentLoaded", initialize);

async function initialize() {
    attachEventListeners();

    // Run parallel queries to load state instantly without blocking
    await Promise.all([
        loadPages(),
        loadCurrentPage(),
        loadUserGoal()
    ]);

    updateUI();
}

// -----------------------------------------
// Storage: Saved Pages
// -----------------------------------------

async function loadPages() {
    try {
        const result = await chrome.storage.local.get(["selectedPages"]);
        selectedPages = Array.isArray(result.selectedPages) ? result.selectedPages : [];
    } catch (err) {
        console.error("Failed to load saved pages:", err);
        selectedPages = [];
    }
}

// -----------------------------------------
// Storage: User Goal
// -----------------------------------------

async function loadUserGoal() {
    try {
        const result = await chrome.storage.local.get(["userGoal"]);
        const goalEl = document.getElementById("userGoal");
        if (goalEl && result.userGoal) {
            goalEl.value = result.userGoal;
        }
    } catch (err) {
        console.error("Failed to load user goal:", err);
    }
}

// -----------------------------------------
// Current Active Webpage
// -----------------------------------------

async function loadCurrentPage() {
    const titleEl = document.getElementById("currentTitle");
    const domainEl = document.getElementById("currentDomain");
    const addBtn = document.getElementById("addButton");

    try {
        let tabs = await chrome.tabs.query({
            active: true,
            currentWindow: true
        });

        // Fallback for popups where currentWindow might not resolve active tab
        if (!tabs || tabs.length === 0) {
            tabs = await chrome.tabs.query({
                active: true,
                lastFocusedWindow: true
            });
        }

        currentTab = tabs && tabs[0] ? tabs[0] : null;

        if (!currentTab || !currentTab.url) {
            if (titleEl) titleEl.textContent = "No active page found";
            if (domainEl) domainEl.textContent = "Open a webpage to compare";
            if (addBtn) addBtn.disabled = true;
            return;
        }

        if (isRestrictedUrl(currentTab.url)) {
            if (titleEl) titleEl.textContent = currentTab.title || "Browser System Page";
            if (domainEl) domainEl.textContent = "Cannot extract browser system pages";
            if (addBtn) {
                addBtn.disabled = true;
                addBtn.textContent = "System Page Cannot Be Added";
            }
            return;
        }

        if (titleEl) titleEl.textContent = currentTab.title || "Untitled Page";
        if (domainEl) domainEl.textContent = getDomain(currentTab.url);
    } catch (err) {
        console.error("Failed to read current page:", err);
        if (titleEl) titleEl.textContent = "Unable to read page";
        if (domainEl) domainEl.textContent = "";
        if (addBtn) addBtn.disabled = true;
    }
}

function isRestrictedUrl(url) {
    if (!url) return true;
    return (
        url.startsWith("chrome://") ||
        url.startsWith("chrome-extension://") ||
        url.startsWith("edge://") ||
        url.startsWith("about:") ||
        url.startsWith("view-source:") ||
        url.startsWith("devtools://") ||
        url.startsWith("https://chrome.google.com/webstore") ||
        url.startsWith("https://chromewebstore.google.com")
    );
}

function getDomain(url) {
    try {
        if (!url) return "";
        const parsed = new URL(url);
        return parsed.hostname;
    } catch {
        return url || "";
    }
}

function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

// -----------------------------------------
// Add Current Page
// -----------------------------------------

async function addCurrentPage() {
    if (selectedPages.length >= MAX_PAGES) {
        alert("You can compare a maximum of 4 pages.");
        return;
    }

    if (!currentTab || !currentTab.id || isRestrictedUrl(currentTab.url)) {
        alert("Cannot extract content from this page. Please navigate to a standard webpage.");
        return;
    }

    // Check duplicate
    const alreadyExists = selectedPages.some(page => page.url === currentTab.url);
    if (alreadyExists) {
        alert("This page is already selected.");
        return;
    }

    const addBtn = document.getElementById("addButton");
    const originalBtnText = addBtn ? addBtn.textContent : "+ ADD TO COMPARISON";
    if (addBtn) {
        addBtn.disabled = true;
        addBtn.textContent = "Extracting page...";
    }

    try {
        const pageData = await extractPageData(currentTab.id);

        if (!pageData || !pageData.url) {
            throw new Error("Could not collect page information.");
        }

        const snapshot = {
            id: Date.now(),
            title: pageData.title || currentTab.title || "Untitled Page",
            url: pageData.url || currentTab.url,
            domain: pageData.domain || getDomain(currentTab.url),
            text: pageData.text || "",
            addedAt: new Date().toISOString()
        };

        selectedPages.push(snapshot);
        await chrome.storage.local.set({ selectedPages });
        updateUI();
    } catch (err) {
        console.error("Extraction error:", err);
        alert(err.message || "Failed to extract page content. Try reloading the tab.");
    } finally {
        if (addBtn) {
            addBtn.textContent = originalBtnText;
            updateUI();
        }
    }
}

// Direct in-tab function execution via scripting API (no port closure or receiving end errors)
async function extractPageData(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const rawText = document.body ? (document.body.innerText || "") : "";
                return {
                    title: document.title || "Untitled Page",
                    url: window.location.href,
                    domain: window.location.hostname,
                    text: rawText.slice(0, 20000).replace(/\s+/g, " ").trim()
                };
            }
        });

        if (results && results[0] && results[0].result) {
            return results[0].result;
        }
        throw new Error("No data returned from page");
    } catch (scriptErr) {
        console.warn("Direct script execution failed, trying message fallback:", scriptErr);

        return new Promise((resolve, reject) => {
            chrome.tabs.sendMessage(tabId, { action: "extractPage" }, (response) => {
                const lastError = chrome.runtime.lastError;
                if (lastError) {
                    reject(new Error("Cannot extract this page. Please reload the webpage and try again."));
                } else if (response) {
                    resolve(response);
                } else {
                    reject(new Error("Could not collect page data."));
                }
            });
        });
    }
}

// -----------------------------------------
// Remove Page
// -----------------------------------------

async function removePage(id) {
    selectedPages = selectedPages.filter(page => page.id !== id);
    await chrome.storage.local.set({ selectedPages });
    updateUI();
}

// -----------------------------------------
// Clear All
// -----------------------------------------

async function clearComparison() {
    if (selectedPages.length === 0) return;
    selectedPages = [];
    await chrome.storage.local.set({ selectedPages });
    updateUI();
}

// -----------------------------------------
// Launch Comparison
// -----------------------------------------

function launchComparison() {
    if (selectedPages.length < 2) {
        alert("Please select at least 2 pages to compare.");
        return;
    }

    // Open compare.html tab
    chrome.tabs.create({
        url: chrome.runtime.getURL("compare.html")
    });
}

// -----------------------------------------
// UI Updates
// -----------------------------------------

function updateUI() {
    const container = document.getElementById("selectedPages");
    const countEl = document.getElementById("pageCount");
    const addBtn = document.getElementById("addButton");
    const compareBtn = document.getElementById("compareButton");

    // Render Page Count
    if (countEl) {
        countEl.textContent = `${selectedPages.length} / ${MAX_PAGES}`;
    }

    // Render Selected Pages Cards
    if (container) {
        container.innerHTML = "";

        if (selectedPages.length === 0) {
            const emptyEl = document.createElement("p");
            emptyEl.className = "empty-hint";
            emptyEl.textContent = "No pages added yet. Click '+ ADD TO COMPARISON' above.";
            container.appendChild(emptyEl);
        } else {
            selectedPages.forEach((page, index) => {
                const card = document.createElement("div");
                card.className = "page-card";
                card.innerHTML = `
                    <div class="page-number">Page ${index + 1}</div>
                    <div class="page-title">${escapeHTML(page.title)}</div>
                    <div class="page-domain">${escapeHTML(page.domain)}</div>
                    <button class="remove" data-id="${page.id}">Remove</button>
                `;

                card.querySelector(".remove").addEventListener("click", () => {
                    removePage(page.id);
                });

                container.appendChild(card);
            });
        }
    }

    // Update Add Button State
    if (addBtn) {
        if (!currentTab || isRestrictedUrl(currentTab.url)) {
            addBtn.disabled = true;
            addBtn.textContent = "+ ADD TO COMPARISON";
        } else if (selectedPages.length >= MAX_PAGES) {
            addBtn.disabled = true;
            addBtn.textContent = "MAX 4 PAGES REACHED";
        } else if (selectedPages.some(page => page.url === currentTab.url)) {
            addBtn.disabled = true;
            addBtn.textContent = "✓ ALREADY ADDED";
        } else {
            addBtn.disabled = false;
            addBtn.textContent = "+ ADD TO COMPARISON";
        }
    }

    // Update Compare Button State
    if (compareBtn) {
        const count = selectedPages.length;
        compareBtn.textContent = `COMPARE ${count} ${count === 1 ? "PAGE" : "PAGES"}`;
        compareBtn.disabled = count < 2;
    }
}

// -----------------------------------------
// Event Listeners
// -----------------------------------------

function attachEventListeners() {
    const addBtn = document.getElementById("addButton");
    if (addBtn) {
        addBtn.addEventListener("click", addCurrentPage);
    }

    const clearBtn = document.getElementById("clearButton");
    if (clearBtn) {
        clearBtn.addEventListener("click", clearComparison);
    }

    const compareBtn = document.getElementById("compareButton");
    if (compareBtn) {
        compareBtn.addEventListener("click", launchComparison);
    }

    const goalEl = document.getElementById("userGoal");
    if (goalEl) {
        let debounceTimeout;
        goalEl.addEventListener("input", (e) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                chrome.storage.local.set({ userGoal: e.target.value.trim() });
            }, 300);
        });
    }
}
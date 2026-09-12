document.addEventListener("DOMContentLoaded", initComparePage);

async function initComparePage() {
    const data = await chrome.storage.local.get(["selectedPages", "userGoal"]);
    const pages = Array.isArray(data.selectedPages) ? data.selectedPages : [];
    const goal = data.userGoal || "";

    renderGoal(goal);
    renderGrid(pages);

    document.getElementById("copySummaryBtn").addEventListener("click", () => copySummary(pages, goal));
    document.getElementById("clearAllBtn").addEventListener("click", clearAll);
}

function renderGoal(goal) {
    const goalContainer = document.getElementById("goalContainer");
    const goalDisplay = document.getElementById("goalDisplay");
    if (goal && goal.trim()) {
        goalContainer.style.display = "block";
        goalDisplay.textContent = goal.trim();
    } else {
        goalContainer.style.display = "none";
    }
}

function renderGrid(pages) {
    const grid = document.getElementById("comparisonGrid");
    const empty = document.getElementById("emptyContainer");
    const subheading = document.getElementById("subheading");

    grid.innerHTML = "";

    if (pages.length === 0) {
        grid.style.display = "none";
        empty.style.display = "block";
        subheading.textContent = "0 pages selected";
        return;
    }

    grid.style.display = "grid";
    empty.style.display = "none";
    subheading.textContent = `Comparing ${pages.length} selected ${pages.length === 1 ? 'page' : 'pages'}`;

    pages.forEach((page, index) => {
        const card = document.createElement("div");
        card.className = "page-card";
        card.innerHTML = `
            <div class="card-header">
                <span class="badge">Page ${index + 1}</span>
                <h3 class="card-title">${escapeHTML(page.title || "Untitled")}</h3>
                <a href="${encodeURI(page.url)}" target="_blank" class="card-domain">${escapeHTML(page.domain || page.url)}</a>
            </div>
            <div class="card-body">
                <div class="section-heading">Extracted Content Preview</div>
                <div class="content-snippet">${escapeHTML(page.text || "No readable text extracted from this page.")}</div>
            </div>
        `;
        grid.appendChild(card);
    });
}

function escapeHTML(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

async function copySummary(pages, goal) {
    if (pages.length === 0) {
        alert("No pages to copy.");
        return;
    }

    let summaryText = `COMPARE ANYTHING SUMMARY\n`;
    if (goal) summaryText += `Goal: ${goal}\n`;
    summaryText += `Total Pages: ${pages.length}\n\n`;

    pages.forEach((page, i) => {
        summaryText += `--- Page ${i + 1}: ${page.title} ---\n`;
        summaryText += `URL: ${page.url}\n`;
        summaryText += `Content:\n${page.text ? page.text.slice(0, 500) + '...' : 'N/A'}\n\n`;
    });

    try {
        await navigator.clipboard.writeText(summaryText);
        const btn = document.getElementById("copySummaryBtn");
        const prevText = btn.textContent;
        btn.textContent = "✓ Copied to clipboard!";
        setTimeout(() => { btn.textContent = prevText; }, 2000);
    } catch (e) {
        alert("Unable to copy to clipboard.");
    }
}

async function clearAll() {
    if (!confirm("Are you sure you want to clear all compared pages?")) return;
    await chrome.storage.local.set({ selectedPages: [] });
    renderGrid([]);
}

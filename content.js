chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "extractPage") {
        try {
            const rawText = document.body ? (document.body.innerText || "") : "";
            sendResponse({
                title: document.title || "Untitled Page",
                url: window.location.href,
                domain: window.location.hostname,
                text: rawText.slice(0, 20000).replace(/\s+/g, " ").trim()
            });
        } catch (err) {
            sendResponse({
                title: document.title || "Untitled Page",
                url: window.location.href,
                domain: window.location.hostname,
                text: "",
                error: err.message
            });
        }
    }
});
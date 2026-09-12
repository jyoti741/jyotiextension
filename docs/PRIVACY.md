# Privacy Policy for Compare Anything

**Effective Date:** September 12, 2026  
**Last Updated:** September 12, 2026

Compare Anything ("we", "us", or "our") builds privacy-first browser tools that help users make informed decisions by comparing information across web pages. We value your privacy and believe in full transparency about what data is collected, how it is used, and how it is protected.

---

### 1. User-Initiated Data Collection Only

Compare Anything **does not** continuously monitor your browsing activity, scan open tabs, or track your history. 

- Webpage content is **only accessed when you explicitly click "+ ADD TO COMPARISON"** on an active browser tab.
- We request only the minimal permissions required (`activeTab`, `scripting`, `storage`) to operate strictly upon user request.

---

### 2. Information Extracted and Transmitted

When you add a page to your comparison and click **"Compare"**, Compare Anything extracts relevant structured and visible text from the selected pages:
- Page Title and Canonical URL / Domain
- Meta Description
- Public Schema.org / JSON-LD structured data (e.g., product, course, or job details)
- Key specification tables, definition lists, and visible text highlights
- Your optional comparison priority or goal (if provided)

Navigation menus, ads, tracker scripts, and extraneous footer elements are actively filtered out prior to transmission to minimize payload size.

---

### 3. Purpose of Processing

The extracted information is transmitted to our comparison backend and AI processing providers (Groq / OpenRouter) **for the sole purpose of generating the requested side-by-side comparison report**.

---

### 4. AI Provider Disclosure

To generate accurate, structured comparisons, the extracted text snapshots and user goal are processed using third-party AI inference providers:
- **Groq Inc.** (Primary AI inference provider)
- **OpenRouter** (Secondary fallback AI provider)

These providers process the input tokens solely to complete the requested completion request in accordance with strict API enterprise privacy terms.

---

### 5. Zero Permanent Storage of Page Content

- **No permanent storage:** Raw webpage content, extracted snippets, and comparison goals are **never permanently stored** on our servers or databases.
- **Temporary local cache:** Comparison workspaces and selected pages are stored locally in your browser via `chrome.storage.local`. When you click **"Clear All"** or start a new comparison, this data is erased.
- **Server logs:** Server logs strictly record non-identifiable telemetry metadata (timestamp, request ID, truncated/hashed install ID, count of pages, processing duration, and status code). Full page text and URLs are never written to server logs.

---

### 6. No Sale or Advertising Use

- We **do not sell**, rent, trade, or monetize your extracted page data or comparison requests.
- Extracted data is **never used for behavioral tracking, profiling, or targeted advertising**.
- Humans do not routinely review or inspect your submitted comparison data.

---

### 7. Security and Encryption

All communications between the Compare Anything Chrome Extension, our backend API, and our AI inference providers are encrypted using industry-standard **HTTPS / TLS 1.3**.

---

### 8. Anonymous Install Identifier

When first installed, the extension generates an anonymous random UUID stored locally in your browser (`installId`). This identifier is used solely for rate limiting and abuse prevention (e.g., enforcing the daily comparison quota) and is not linked to any personal identity, email, or account.

---

### 9. Contact and Inquiries

If you have any questions or feedback regarding this Privacy Policy or our privacy practices, please contact us via our public repository issue tracker or support page.

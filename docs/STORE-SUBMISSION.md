# Chrome Web Store Submission Guide

This document contains all official listing copy, permission justifications, and store metadata required for publishing **Compare Anything** on the Chrome Web Store.

---

### 1. Store Identity & Listing Copy

#### Extension Name
```text
Compare Anything – AI Web Comparison
```

#### Short Summary (Max 132 characters)
```text
Add 2–4 web pages and get one clear AI comparison table based only on the information on those pages.
```
*(Character count: 105 / 132)*

#### Store Category
- **Category:** Productivity
- **Language:** English

---

### 2. Full Store Description (Section 38)

```text
Compare Anything helps you make decisions without constantly switching between browser tabs.

Add webpages you want to compare, optionally tell us what matters to you, and get one clean AI-generated comparison based on the information contained on those pages.

Use Compare Anything for products, software plans, jobs, courses, services, hotels and other online research.

Key features:
• Compare 2–4 webpages side-by-side
• Automatically discovers useful comparison criteria
• Creates a structured, objective comparison table
• Highlights important differentiators and tradeoffs
• Takes your personal priorities and constraints into account
• Identifies missing or unconfirmed information instead of guessing
• Links every evaluated item back to its original source
• Export comparisons as Markdown, CSV, or shareable PNG
• No registration, account, or credit card required

Compare Anything only accesses pages that you explicitly add to a comparison.
```

---

### 3. Single-Purpose Description (Section 39)
*Use this in the Chrome Web Store Developer Dashboard "Single Purpose" compliance field:*

```text
Compare Anything allows users to select webpages and generate an AI-assisted side-by-side comparison of the information contained on those selected pages.
```

---

### 4. Chrome Permissions Justification

| Permission | Technical Usage & Justification |
| :--- | :--- |
| **`activeTab`** | Provides temporary, user-granted access to the currently active webpage ONLY after the user explicitly clicks "+ ADD TO COMPARISON". Avoids requiring broad access to all browsing history or URLs. |
| **`scripting`** | Used in conjunction with `activeTab` to execute `PageExtractor` in the active page DOM to extract structured text, specifications, and tables. |
| **`storage`** | Used strictly for temporary local browser storage via `chrome.storage.local` to store selected pages in the active comparison workspace, user priority notes, and privacy preference flags. |

> **Reviewer Note:** Compare Anything requests ZERO host permissions (`<all_urls>` is not requested). We do not request `history`, `bookmarks`, `cookies`, or background tab tracking.

---

### 5. Store Assets Checklist (Section 40)

- [x] **Extension Icons:**
  - `16 × 16 PNG` (`icons/icon16.png`)
  - `48 × 48 PNG` (`icons/icon48.png`)
  - `128 × 128 PNG` (`icons/icon128.png`)
- [ ] **Store Promotional Screenshots (1280 × 800 PNG):**
  - **Screenshot 1:** Three product tabs being added (*"Add pages you want to compare"*)
  - **Screenshot 2:** Completed comparison table (*"One clear comparison"*)
  - **Screenshot 3:** User requirement textbox (*"Compare based on what matters to you"*)
  - **Screenshot 4:** Best Overall verdict banner and Best For recommendations (*"Make decisions faster"*)
  - **Screenshot 5:** Multi-category examples (*"Compare more than products: SaaS, Jobs, Courses"*)
- [ ] **Small Promo Tile (440 × 280 PNG):** Clean brand graphic with tagline *"Stop switching between tabs. Compare them."*

---

### 6. Submission Steps

1. Run the packaging command to generate the production ZIP:
   ```bash
   npm run package:extension
   ```
   *Artifact generated:* `dist/compare-anything-extension.zip`
2. Log in to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole).
3. Click **"New Item"** and upload `dist/compare-anything-extension.zip`.
4. Fill in the Title, Summary, Description, and Single-Purpose fields using the copy above.
5. Provide the Privacy Policy URL pointing to `PRIVACY.md` on your hosting domain or public repository.
6. Submit for review.

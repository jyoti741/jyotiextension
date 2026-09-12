import React, { useEffect, useState } from "react";
import { PageSnapshot } from "../types/comparison";
import { extractPageContent, ExtractedPageResult } from "../extractors/PageExtractor";
import styles from "./Popup.module.css";

const MAX_PAGES = 4;
const MIN_PAGES = 2;

export const Popup: React.FC = () => {
  const [selectedPages, setSelectedPages] = useState<PageSnapshot[]>([]);
  const [currentTab, setCurrentTab] = useState<chrome.tabs.Tab | null>(null);
  const [goal, setGoal] = useState<string>("");
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isLoadingTab, setIsLoadingTab] = useState<boolean>(true);
  const [hasSeenPrivacy, setHasSeenPrivacy] = useState<boolean>(true);

  useEffect(() => {
    initializePopup();
  }, []);

  const initializePopup = async () => {
    setIsLoadingTab(true);
    try {
      // 1. Load saved pages, goal, and privacy acceptance from storage
      const storage = await chrome.storage.local.get(["selectedPages", "userGoal", "hasSeenPrivacy"]);
      setHasSeenPrivacy(storage.hasSeenPrivacy === true);

      if (Array.isArray(storage.selectedPages)) {
        // Normalize any snapshot structures
        const normalized: PageSnapshot[] = storage.selectedPages.map((p: any, idx: number) => ({
          id: String(p.id || Date.now() + idx),
          title: p.title || "Untitled Page",
          url: p.url || "",
          domain: p.domain || getDomain(p.url),
          description: p.description || null,
          structuredData: p.structuredData || null,
          importantText: p.importantText || p.text || "",
          capturedAt: p.capturedAt || p.addedAt || new Date().toISOString(),
          addedAt: p.addedAt || p.capturedAt || new Date().toISOString()
        }));
        setSelectedPages(normalized);
      }
      if (typeof storage.userGoal === "string") {
        setGoal(storage.userGoal);
      }

      // 2. Query active browser tab
      let tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs || tabs.length === 0) {
        tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      }

      if (tabs && tabs.length > 0) {
        setCurrentTab(tabs[0]);
      }
    } catch (err) {
      console.error("Popup init error:", err);
    } finally {
      setIsLoadingTab(false);
    }
  };

  const isRestrictedUrl = (url?: string): boolean => {
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
  };

  const getDomain = (url?: string): string => {
    if (!url) return "";
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  };

  const handleGoalChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setGoal(val);
    chrome.storage.local.set({ userGoal: val });
  };

  const handleAddCurrentPage = async () => {
    if (!currentTab || !currentTab.id || !currentTab.url) {
      setStatusMessage("No active webpage detected.");
      return;
    }

    if (isRestrictedUrl(currentTab.url)) {
      setStatusMessage("Cannot extract content from browser system pages.");
      return;
    }

    if (selectedPages.length >= MAX_PAGES) {
      setStatusMessage(`Maximum of ${MAX_PAGES} pages allowed.`);
      return;
    }

    const isDuplicate = selectedPages.some((p) => p.url === currentTab.url);
    if (isDuplicate) {
      setStatusMessage("This page is already in your comparison.");
      return;
    }

    setIsExtracting(true);
    setStatusMessage(null);

    try {
      // Execute in-tab DOM extraction directly via PageExtractor
      const results = await chrome.scripting.executeScript({
        target: { tabId: currentTab.id },
        func: extractPageContent
      });

      let extractedData: ExtractedPageResult | null = null;
      if (results && results[0] && results[0].result) {
        extractedData = results[0].result;
      }

      if (!extractedData || !extractedData.importantText || extractedData.importantText.trim().length === 0) {
        throw new Error("We couldn't extract enough information from this page.");
      }

      const snapshot: PageSnapshot = {
        id: `page-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: extractedData.title || currentTab.title || "Untitled Page",
        url: extractedData.url || currentTab.url,
        domain: extractedData.domain || getDomain(currentTab.url),
        description: extractedData.description || null,
        structuredData: extractedData.structuredData || null,
        importantText: extractedData.importantText,
        capturedAt: new Date().toISOString(),
        addedAt: new Date().toISOString()
      };

      const updated = [...selectedPages, snapshot];
      setSelectedPages(updated);
      await chrome.storage.local.set({ selectedPages: updated });
    } catch (err: any) {
      console.error("Extraction error:", err);
      setStatusMessage("We couldn't extract enough information from this page.");
    } finally {
      setIsExtracting(false);
    }
  };

  const handleDismissPrivacy = async () => {
    setHasSeenPrivacy(true);
    await chrome.storage.local.set({ hasSeenPrivacy: true });
  };

  const handleRemovePage = async (id: string) => {
    const updated = selectedPages.filter((p) => p.id !== id);
    setSelectedPages(updated);
    await chrome.storage.local.set({ selectedPages: updated });
  };

  const handleClearAll = async () => {
    setSelectedPages([]);
    await chrome.storage.local.remove(["selectedPages", "pendingComparison", "lastComparisonResult"]);
  };

  const handleLaunchComparison = async () => {
    if (selectedPages.length < MIN_PAGES) {
      setStatusMessage("Add at least one more page to compare.");
      return;
    }

    try {
      // Clear previous comparison cache to force fresh run
      await chrome.storage.local.remove(["lastComparisonResult"]);

      // Set pending comparison state
      await chrome.storage.local.set({
        pendingComparison: {
          pages: selectedPages,
          goal: goal.trim() || null,
          timestamp: Date.now()
        }
      });

      // Open dedicated full-tab results window
      const resultsUrl = chrome.runtime.getURL("src/results/index.html");
      await chrome.tabs.create({ url: resultsUrl });

      // Close popup window
      window.close();
    } catch (err: any) {
      console.error("Failed to launch comparison:", err);
      setStatusMessage("Failed to open comparison tab.");
    }
  };

  const isCurrentRestricted = !currentTab?.url || isRestrictedUrl(currentTab.url);
  const isCurrentAdded = !!currentTab?.url && selectedPages.some((p) => p.url === currentTab.url);
  const isMaxReached = selectedPages.length >= MAX_PAGES;

  return (
    <div className={styles.container}>
      {/* Header */}
      <div className={styles.titleRow}>
        <h1 className={styles.title}>Compare Anything</h1>
        <span className={styles.pageCountBadge}>{selectedPages.length} / {MAX_PAGES}</span>
      </div>

      {/* First-use Privacy Notice (SPEC Section 25) */}
      {!hasSeenPrivacy && (
        <div style={{
          backgroundColor: "#f0f9ff",
          border: "1px solid #bae6fd",
          borderRadius: "8px",
          padding: "10px 12px",
          marginBottom: "12px",
          fontSize: "12px",
          color: "#0369a1",
          lineHeight: "1.45"
        }}>
          <div style={{ fontWeight: 700, marginBottom: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
            🔒 Privacy Disclosure
          </div>
          Compare Anything extracts relevant text from webpages you explicitly add. When you click Compare, that extracted information is securely sent to our server and AI provider to generate the comparison.
          <div style={{ marginTop: "8px", textAlign: "right" }}>
            <button
              onClick={handleDismissPrivacy}
              style={{
                background: "#0284c7",
                color: "#ffffff",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "11px",
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              I Understand
            </button>
          </div>
        </div>
      )}

      {/* Current Page Snapshot Card */}
      <div className={styles.currentPageCard}>
        <p className={styles.sectionLabel}>Active Tab</p>
        {isLoadingTab ? (
          <p className={styles.currentDomain}>Detecting active tab...</p>
        ) : isCurrentRestricted ? (
          <div>
            <p className={styles.currentTitle}>{currentTab?.title || "System Page"}</p>
            <p className={styles.currentDomain}>System and protected pages cannot be compared</p>
            <button className={`${styles.btn} ${styles.btnAdd}`} disabled>
              Cannot Add System Page
            </button>
          </div>
        ) : (
          <div>
            <p className={styles.currentTitle} title={currentTab?.title}>
              {currentTab?.title || "Untitled Webpage"}
            </p>
            <p className={styles.currentDomain}>{getDomain(currentTab?.url)}</p>
            <button
              className={`${styles.btn} ${styles.btnAdd}`}
              onClick={handleAddCurrentPage}
              disabled={isExtracting || isCurrentAdded || isMaxReached}
            >
              {isExtracting
                ? "Extracting page..."
                : isCurrentAdded
                  ? "✓ Already Added"
                  : isMaxReached
                    ? "Max 4 Pages Reached"
                    : "+ ADD TO COMPARISON"}
            </button>
          </div>
        )}
      </div>

      {/* Selected Pages List */}
      <div className={styles.selectedHeader}>
        <h3 className={styles.selectedTitle}>Selected Pages</h3>
      </div>

      {selectedPages.length === 0 ? (
        <div className={styles.emptyState}>
          No pages added yet. Click <strong>+ ADD TO COMPARISON</strong> to start.
        </div>
      ) : (
        <div className={styles.cardList}>
          {selectedPages.map((page, index) => (
            <div key={page.id} className={styles.pageCard}>
              <div className={styles.cardMeta}>
                <span className={styles.cardPageNumber}>Page {index + 1}</span>
                <p className={styles.cardTitle} title={page.title}>{page.title}</p>
                <span className={styles.cardDomain}>{page.domain || getDomain(page.url || "")}</span>
              </div>
              <button
                className={styles.btnRemove}
                onClick={() => handleRemovePage(page.id)}
                title="Remove this page"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}

      {/* User Goal Input */}
      <div className={styles.goalSection}>
        <label className={styles.goalLabel} htmlFor="goal-input">
          What matters to you? (Optional)
        </label>
        <textarea
          id="goal-input"
          className={styles.goalInput}
          placeholder="e.g. Best price-to-performance, battery life, portability"
          value={goal}
          onChange={handleGoalChange}
        />
      </div>

      {/* Status or Error Message */}
      {statusMessage && (
        <div style={{ color: "#e11d48", fontSize: "12px", marginBottom: "10px", fontWeight: 500 }}>
          ⚠️ {statusMessage}
        </div>
      )}

      {/* Action Buttons */}
      <button
        className={`${styles.btn} ${styles.btnCompare}`}
        onClick={handleLaunchComparison}
        disabled={selectedPages.length < MIN_PAGES}
      >
        COMPARE {selectedPages.length} {selectedPages.length === 1 ? "PAGE" : "PAGES"}
      </button>

      {selectedPages.length > 0 && (
        <button className={`${styles.btn} ${styles.btnClear}`} onClick={handleClearAll}>
          Clear All
        </button>
      )}
    </div>
  );
};

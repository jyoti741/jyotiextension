import React, { useEffect, useState } from "react";
import { CompareResponse, PageSnapshot } from "../types/comparison";
import { comparePages, ApiError } from "../services/apiClient";
import { copyComparisonMarkdown, downloadComparisonCsv, startNewComparison } from "./utils/exportUtils";
import { downloadComparisonPng } from "./utils/pngExport";
import { LoadingSkeleton } from "./components/LoadingSkeleton";
import { VerdictBanner } from "./components/VerdictBanner";
import { ComparisonTable } from "./components/ComparisonTable";
import { BestForGrid } from "./components/BestForGrid";
import { KeyDifferences } from "./components/KeyDifferences";
import { MissingInfoNotice } from "./components/MissingInfoNotice";
import { SourcesFooter } from "./components/SourcesFooter";
import styles from "./ResultsApp.module.css";

interface PendingComparison {
  pages: PageSnapshot[];
  goal?: string | null;
  timestamp?: number;
}

export const ResultsApp: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CompareResponse | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [isGeneratingPng, setIsGeneratingPng] = useState<boolean>(false);
  const [pngStatus, setPngStatus] = useState<string | null>(null);

  useEffect(() => {
    loadComparison();
  }, []);

  const loadComparison = async () => {
    setLoading(true);
    setError(null);

    try {
      // 1. Check if we already have a cached/previous result in storage
      const storage = await chrome.storage.local.get(["lastComparisonResult", "pendingComparison"]);

      if (storage.lastComparisonResult) {
        setData(storage.lastComparisonResult);
        setLoading(false);
        return;
      }

      // 2. Fetch pending comparison request payload
      const pending: PendingComparison | undefined = storage.pendingComparison;

      if (!pending || !pending.pages || pending.pages.length < 2) {
        setError("No pending comparison found. Please select 2 to 4 pages from the extension popup.");
        setLoading(false);
        return;
      }

      // 3. Execute backend comparison request
      const response = await comparePages(pending.pages, pending.goal);

      setData(response);
      await chrome.storage.local.set({ lastComparisonResult: response });
    } catch (err: any) {
      console.error("Comparison execution error:", err);
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError(err?.message || "An unexpected error occurred while generating the comparison.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!data) return;
    try {
      await copyComparisonMarkdown(data);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      alert("Unable to copy to clipboard.");
    }
  };

  const handleDownloadCsv = () => {
    if (!data) return;
    downloadComparisonCsv(data);
  };

  const handleSharePng = async () => {
    if (!data || isGeneratingPng) return;
    setIsGeneratingPng(true);
    setPngStatus("Generating...");
    try {
      const result = await downloadComparisonPng(data);
      if (result.copied) {
        setPngStatus("✓ Saved & Copied!");
      } else {
        setPngStatus("✓ PNG Saved!");
      }
      setTimeout(() => setPngStatus(null), 2500);
    } catch (err) {
      console.error("PNG export error:", err);
      alert("Unable to generate PNG comparison report.");
      setPngStatus(null);
    } finally {
      setIsGeneratingPng(false);
    }
  };

  const handleReset = async () => {
    if (confirm("Clear this comparison and start a new one?")) {
      await startNewComparison();
      window.close();
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <LoadingSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.errorContainer}>
          <div className={styles.errorIcon}>⚠️</div>
          <h2 className={styles.errorTitle}>Comparison Could Not Be Completed</h2>
          <p className={styles.errorMessage}>{error}</p>
          <div className={styles.controls} style={{ justifyContent: "center" }}>
            <button className={`${styles.btn} ${styles.btnPrimary}`} onClick={loadComparison}>
              Retry Comparison
            </button>
            <button className={styles.btn} onClick={handleReset}>
              Start New Comparison
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className={styles.container}>
      {/* Header & Export Controls */}
      <header className={styles.header}>
        <div className={styles.titleArea}>
          <div className={styles.titleRow}>
            <h1 className={styles.mainTitle}>{data.comparisonTitle || "Comparison Report"}</h1>
            <span className={styles.typeBadge}>{data.comparisonType || "Product Comparison"}</span>
          </div>

          {data.goal && (
            <div className={styles.goalPill}>
              <span className={styles.goalLabel}>Your priority:</span>
              <span>{data.goal}</span>
            </div>
          )}
        </div>

        <div className={styles.controls}>
          <button
            className={`${styles.btn} ${styles.btnShare}`}
            onClick={handleSharePng}
            disabled={isGeneratingPng}
            title="Generate a clean shareable PNG locally and copy to clipboard"
          >
            {pngStatus || "📸 Share Comparison"}
          </button>
          <button className={styles.btn} onClick={handleCopy} title="Copy Markdown table to clipboard">
            {copied ? "✓ Copied!" : "📋 Copy Markdown"}
          </button>
          <button className={styles.btn} onClick={handleDownloadCsv} title="Download comparison as CSV spreadsheet">
            📥 Download CSV
          </button>
          <button className={`${styles.btn} ${styles.btnDanger}`} onClick={handleReset} title="Clear comparison and close">
            ✕ Start New
          </button>
        </div>
      </header>

      {/* Main Dashboard Layout */}
      <main>
        {/* Quick Verdict Banner */}
        <VerdictBanner bestOverall={data.bestOverall} items={data.items} />

        {/* Multi-Column Comparison Table with Sticky Criteria */}
        <ComparisonTable items={data.items} criteria={data.criteria} />

        {/* Best For Scenario Grid */}
        <BestForGrid bestFor={data.bestFor} items={data.items} />

        {/* Key Differences Bulleted List */}
        <KeyDifferences differences={data.keyDifferences} />

        {/* Missing or Undisclosed Information */}
        <MissingInfoNotice missingInfo={data.missingInformation} items={data.items} />

        {/* Evaluated Sources Footer */}
        <SourcesFooter sources={data.sources} items={data.items} />
      </main>
    </div>
  );
};

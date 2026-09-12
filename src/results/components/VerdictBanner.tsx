import React from "react";
import { BestOverall, ItemSummary } from "../../types/comparison";
import styles from "../ResultsApp.module.css";

interface VerdictBannerProps {
  bestOverall: BestOverall | null | undefined;
  items: ItemSummary[];
}

export const VerdictBanner: React.FC<VerdictBannerProps> = ({ bestOverall, items }) => {
  // 1. Resolve winner item robustly across ID, displayName, or partial text matches
  let winnerName: string | null = null;

  if (bestOverall?.itemId && bestOverall.itemId !== "null" && bestOverall.itemId !== "none") {
    const rawId = bestOverall.itemId.trim().toLowerCase();
    const matchedItem = items.find(
      (i) =>
        i.id.toLowerCase() === rawId ||
        i.displayName.toLowerCase() === rawId ||
        i.displayName.toLowerCase().includes(rawId) ||
        rawId.includes(i.displayName.toLowerCase())
    );

    winnerName = matchedItem ? matchedItem.displayName : bestOverall.itemId;
  }

  // 2. Fallback: If itemId was null or omitted, check if any item is explicitly named in the reason
  if (!winnerName && bestOverall?.reason) {
    const foundInReason = items.find((i) =>
      bestOverall.reason.toLowerCase().includes(i.displayName.toLowerCase())
    );
    if (foundInReason) {
      winnerName = foundInReason.displayName;
    }
  }

  const hasWinner = Boolean(winnerName);

  return (
    <div className={`${styles.verdictCard} ${hasWinner ? styles.verdictWinner : styles.verdictNeutral}`}>
      <div className={styles.verdictHeader}>
        <div className={styles.verdictBadge}>{hasWinner ? "Quick Verdict" : "Balanced Trade-off"}</div>
        <h2 className={styles.winnerName}>
          {hasWinner ? (
            <>
              Best overall: <span style={{ color: "#166534" }}>{winnerName}</span>
            </>
          ) : (
            <span style={{ color: "#1e293b" }}>
              {bestOverall?.reason?.toLowerCase().startsWith("no clear winner")
                ? bestOverall.reason.split("—")[0].trim()
                : "No clear winner"}
            </span>
          )}
        </h2>
      </div>

      <p className={styles.verdictReason}>
        {bestOverall?.reason ||
          (hasWinner
            ? `Based on the provided information, ${winnerName} offers the strongest overall combination of features and value.`
            : "No clear winner — depends on your specific priorities and tradeoffs between the compared options.")}
      </p>
    </div>
  );
};

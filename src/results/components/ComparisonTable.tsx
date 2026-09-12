import React from "react";
import { CriterionEvaluation, CriterionValue, ItemSummary } from "../../types/comparison";
import { formatValue } from "../utils/exportUtils";
import styles from "../ResultsApp.module.css";

interface ComparisonTableProps {
  items: ItemSummary[];
  criteria: CriterionEvaluation[];
}

export const ComparisonTable: React.FC<ComparisonTableProps> = ({ items, criteria }) => {
  if (!criteria || criteria.length === 0) {
    return <div className={styles.emptyNotice}>No criteria available for this comparison.</div>;
  }

  // Resolves objective rating: "Best", "Better", or "Good" (no winner declaration)
  const getRating = (
    valObj: CriterionValue | undefined,
    crit: CriterionEvaluation,
    itemId: string
  ): "Best" | "Better" | "Good" | null => {
    const displayVal = formatValue(valObj?.value);
    if (displayVal === "Not stated") return null;

    // 1. If explicit rating provided by backend
    if (valObj?.rating) {
      const r = valObj.rating.trim().toLowerCase();
      if (r === "best") return "Best";
      if (r === "better") return "Better";
      if (r === "good") return "Good";
    }

    // 2. Relative ranking:
    const isTop = crit.winnerItemIds?.includes(itemId);
    if (isTop) return "Best";

    // When 3 or 4 items are compared:
    if (items.length >= 3) {
      // Items with higher confidence and stated values get Better
      const conf = valObj?.confidence?.toLowerCase();
      return conf === "high" ? "Better" : "Good";
    }

    // When 2 items are compared:
    return "Good";
  };

  return (
    <div className={styles.sectionContainer}>
      <h3 className={styles.sectionHeading}>Comparison</h3>
      <div className={styles.tableWrapper}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th className={styles.stickyColumnHeader}>Feature</th>
              {items.map((item) => (
                <th key={item.id} className={styles.itemColumnHeader}>
                  <div className={styles.itemTitle}>{item.displayName}</div>
                  <div className={styles.itemDescription}>{item.shortDescription}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criteria.map((crit, idx) => (
              <tr key={idx} className={styles.criterionRow}>
                {/* Sticky first column */}
                <td className={styles.stickyColumnCell}>
                  <div className={styles.criterionName}>{crit.name}</div>
                  <span
                    className={`${styles.importanceBadge} ${crit.importance?.toLowerCase() === "high"
                        ? styles.importanceHigh
                        : crit.importance?.toLowerCase() === "low"
                          ? styles.importanceLow
                          : styles.importanceMedium
                      }`}
                  >
                    {crit.importance || "Medium"}
                  </span>
                </td>

                {/* Columns for each item */}
                {items.map((item) => {
                  const valObj = crit.values?.find((v) => v.itemId === item.id);
                  const rating = getRating(valObj, crit, item.id);
                  const confidence = valObj?.confidence?.toLowerCase() || "high";
                  const displayValue = formatValue(valObj?.value);

                  return (
                    <td
                      key={item.id}
                      className={`${styles.valueCell} ${rating === "Best"
                          ? styles.cellBest
                          : rating === "Better"
                            ? styles.cellBetter
                            : ""
                        }`}
                    >
                      <div className={styles.valueRow}>
                        <span className={styles.valueText}>{displayValue}</span>
                        {rating && (
                          <span
                            className={`${styles.ratingBadge} ${rating === "Best"
                                ? styles.ratingBest
                                : rating === "Better"
                                  ? styles.ratingBetter
                                  : styles.ratingGood
                              }`}
                          >
                            {rating}
                          </span>
                        )}
                      </div>

                      {displayValue !== "Not stated" && (
                        <span
                          className={`${styles.confidenceIndicator} ${confidence === "low"
                              ? styles.confidenceLow
                              : confidence === "medium"
                                ? styles.confidenceMedium
                                : styles.confidenceHigh
                            }`}
                          title={`Confidence: ${valObj?.confidence || "High"}`}
                        >
                          ● {valObj?.confidence || "High"} confidence
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

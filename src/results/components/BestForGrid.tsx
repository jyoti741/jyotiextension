import React from "react";
import { BestForRecommendation, ItemSummary } from "../../types/comparison";
import styles from "../ResultsApp.module.css";

interface BestForGridProps {
  bestFor: BestForRecommendation[];
  items: ItemSummary[];
}

export const BestForGrid: React.FC<BestForGridProps> = ({ bestFor, items }) => {
  if (!bestFor || bestFor.length === 0) return null;

  return (
    <div className={styles.sectionContainer}>
      <h3 className={styles.sectionHeading}>Best For</h3>
      <div className={styles.bestForGrid}>
        {bestFor.map((rec, idx) => {
          const item = items.find((i) => i.id === rec.itemId);
          return (
            <div key={idx} className={styles.bestForCard}>
              <div className={styles.bestForTag}>{rec.label}</div>
              <h4 className={styles.bestForItemName}>{item?.displayName || rec.itemId}</h4>
              <p className={styles.bestForReason}>{rec.reason}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
};

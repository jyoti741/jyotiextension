import React from "react";
import { ItemSummary, MissingInformation } from "../../types/comparison";
import styles from "../ResultsApp.module.css";

interface MissingInfoNoticeProps {
  missingInfo: MissingInformation[];
  items: ItemSummary[];
}

export const MissingInfoNotice: React.FC<MissingInfoNoticeProps> = ({ missingInfo, items }) => {
  const filtered = missingInfo?.filter((m) => m.fields && m.fields.length > 0);
  if (!filtered || filtered.length === 0) return null;

  return (
    <div className={styles.sectionContainer}>
      <h3 className={styles.sectionHeading}>Missing Information</h3>
      <div className={styles.missingInfoContainer}>
        {filtered.map((itemMissing, idx) => {
          const item = items.find((i) => i.id === itemMissing.itemId);
          return (
            <div key={idx} className={styles.missingItemCard}>
              <div className={styles.missingItemTitle}>{item?.displayName || itemMissing.itemId}:</div>
              <ul className={styles.missingFieldsList}>
                {itemMissing.fields.map((field, fIdx) => (
                  <li key={fIdx} className={styles.missingFieldBadge}>
                    • {field}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
    </div>
  );
};

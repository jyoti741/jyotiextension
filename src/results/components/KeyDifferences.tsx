import React from "react";
import styles from "../ResultsApp.module.css";

interface KeyDifferencesProps {
  differences: string[];
}

export const KeyDifferences: React.FC<KeyDifferencesProps> = ({ differences }) => {
  if (!differences || differences.length === 0) return null;

  return (
    <div className={styles.sectionContainer}>
      <h3 className={styles.sectionHeading}>Important Differences</h3>
      <ul className={styles.differencesList}>
        {differences.map((diff, idx) => (
          <li key={idx} className={styles.differenceItem}>
            <span className={styles.differenceBullet}>•</span>
            <span>{diff}</span>
          </li>
        ))}
      </ul>
    </div>
  );
};

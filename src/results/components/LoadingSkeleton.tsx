import React, { useEffect, useState } from "react";
import styles from "../ResultsApp.module.css";

const STAGES = [
  "Reading snapshot data...",
  "Isolating factual metrics and untrusted content...",
  "Analyzing criteria and differentiators...",
  "Generating structured comparison matrix...",
];

export const LoadingSkeleton: React.FC = () => {
  const [stageIndex, setStageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStageIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : prev));
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={styles.loadingContainer}>
      <div className={styles.stageIndicator}>
        <div className={styles.spinner}></div>
        <div>
          <h3 className={styles.stageTitle}>{STAGES[stageIndex]}</h3>
          <p className={styles.stageSubtitle}>
            Our zero-persistence AI engine is synthesizing your selected pages without saving any content.
          </p>
        </div>
      </div>

      <div className={styles.skeletonCard}>
        <div className={`${styles.skeletonLine} ${styles.skeletonWide}`}></div>
        <div className={`${styles.skeletonLine} ${styles.skeletonMedium}`}></div>
      </div>

      <div className={styles.skeletonTable}>
        <div className={styles.skeletonRow}>
          <div className={styles.skeletonHeader}></div>
          <div className={styles.skeletonCell}></div>
          <div className={styles.skeletonCell}></div>
          <div className={styles.skeletonCell}></div>
        </div>
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={styles.skeletonRow}>
            <div className={styles.skeletonHeaderCell}></div>
            <div className={styles.skeletonCell}></div>
            <div className={styles.skeletonCell}></div>
            <div className={styles.skeletonCell}></div>
          </div>
        ))}
      </div>
    </div>
  );
};

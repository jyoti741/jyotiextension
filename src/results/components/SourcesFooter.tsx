import React from "react";
import { ItemSummary, SourceAttribution } from "../../types/comparison";
import styles from "../ResultsApp.module.css";

interface SourcesFooterProps {
  sources: SourceAttribution[];
  items: ItemSummary[];
}

export const SourcesFooter: React.FC<SourcesFooterProps> = ({ sources, items }) => {
  if (!sources || sources.length === 0) return null;

  return (
    <footer className={styles.sourcesFooter}>
      <h4 className={styles.sourcesTitle}>Sources</h4>
      <div className={styles.sourcesGrid}>
        {sources.map((src, idx) => {
          const item = items.find((i) => i.id === src.itemId);
          const name = item?.displayName || src.itemId;
          return (
            <div key={idx} className={styles.sourceItem}>
              {src.url ? (
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.sourceLink}
                  title={src.url}
                >
                  [Open {name} page]
                </a>
              ) : (
                <span className={styles.sourceText}>[Open {name} page]</span>
              )}
            </div>
          );
        })}
      </div>
    </footer>
  );
};

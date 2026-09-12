import { CompareResponse } from "../../types/comparison";

/**
 * Ensures any null, undefined, or empty value displays as "Not stated".
 */
export function formatValue(val: string | null | undefined): string {
  if (val === null || val === undefined || val.trim() === "" || val === "null" || val === "undefined" || val === "NaN") {
    return "Not stated";
  }
  return val.trim();
}

/**
 * Formats a clean Markdown document of the comparison results and copies it to clipboard.
 */
export async function copyComparisonMarkdown(data: CompareResponse): Promise<void> {
  const lines: string[] = [];

  lines.push(`# ${data.comparisonTitle || "Comparison Report"}`);
  lines.push(`**Type:** ${data.comparisonType || "Product Comparison"}`);
  if (data.goal) {
    lines.push(`**Goal:** ${data.goal}`);
  }
  lines.push("");

  // Verdict Section
  lines.push("## Quick Verdict");
  if (data.bestOverall?.itemId) {
    const winner = data.items.find((i) => i.id === data.bestOverall?.itemId);
    lines.push(`🏆 **Best Overall:** ${winner?.displayName || data.bestOverall.itemId}`);
    lines.push(`> ${data.bestOverall.reason}`);
  } else {
    lines.push(`⚖️ **No Clear Winner:** ${data.bestOverall?.reason || "Evidence is evenly balanced across the evaluated items."}`);
  }
  lines.push("");

  // Best For
  if (data.bestFor && data.bestFor.length > 0) {
    lines.push("### Scenario Recommendations");
    data.bestFor.forEach((bf) => {
      const item = data.items.find((i) => i.id === bf.itemId);
      lines.push(`- **${bf.label}:** ${item?.displayName || bf.itemId} — ${bf.reason}`);
    });
    lines.push("");
  }

  // Comparison Matrix Table
  lines.push("## Detailed Comparison Matrix");
  const headers = ["Criterion", "Importance", ...data.items.map((i) => i.displayName)];
  lines.push(`| ${headers.join(" | ")} |`);
  lines.push(`| ${headers.map(() => "---").join(" | ")} |`);

  data.criteria.forEach((crit) => {
    const row = [crit.name, crit.importance];
    data.items.forEach((item) => {
      const valObj = crit.values.find((v) => v.itemId === item.id);
      const val = formatValue(valObj?.value);
      const rating = valObj?.rating || (crit.winnerItemIds?.includes(item.id) && val !== "Not stated" ? "Best" : (val !== "Not stated" ? "Good" : ""));
      row.push(rating ? `${val} [${rating}]` : val);
    });
    lines.push(`| ${row.join(" | ")} |`);
  });
  lines.push("");

  // Key Differences
  if (data.keyDifferences && data.keyDifferences.length > 0) {
    lines.push("## Key Differentiators");
    data.keyDifferences.forEach((diff) => lines.push(`- ${diff}`));
    lines.push("");
  }

  // Missing Information
  if (data.missingInformation && data.missingInformation.length > 0) {
    lines.push("## Missing or Undisclosed Information");
    data.missingInformation.forEach((mi) => {
      const item = data.items.find((i) => i.id === mi.itemId);
      lines.push(`- **${item?.displayName || mi.itemId}:** ${mi.fields.join(", ") || "None"}`);
    });
    lines.push("");
  }

  // Sources
  if (data.sources && data.sources.length > 0) {
    lines.push("## Sources Evaluated");
    data.sources.forEach((src) => {
      const item = data.items.find((i) => i.id === src.itemId);
      lines.push(`- **${item?.displayName || src.itemId}:** [${src.domain || src.url || "Open Webpage"}](${src.url || "#"})`);
    });
  }

  const markdownText = lines.join("\n");
  await navigator.clipboard.writeText(markdownText);
}

/**
 * Generates and downloads a valid RFC-4180 CSV blob containing criteria and item evaluations.
 */
export function downloadComparisonCsv(data: CompareResponse): void {
  const rows: string[][] = [];

  // Metadata rows
  rows.push(["Comparison Title", data.comparisonTitle]);
  rows.push(["Type", data.comparisonType]);
  if (data.goal) {
    rows.push(["User Goal", data.goal]);
  }
  rows.push([]);

  // Verdict
  if (data.bestOverall?.itemId) {
    const winner = data.items.find((i) => i.id === data.bestOverall?.itemId);
    rows.push(["Best Overall Winner", winner?.displayName || data.bestOverall.itemId]);
    rows.push(["Verdict Reason", data.bestOverall.reason]);
  } else {
    rows.push(["Best Overall Winner", "No Clear Winner"]);
    rows.push(["Verdict Reason", data.bestOverall?.reason || "Evidence is balanced."]);
  }
  rows.push([]);

  // Table header
  const headerRow = ["Feature", "Importance", ...data.items.map((i) => i.displayName)];
  rows.push(headerRow);

  // Criteria rows
  data.criteria.forEach((crit) => {
    const row: string[] = [crit.name, crit.importance];

    data.items.forEach((item) => {
      const valObj = crit.values.find((v) => v.itemId === item.id);
      const val = formatValue(valObj?.value);
      const rating = valObj?.rating || (crit.winnerItemIds?.includes(item.id) && val !== "Not stated" ? "Best" : (val !== "Not stated" ? "Good" : ""));
      row.push(rating ? `${val} (${rating})` : val);
    });

    rows.push(row);
  });

  // Convert to CSV with proper escaping
  const csvContent = rows
    .map((row) =>
      row
        .map((cell) => {
          const str = (cell ?? "").toString();
          if (str.includes(",") || str.includes('"') || str.includes("\n")) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        })
        .join(",")
    )
    .join("\r\n");

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  const filename = `${(data.comparisonTitle || "comparison").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}

/**
 * Clears comparison data in storage and closes or resets the tab.
 */
export async function startNewComparison(): Promise<void> {
  try {
    await chrome.storage.local.remove(["selectedPages", "pendingComparison", "lastComparisonResult"]);
  } catch (err) {
    console.warn("Storage clearing error:", err);
  }
}

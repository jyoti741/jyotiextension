import { CompareResponse, CriterionEvaluation, ItemSummary } from "../../types/comparison";
import { formatValue } from "./exportUtils";

/**
 * Utility to wrap text onto multiple lines on an HTML5 canvas context.
 */
function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let currentLine = "";

  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = ctx.measureText(testLine).width;

    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Utility to draw rounded rectangles on HTML5 canvas.
 */
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth = 1
): void {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

/**
 * Resolves rating: "Best" | "Better" | "Good" | null
 */
function getRating(
  crit: CriterionEvaluation,
  itemId: string,
  value: string,
  totalItems: number
): "Best" | "Better" | "Good" | null {
  if (value === "Not stated" || !value) return null;

  const valObj = crit.values?.find((v) => v.itemId === itemId);
  if (valObj?.rating) {
    const r = valObj.rating.trim().toLowerCase();
    if (r === "best") return "Best";
    if (r === "better") return "Better";
    if (r === "good") return "Good";
  }

  const isTop = crit.winnerItemIds?.includes(itemId);
  if (isTop) return "Best";

  if (totalItems >= 3) {
    return valObj?.confidence?.toLowerCase() === "high" ? "Better" : "Good";
  }

  return "Good";
}

/**
 * Generates a clean, high-resolution shareable comparison PNG image completely locally via HTML5 Canvas.
 */
export async function generateComparisonPng(data: CompareResponse): Promise<Blob> {
  const logicalWidth = 1040;
  const padding = 36;
  const contentWidth = logicalWidth - padding * 2;

  // Measurement canvas to calculate required dynamic height
  const testCanvas = document.createElement("canvas");
  const testCtx = testCanvas.getContext("2d")!;
  testCtx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

  // 1. Calculate Verdict card height
  let winnerName = "Balanced / No single winner";
  if (data.bestOverall?.itemId) {
    const raw = data.bestOverall.itemId.trim().toLowerCase();
    const matched = data.items.find(
      (i) =>
        i.id.toLowerCase() === raw ||
        i.displayName.toLowerCase() === raw ||
        i.displayName.toLowerCase().includes(raw)
    );
    winnerName = matched ? matched.displayName : data.bestOverall.itemId;
  } else if (data.items.length > 0) {
    winnerName = data.items[0].displayName;
  }

  const verdictReasonText =
    data.bestOverall?.reason ||
    `Based on the provided information, ${winnerName} offers the strongest overall combination of features.`;
  testCtx.font = "14px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const verdictReasonLines = wrapText(testCtx, verdictReasonText, contentWidth - 40);
  const verdictCardHeight = 68 + verdictReasonLines.length * 20;

  // 2. Calculate Table height
  const rowHeight = 44;
  const tableHeaderHeight = 54;
  const tableHeight = tableHeaderHeight + data.criteria.length * rowHeight;

  // 3. Calculate Best For height
  let bestForHeight = 0;
  if (data.bestFor && data.bestFor.length > 0) {
    bestForHeight = 54 + Math.ceil(data.bestFor.length / 3) * 60;
  }

  // 4. Calculate Key Differences height
  let differencesHeight = 0;
  if (data.keyDifferences && data.keyDifferences.length > 0) {
    differencesHeight = 48 + data.keyDifferences.slice(0, 4).length * 24;
  }

  // Total logical height
  const logicalHeight =
    padding +
    100 + // Header Area
    verdictCardHeight +
    24 + // Margin
    38 + // Table Section Heading
    tableHeight +
    (bestForHeight ? 24 + bestForHeight : 0) +
    (differencesHeight ? 24 + differencesHeight : 0) +
    60 + // Footer
    padding;

  // Render on 2x Scale Canvas for Crisp Retina Quality
  const scale = 2;
  const canvas = document.createElement("canvas");
  canvas.width = logicalWidth * scale;
  canvas.height = logicalHeight * scale;

  const ctx = canvas.getContext("2d")!;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // Main Card Background Container
  drawRoundedRect(
    ctx,
    padding / 2,
    padding / 2,
    logicalWidth - padding,
    logicalHeight - padding,
    16,
    "#ffffff",
    "#e2e8f0",
    1.5
  );

  let curY = padding + 12;

  // --- TOP HEADER ---
  // Compare Anything Brand Badge
  drawRoundedRect(ctx, padding, curY, 130, 24, 6, "#2563eb");
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("COMPARE ANYTHING", padding + 12, curY + 16);

  // Type Pill
  const typeText = data.comparisonType || "Product Comparison";
  drawRoundedRect(ctx, padding + 138, curY, 140, 24, 6, "#f1f5f9", "#cbd5e1");
  ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText(typeText, padding + 148, curY + 16);

  curY += 38;

  // Comparison Title
  ctx.font = "bold 22px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText(data.comparisonTitle || "Comparison Report", padding, curY);

  curY += 26;

  // Priority Pill (if set)
  if (data.goal) {
    ctx.font = "12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    const goalText = `Your priority: ${data.goal}`;
    const goalWidth = Math.min(ctx.measureText(goalText).width + 24, contentWidth);
    drawRoundedRect(ctx, padding, curY, goalWidth, 26, 6, "#eff6ff", "#bfdbfe");
    ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#1d4ed8";
    ctx.fillText(goalText, padding + 12, curY + 18);
    curY += 38;
  } else {
    curY += 12;
  }

  // --- QUICK VERDICT BANNER ---
  drawRoundedRect(ctx, padding, curY, contentWidth, verdictCardHeight, 12, "#f0fdf4", "#bbf7d0", 1.5);

  // Verdict Badge
  drawRoundedRect(ctx, padding + 16, curY + 14, 96, 20, 4, "#dcfce7");
  ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#166534";
  ctx.fillText("QUICK VERDICT", padding + 22, curY + 28);

  // Best Overall Winner
  ctx.font = "bold 17px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Best overall: ", padding + 124, curY + 29);

  const bestLabelWidth = ctx.measureText("Best overall: ").width;
  ctx.fillStyle = "#166534";
  ctx.fillText(winnerName, padding + 124 + bestLabelWidth, curY + 29);

  // Reason
  ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#334155";
  let rY = curY + 54;
  for (const line of verdictReasonLines) {
    ctx.fillText(line, padding + 16, rY);
    rY += 20;
  }

  curY += verdictCardHeight + 24;

  // --- COMPARISON TABLE ---
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#0f172a";
  ctx.fillText("Comparison", padding, curY);
  curY += 14;

  // Table geometry
  const colFeatureWidth = 190;
  const remainingWidth = contentWidth - colFeatureWidth;
  const colItemWidth = remainingWidth / data.items.length;

  // Table Outer Frame
  drawRoundedRect(ctx, padding, curY, contentWidth, tableHeight, 8, "#ffffff", "#e2e8f0", 1);

  // Table Header Background
  drawRoundedRect(ctx, padding, curY, contentWidth, tableHeaderHeight, 8, "#f8fafc");
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(padding, curY + tableHeaderHeight - 1, contentWidth, 1);

  // Table Header - Feature Column
  ctx.font = "bold 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#475569";
  ctx.fillText("FEATURE", padding + 16, curY + 32);

  // Table Header - Product Columns
  data.items.forEach((item, idx) => {
    const colX = padding + colFeatureWidth + idx * colItemWidth;
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText(item.displayName, colX + 12, curY + 26);

    ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#64748b";
    const sub = item.shortDescription.length > 28 ? `${item.shortDescription.slice(0, 26)}...` : item.shortDescription;
    ctx.fillText(sub, colX + 12, curY + 42);

    // Column separator
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(colX, curY, 1, tableHeight);
  });

  curY += tableHeaderHeight;

  // Table Rows (Criteria)
  data.criteria.forEach((crit, rIdx) => {
    const rowY = curY + rIdx * rowHeight;

    // Alternating zebra fill
    if (rIdx % 2 === 1) {
      ctx.fillStyle = "#fafbfc";
      ctx.fillRect(padding, rowY, contentWidth, rowHeight);
    }

    // Row divider
    ctx.fillStyle = "#e2e8f0";
    ctx.fillRect(padding, rowY + rowHeight - 1, contentWidth, 1);

    // Feature Name
    ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#1e293b";
    ctx.fillText(crit.name, padding + 16, rowY + 26);

    // Values for each item
    data.items.forEach((item, cIdx) => {
      const colX = padding + colFeatureWidth + cIdx * colItemWidth;
      const valObj = crit.values?.find((v) => v.itemId === item.id);
      const displayVal = formatValue(valObj?.value);
      const rating = getRating(crit, item.id, displayVal, data.items.length);

      // Value text
      ctx.font = "13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = displayVal === "Not stated" ? "#94a3b8" : "#0f172a";
      ctx.fillText(displayVal, colX + 12, rowY + 26);

      // Rating Badge (Best / Better / Good)
      if (rating) {
        const textWidth = ctx.measureText(displayVal).width;
        const badgeX = colX + 16 + textWidth;
        let badgeBg = "#f1f5f9";
        let badgeFg = "#475569";

        if (rating === "Best") {
          badgeBg = "#dcfce7";
          badgeFg = "#166534";
        } else if (rating === "Better") {
          badgeBg = "#e0f2fe";
          badgeFg = "#0369a1";
        }

        drawRoundedRect(ctx, badgeX, rowY + 13, 44, 18, 4, badgeBg);
        ctx.font = "bold 10px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
        ctx.fillStyle = badgeFg;
        ctx.fillText(rating, badgeX + 8, rowY + 26);
      }
    });
  });

  curY += data.criteria.length * rowHeight + 24;

  // --- BEST FOR SECTION ---
  if (data.bestFor && data.bestFor.length > 0) {
    ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    ctx.fillStyle = "#0f172a";
    ctx.fillText("Best For", padding, curY);
    curY += 12;

    const cardWidth = (contentWidth - (data.bestFor.length - 1) * 12) / Math.min(data.bestFor.length, 3);
    data.bestFor.slice(0, 3).forEach((bf, bIdx) => {
      const bx = padding + bIdx * (cardWidth + 12);
      const matched = data.items.find((i) => i.id === bf.itemId);
      const itemName = matched ? matched.displayName : bf.itemId;

      drawRoundedRect(ctx, bx, curY, cardWidth, 52, 8, "#ffffff", "#e2e8f0");
      ctx.font = "bold 11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#2563eb";
      ctx.fillText(bf.label.toUpperCase(), bx + 12, curY + 18);

      ctx.font = "bold 13px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
      ctx.fillStyle = "#0f172a";
      ctx.fillText(itemName, bx + 12, curY + 38);
    });

    curY += 66;
  }

  // --- FOOTER ---
  ctx.fillStyle = "#e2e8f0";
  ctx.fillRect(padding, curY, contentWidth, 1);
  curY += 18;

  ctx.font = "11px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillStyle = "#94a3b8";
  ctx.fillText("Compare Anything • Generated locally via AI inference • Zero cloud storage", padding, curY);

  const dateStr = new Date().toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  const dateWidth = ctx.measureText(dateStr).width;
  ctx.fillText(dateStr, logicalWidth - padding - dateWidth, curY);

  // Return PNG Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("Failed to generate PNG blob from canvas."));
      }
    }, "image/png");
  });
}

/**
 * Downloads the comparison as a PNG image and attempts to copy it to clipboard.
 */
export async function downloadComparisonPng(data: CompareResponse): Promise<{ copied: boolean }> {
  const blob = await generateComparisonPng(data);

  // 1. Trigger PNG File Download
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const filename = `${(data.comparisonTitle || "comparison").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-report.png`;
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 2. Attempt copying image to clipboard for instant pasting
  let copied = false;
  try {
    if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
      copied = true;
    }
  } catch (clipErr) {
    console.warn("Direct clipboard copy of PNG not permitted by browser context:", clipErr);
  }

  return { copied };
}

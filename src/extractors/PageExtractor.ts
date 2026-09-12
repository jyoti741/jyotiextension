/**
 * PageExtractor: Evidence-based DOM extractor for Compare Anything.
 * Fulfills SPEC Section 10 & 11:
 * - Collects URL, domain, page title, meta description, JSON-LD schema.org data
 * - Extracts tables, specification sections, definition lists, visible lists, and text
 * - Strips scripts, styles, navigation menus, ads, cookie banners, and footers
 * - Prioritizes structured data -> tables -> definitions -> headings -> lists -> body
 * - Intelligently truncates to ~3,500 characters
 */

export interface ExtractedPageResult {
  title: string;
  url: string;
  domain: string;
  description: string;
  structuredData: string;
  importantText: string;
}

export function extractPageContent(): ExtractedPageResult {
  const url = window.location.href;
  const domain = window.location.hostname;
  const title = (document.title || "").replace(/\s+/g, " ").trim() || "Untitled Page";

  // 1. Extract Meta Description
  let description = "";
  const metaDesc =
    document.querySelector('meta[name="description"]') ||
    document.querySelector('meta[property="og:description"]') ||
    document.querySelector('meta[name="twitter:description"]');

  if (metaDesc) {
    description = (metaDesc.getAttribute("content") || "").replace(/\s+/g, " ").trim();
  }

  // 2. Extract Schema.org JSON-LD structured data
  const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
  const structuredDataParts: string[] = [];

  jsonLdScripts.forEach((script) => {
    try {
      const raw = script.textContent?.trim();
      if (!raw) return;
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of items) {
        if (!item || typeof item !== "object") continue;

        // Flatten @graph if present
        const graphItems = Array.isArray(item["@graph"]) ? item["@graph"] : [item];
        for (const gItem of graphItems) {
          const type = gItem["@type"] || "Unknown";
          const typeStr = Array.isArray(type) ? type.join(", ") : String(type);

          const summaryParts: string[] = [`Type: ${typeStr}`];
          if (gItem.name) summaryParts.push(`Name: ${gItem.name}`);
          if (gItem.description) summaryParts.push(`Desc: ${gItem.description}`);
          if (gItem.sku) summaryParts.push(`SKU: ${gItem.sku}`);
          if (gItem.brand?.name || typeof gItem.brand === "string") {
            summaryParts.push(`Brand: ${gItem.brand.name || gItem.brand}`);
          }
          if (gItem.offers) {
            const offers = Array.isArray(gItem.offers) ? gItem.offers : [gItem.offers];
            offers.slice(0, 3).forEach((o: any) => {
              const price = o.price || o.lowPrice;
              const currency = o.priceCurrency || "";
              if (price) summaryParts.push(`Price: ${currency} ${price}`.trim());
              if (o.availability) summaryParts.push(`Availability: ${o.availability.split("/").pop()}`);
            });
          }
          if (gItem.aggregateRating) {
            summaryParts.push(`Rating: ${gItem.aggregateRating.ratingValue}/${gItem.aggregateRating.bestRating || 5}`);
          }
          if (gItem.baseSalary) {
            summaryParts.push(`Salary: ${JSON.stringify(gItem.baseSalary)}`);
          }

          if (summaryParts.length > 1) {
            structuredDataParts.push(summaryParts.join(" | "));
          }
        }
      }
    } catch {
      // Ignore invalid JSON-LD blocks
    }
  });

  const structuredData = structuredDataParts.slice(0, 5).join("\n");

  // 3. Prepare clean clone of main document area for text & spec extraction
  const rootElement = document.querySelector("main") || document.querySelector("article") || document.body;
  const clone = rootElement.cloneNode(true) as HTMLElement;

  // Selectors of clutter to remove
  const clutterSelectors = [
    "script",
    "style",
    "noscript",
    "svg",
    "iframe",
    "canvas",
    "nav",
    "header",
    "footer",
    '[aria-hidden="true"]',
    '[role="navigation"]',
    '[role="banner"]',
    '[role="contentinfo"]',
    ".cookie",
    "#cookie",
    '[class*="cookie"]',
    '[id*="cookie"]',
    '[class*="consent"]',
    '[id*="consent"]',
    '[class*="banner"]',
    ".ad",
    ".ads",
    '[class*="advertisement"]',
    '[class*="popup"]',
    '[class*="modal"]',
    '[class*="nav-"]',
    '[class*="menu-"]'
  ];

  clutterSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove());
  });

  // 4. Extract Tables (Prioritized structured specs)
  const tableLines: string[] = [];
  clone.querySelectorAll("table").forEach((table) => {
    const rows = table.querySelectorAll("tr");
    rows.forEach((row) => {
      const cells = Array.from(row.querySelectorAll("th, td"))
        .map((c) => (c.textContent || "").replace(/\s+/g, " ").trim())
        .filter((c) => c.length > 0);

      if (cells.length >= 2) {
        tableLines.push(`${cells[0]}: ${cells.slice(1).join(" | ")}`);
      } else if (cells.length === 1) {
        tableLines.push(cells[0]);
      }
    });
    table.remove(); // Remove table once parsed so it isn't duplicated
  });

  // 5. Extract Definition Lists (<dl>) and Spec Containers
  const specLines: string[] = [];
  clone.querySelectorAll("dl").forEach((dl) => {
    const dts = dl.querySelectorAll("dt");
    const dds = dl.querySelectorAll("dd");
    for (let i = 0; i < Math.min(dts.length, dds.length); i++) {
      const term = (dts[i].textContent || "").replace(/\s+/g, " ").trim();
      const def = (dds[i].textContent || "").replace(/\s+/g, " ").trim();
      if (term && def) specLines.push(`${term}: ${def}`);
    }
    dl.remove();
  });

  clone.querySelectorAll('[class*="spec"], [id*="spec"], [class*="feature"], [class*="attribute"]').forEach((el) => {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 10 && text.length < 500) {
      specLines.push(text);
    }
    el.remove();
  });

  // 6. Extract Headings & Bullet Lists
  const headingListLines: string[] = [];
  clone.querySelectorAll("h1, h2, h3, h4, li").forEach((el) => {
    const text = (el.textContent || "").replace(/\s+/g, " ").trim();
    if (text.length > 0 && text.length < 300) {
      headingListLines.push(el.tagName.toLowerCase() === "li" ? `• ${text}` : `[${text}]`);
    }
    el.remove();
  });

  // 7. Remaining Body Text
  const bodyText = (clone.innerText || clone.textContent || "")
    .replace(/\s+/g, " ")
    .trim();

  // 8. Assemble Content in strict order of priority (Section 10):
  // Structured Data -> Tables -> Specs/DLs -> Headings/Lists -> Body Text
  const sections: string[] = [];

  if (description) {
    sections.push(`SUMMARY: ${description}`);
  }

  if (structuredData) {
    sections.push(`STRUCTURED DATA:\n${structuredData}`);
  }

  if (tableLines.length > 0) {
    sections.push(`SPECIFICATIONS & TABLES:\n${tableLines.slice(0, 30).join("\n")}`);
  }

  if (specLines.length > 0) {
    sections.push(`KEY DETAILS:\n${specLines.slice(0, 20).join("\n")}`);
  }

  if (headingListLines.length > 0) {
    sections.push(`HIGHLIGHTS:\n${headingListLines.slice(0, 25).join("\n")}`);
  }

  if (bodyText) {
    sections.push(`DESCRIPTION & OVERVIEW:\n${bodyText}`);
  }

  const combined = sections.join("\n\n").trim();

  // Intelligent truncation to approximately 3,500 characters (defined inside for executeScript self-containment)
  function truncateIntelligently(text: string, maxCharacters: number): string {
    if (!text || text.length <= maxCharacters) return text || "";

    const targetLimit = maxCharacters - 3;
    const searchStart = Math.max(0, targetLimit - 250);
    const searchChunk = text.substring(searchStart, targetLimit);

    const dotIdx = searchChunk.lastIndexOf(".");
    const exclamIdx = searchChunk.lastIndexOf("!");
    const questIdx = searchChunk.lastIndexOf("?");
    const lastSentence = Math.max(dotIdx, exclamIdx, questIdx);
    if (lastSentence !== -1) {
      return text.substring(0, searchStart + lastSentence + 1).trimEnd() + "...";
    }

    const lastWord = searchChunk.lastIndexOf(" ");
    if (lastWord !== -1) {
      return text.substring(0, searchStart + lastWord).trimEnd() + "...";
    }

    return text.substring(0, targetLimit).trimEnd() + "...";
  }

  const truncatedImportantText = truncateIntelligently(combined, 3500);

  return {
    title,
    url,
    domain,
    description: description || "",
    structuredData: structuredData || "",
    importantText: truncatedImportantText
  };
}

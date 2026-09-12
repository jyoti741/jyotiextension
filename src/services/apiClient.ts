import { CompareRequest, CompareResponse, ApiErrorResponse, PageSnapshot } from "../types/comparison";

const DEFAULT_API_BASE_URL = "http://localhost:5100";

/**
 * Retrieves the persistent installId from chrome.storage.local.
 * If none exists, generates a secure UUID v4 and persists it.
 */
export async function getOrCreateInstallId(): Promise<string> {
  try {
    const data = await chrome.storage.local.get(["installId"]);
    if (data.installId && typeof data.installId === "string") {
      return data.installId;
    }

    const newId = crypto.randomUUID();
    await chrome.storage.local.set({ installId: newId });
    return newId;
  } catch (err) {
    console.warn("Unable to access chrome.storage for installId, generating transient ID:", err);
    return crypto.randomUUID();
  }
}

/**
 * Resolves the backend API base URL, with chrome.storage.local override support.
 */
export async function getApiBaseUrl(): Promise<string> {
  try {
    const data = await chrome.storage.local.get(["apiBaseUrl"]);
    if (data.apiBaseUrl && typeof data.apiBaseUrl === "string") {
      let url = data.apiBaseUrl.trim().replace(/\/+$/, "");
      if (url.length > 0) {
        // Enforce HTTPS for all remote production domains (Security Requirement: HTTPS only in production)
        const isLocal = url.startsWith("http://localhost") || url.startsWith("http://127.0.0.1");
        if (!isLocal) {
          if (url.startsWith("http://")) {
            url = "https://" + url.slice(7);
          } else if (!url.startsWith("https://")) {
            url = "https://" + url;
          }
        }
        return url;
      }
    }
  } catch {
    // Fallback to default
  }
  return DEFAULT_API_BASE_URL;
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code: string = "UNKNOWN_ERROR", status: number = 0, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

/**
 * Executes the POST /api/v1/compare request against the ASP.NET Core AI backend.
 */
export async function comparePages(pages: PageSnapshot[], goal?: string | null): Promise<CompareResponse> {
  if (!navigator.onLine) {
    throw new ApiError(
      "You are currently offline. Please verify your network connection and try again.",
      "NETWORK_OFFLINE",
      0
    );
  }

  const installId = await getOrCreateInstallId();
  const baseUrl = await getApiBaseUrl();
  const endpoint = `${baseUrl}/api/v1/compare`;

  const payload: CompareRequest = {
    installId,
    goal: goal?.trim() || null,
    pages: pages.map((p) => ({
      id: p.id,
      url: p.url ?? null,
      domain: p.domain ?? null,
      title: p.title,
      description: p.description ?? null,
      structuredData: p.structuredData ?? null,
      importantText: p.importantText,
      capturedAt: p.capturedAt || p.addedAt || new Date().toISOString(),
    })),
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Install-Id": installId,
      },
      body: JSON.stringify(payload),
    });
  } catch (netErr: any) {
    throw new ApiError(
      "Compare Anything is temporarily unavailable.",
      "CONNECTION_FAILED",
      0,
      netErr?.message
    );
  }

  if (response.ok) {
    const data: CompareResponse = await response.json();
    return data;
  }

  // Handle specific HTTP error status codes gracefully according to Section 28
  let errorPayload: ApiErrorResponse | null = null;
  try {
    errorPayload = await response.json();
  } catch {
    // Non-JSON response body
  }

  if (response.status === 429) {
    const friendlyMessage =
      errorPayload?.message?.includes("Today's free comparison limit")
        ? errorPayload.message
        : "Free AI capacity is temporarily unavailable.";

    throw new ApiError(friendlyMessage, "RATE_LIMIT_EXCEEDED", 429);
  }

  if (response.status === 400) {
    const isSinglePage =
      pages.length === 1 ||
      errorPayload?.code === "INVALID_PAGE_COUNT" ||
      errorPayload?.message?.includes("one more page");

    const message = isSinglePage
      ? "Add at least one more page to compare."
      : errorPayload?.message || "Comparison requires between 2 and 4 pages.";

    throw new ApiError(message, errorPayload?.code || "VALIDATION_ERROR", 400, errorPayload?.details);
  }

  if (response.status === 502 || response.status === 503 || response.status === 504) {
    const isCapacityIssue = errorPayload?.message?.includes("capacity");
    const message = isCapacityIssue
      ? "Free AI capacity is temporarily unavailable."
      : "Comparison couldn't be generated. Please try again.";

    throw new ApiError(message, errorPayload?.code || "AI_FAILURE", response.status);
  }

  throw new ApiError(
    errorPayload?.message || "Comparison couldn't be generated. Please try again.",
    errorPayload?.code || "SERVER_ERROR",
    response.status,
    errorPayload?.details
  );
}

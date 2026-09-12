export interface PageSnapshot {
  id: string;
  url?: string | null;
  domain?: string | null;
  title: string;
  description?: string | null;
  structuredData?: string | null;
  importantText: string;
  capturedAt: string;
  addedAt?: string;
}


export interface CompareRequest {
  installId: string;
  goal?: string | null;
  pages: PageSnapshot[];
}

export interface ItemSummary {
  id: string;
  displayName: string;
  shortDescription: string;
}

export interface CriterionValue {
  itemId: string;
  value: string;
  confidence: "High" | "Medium" | "Low" | string;
  rating?: "Best" | "Better" | "Good" | string;
}

export interface CriterionEvaluation {
  name: string;
  importance: "High" | "Medium" | "Low" | string;
  values: CriterionValue[];
  winnerItemIds: string[];
}

export interface BestOverall {
  itemId: string | null;
  reason: string;
}

export interface BestForRecommendation {
  label: string;
  itemId: string;
  reason: string;
}

export interface MissingInformation {
  itemId: string;
  fields: string[];
}

export interface SourceAttribution {
  itemId: string;
  url?: string | null;
  domain?: string | null;
}

export interface CompareResponse {
  comparisonTitle: string;
  comparisonType: string;
  goal?: string | null;
  items: ItemSummary[];
  criteria: CriterionEvaluation[];
  bestOverall: BestOverall | null;
  bestFor: BestForRecommendation[];
  keyDifferences: string[];
  missingInformation: MissingInformation[];
  sources: SourceAttribution[];
}

export interface ApiErrorResponse {
  code: string;
  message: string;
  details?: unknown;
}

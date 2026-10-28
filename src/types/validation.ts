export interface ValidationFinding {
  id: string;
  runId: string;
  issueCode: string;
  entityType: string;
  entityRef: string;
  category: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  message: string;
  expectedValue: string | null;
  observedValue: string | null;
  remediation: string;
  createdAt: string;
}

export interface GroundTruthLabel {
  id: string;
  datasetLabel: string;
  anomalyCode: string;
  entityType: string;
  entityRef: string;
  expectedIssue: string;
  description: string;
}

export interface ValidationRunInfo {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  datasetLabel: string;
  checksRun: number;
  findingsCount: number;
  status: string;
  summary: {
    status: string;
    totalFindings: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byIssueCode: Record<string, number>;
  } | null;
}

export interface ValidationLatestResponse {
  run: ValidationRunInfo | null;
  findings: ValidationFinding[];
  labels: GroundTruthLabel[];
}

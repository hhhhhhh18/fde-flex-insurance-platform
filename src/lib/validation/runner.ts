import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CHECKS, type Finding } from "./checks";

export interface GroundTruthEvaluation {
  labels: {
    anomalyCode: string;
    entityType: string;
    entityRef: string;
    expectedIssue: string;
    description: string;
    detected: boolean;
  }[];
  detectedCount: number;
  missedCount: number;
  unlabelledFindings: { issueCode: string; entityRef: string; message: string }[];
  precision: number;
  /** Findings explained by ground truth (can exceed the label count). */
  findingsLinked: number;
  recall: number;
}

export interface ValidationReport {
  runId: string | null;
  datasetLabel: string;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  checksRun: number;
  summary: {
    totalFindings: number;
    bySeverity: Record<string, number>;
    byCategory: Record<string, number>;
    byIssueCode: Record<string, number>;
    status: "PASS" | "FAIL";
  };
  findings: Finding[];
  groundTruth: GroundTruthEvaluation;
}

const zeroCounts = (): Record<string, number> => ({});

const bump = (map: Record<string, number>, key: string) => {
  map[key] = (map[key] ?? 0) + 1;
};

/**
 * Runs every check, then (only for evaluation/reporting) joins the results to the
 * ground-truth labels. Detection itself never reads AnomalyLabel - see checks.ts.
 */
export async function runValidation(options: {
  datasetLabel: string;
  persist?: boolean;
}): Promise<ValidationReport> {
  const startedAt = new Date();

  // Ground truth is scoped by dataset label. When the caller supplies a label
  // that has no labels (for example the UI's default "operational" against a
  // dataset generated as "baseline"), fall back to the label actually present
  // so findings are not reported as unexplained. Detection still never reads
  // these labels - only this evaluation step does.
  let effectiveLabel = options.datasetLabel;
  if (effectiveLabel !== "all") {
    const labelCount = await prisma.anomalyLabel.count({ where: { datasetLabel: effectiveLabel } });
    if (labelCount === 0) {
      const latestLabel = await prisma.anomalyLabel.findFirst({
        orderBy: { createdAt: "desc" },
        select: { datasetLabel: true },
      });
      if (latestLabel) effectiveLabel = latestLabel.datasetLabel;
    }
  }

  const run = options.persist
    ? await prisma.validationRun.create({
        data: { datasetLabel: effectiveLabel, status: "RUNNING" },
      })
    : null;

  const findings: Finding[] = [];
  for (const check of CHECKS) {
    const produced = await check.run();
    findings.push(...produced);
  }

  const labels = await prisma.anomalyLabel.findMany({
    where: effectiveLabel === "all" ? {} : { datasetLabel: effectiveLabel },
    orderBy: [{ anomalyCode: "asc" }, { entityRef: "asc" }],
  });

  // Deterministic, unique finding ids: several checks can legitimately report the
  // same issue code for the same record (e.g. an unpaid AND unauthorised policy).
  findings.sort((a, b) =>
    a.entityRef === b.entityRef
      ? a.issueCode === b.issueCode
        ? a.message.localeCompare(b.message)
        : a.issueCode.localeCompare(b.issueCode)
      : a.entityRef.localeCompare(b.entityRef),
  );
  findings.forEach((finding, index) => {
    finding.findingId = `${finding.issueCode}:${finding.entityRef}:${index}`;
  });

  const labelByKey = new Map<string, (typeof labels)[number]>();
  for (const label of labels) labelByKey.set(`${label.expectedIssue}|${label.entityRef}`, label);

  const matchedFindings = new Set<string>();
  for (const finding of findings) {
    const label = labelByKey.get(`${finding.issueCode}|${finding.entityRef}`);
    if (!label) continue;
    finding.groundTruth = { anomalyCode: label.anomalyCode, expectedIssue: label.expectedIssue };
    matchedFindings.add(finding.findingId);
  }

  const evaluatedLabels = labels.map((label) => ({
    anomalyCode: label.anomalyCode,
    entityType: label.entityType,
    entityRef: label.entityRef,
    expectedIssue: label.expectedIssue,
    description: label.description,
    detected: findings.some((f) => f.issueCode === label.expectedIssue && f.entityRef === label.entityRef),
  }));

  const unlabelled = findings
    .filter((f) => !matchedFindings.has(f.findingId))
    .map((f) => ({ issueCode: f.issueCode, entityRef: f.entityRef, message: f.message }));

  const detectedCount = evaluatedLabels.filter((l) => l.detected).length;
  const bySeverity = zeroCounts();
  const byCategory = zeroCounts();
  const byIssueCode = zeroCounts();
  for (const f of findings) {
    bump(bySeverity, f.severity);
    bump(byCategory, f.category);
    bump(byIssueCode, f.issueCode);
  }

  const finishedAt = new Date();
  const report: ValidationReport = {
    runId: run?.id ?? null,
    datasetLabel: effectiveLabel,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
    checksRun: CHECKS.length,
    summary: {
      totalFindings: findings.length,
      bySeverity,
      byCategory,
      byIssueCode,
      status: findings.length === 0 ? "PASS" : "FAIL",
    },
    findings,
    groundTruth: {
      labels: evaluatedLabels,
      detectedCount,
      missedCount: evaluatedLabels.length - detectedCount,
      unlabelledFindings: unlabelled,
      // Precision counts findings that are explained by an injected anomaly; one
      // anomaly may legitimately surface as more than one finding.
      precision:
        findings.length === 0 ? 1 : Number((matchedFindings.size / findings.length).toFixed(4)),
      findingsLinked: matchedFindings.size,
      recall: evaluatedLabels.length === 0 ? 1 : Number((detectedCount / evaluatedLabels.length).toFixed(4)),
    },
  };

  if (run) {
    await prisma.$transaction(async (tx) => {
      if (findings.length > 0) {
        await tx.validationFinding.createMany({
          data: findings.map((f) => ({
            runId: run.id,
            issueCode: f.issueCode,
            entityType: f.entityType,
            entityRef: f.entityRef,
            category: f.category,
            severity: f.severity as never,
            message: f.message,
            expectedValue: f.expectedValue ?? null,
            observedValue: f.observedValue ?? null,
            remediation: f.remediation,
          })),
        });
      }
      await tx.validationRun.update({
        where: { id: run.id },
        data: {
          finishedAt,
          checksRun: CHECKS.length,
          findingsCount: findings.length,
          status: "COMPLETED",
          summary: report.summary as unknown as Prisma.InputJsonValue,
        },
      });
    });
  }

  return report;
}

export function renderSummary(report: ValidationReport): string {
  const lines = [
    `Validation ${report.summary.status} - ${report.summary.totalFindings} finding(s) across ${report.checksRun} checks in ${report.durationMs}ms`,
  ];
  for (const [severity, count] of Object.entries(report.summary.bySeverity).sort()) {
    lines.push(`  ${severity}: ${count}`);
  }
  if (report.groundTruth.labels.length > 0) {
    lines.push(
      `Ground truth: ${report.groundTruth.detectedCount}/${report.groundTruth.labels.length} injected anomalies detected (recall ${report.groundTruth.recall.toFixed(2)}, precision ${report.groundTruth.precision.toFixed(2)}).`,
    );
    for (const label of report.groundTruth.labels) {
      lines.push(`  [${label.detected ? "HIT " : "MISS"}] ${label.anomalyCode} -> ${label.entityRef}`);
    }
  }
  if (report.groundTruth.unlabelledFindings.length > 0) {
    lines.push("Unlabelled findings:");
    for (const f of report.groundTruth.unlabelledFindings) {
      lines.push(`  ${f.issueCode} ${f.entityRef}: ${f.message}`);
    }
  }
  return lines.join("\n");
}

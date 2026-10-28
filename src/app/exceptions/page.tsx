import { BadgeAlert } from "lucide-react";
import { apiGet } from "@/lib/api-client/server";
import type { ValidationLatestResponse } from "@/types/validation";
import { getActingRole } from "@/lib/session";
import { can } from "@/lib/authz";
import { formatDateTime, formatNumber, humanize } from "@/lib/format";
import { PageHeader } from "@/components/layout/page-header";
import { RefreshButton } from "@/components/dashboard/refresh-button";
import { Badge } from "@/components/ui/badge";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { ExceptionExplorer } from "@/components/exceptions/exception-explorer";
import { RunValidationButton } from "@/components/exceptions/run-validation-button";
import { EmptyState } from "@/components/states/empty-state";
import { ErrorState } from "@/components/states/error-state";

export const metadata = { title: "Exceptions" };

export default async function ExceptionsPage() {
  const [role, result] = await Promise.all([
    getActingRole(),
    apiGet<ValidationLatestResponse>("/api/validation/latest?includeGroundTruth=true"),
  ]);
  const canRun = can(role, "validation:run");

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow="Operations"
        title="Exception explorer"
        description="Validation findings from the latest run, linked to the ground-truth anomalies that were deliberately injected into the synthetic dataset."
        actions={
          <div className="flex items-center gap-2">
            <RefreshButton />
            <RunValidationButton canRun={canRun} />
          </div>
        }
      />

      {!result.ok ? (
        <ErrorState
          title="Validation results could not be loaded"
          description="The validation endpoint did not respond successfully."
          detail={`${result.error} (status ${result.status})`}
          action={<RefreshButton />}
        />
      ) : !result.data.run ? (
        <EmptyState
          title="No validation run recorded"
          description="Run the validator to score the current dataset. It checks identifiers, referential integrity, lifecycle transitions, pricing, coverage limits, overlaps and renewals."
          action={<RunValidationButton canRun={canRun} />}
        />
      ) : (
        <ExceptionsContent data={result.data} />
      )}
    </div>
  );
}

function ExceptionsContent({ data }: { data: ValidationLatestResponse }) {
  const { run, findings, labels } = data;
  if (!run) return null;

  const bySeverity = run.summary?.bySeverity ?? {};
  const labelledKeys = new Set(labels.map((label) => `${label.expectedIssue}|${label.entityRef}`));
  const labelledMatches = findings.filter((finding) => labelledKeys.has(`${finding.issueCode}|${finding.entityRef}`)).length;
  const unexplained = findings.length - labelledMatches;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Findings"
          value={formatNumber(findings.length)}
          hint={`${formatNumber(run.checksRun)} checks executed`}
          icon={BadgeAlert}
          tone={findings.length > 0 ? "danger" : "success"}
          footer={run.finishedAt ? `Completed ${formatDateTime(run.finishedAt)}` : "Run in progress"}
        />
        <KpiCard
          label="Critical / high"
          value={formatNumber((bySeverity.CRITICAL ?? 0) + (bySeverity.HIGH ?? 0))}
          hint={`${formatNumber(bySeverity.MEDIUM ?? 0)} medium · ${formatNumber(bySeverity.LOW ?? 0)} low`}
          icon={BadgeAlert}
          tone="danger"
          footer="Severity assigned by the validation rule"
        />
        <KpiCard
          label="Labelled anomalies"
          value={formatNumber(labelledMatches)}
          hint={`of ${formatNumber(labels.length)} ground-truth labels`}
          icon={BadgeAlert}
          tone="info"
          footer="Findings that map to an injected anomaly"
        />
        <KpiCard
          label="Unexplained"
          value={formatNumber(unexplained)}
          hint={unexplained === 0 ? "All findings are explained" : "Needs investigation"}
          icon={BadgeAlert}
          tone={unexplained === 0 ? "success" : "warning"}
          footer="Findings with no ground-truth label"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted">
        <Badge variant={run.summary?.status === "PASS" ? "success" : "danger"}>
          {run.summary?.status === "PASS" ? "Validation passed" : "Findings raised"}
        </Badge>
        <Badge variant="neutral">Dataset: {run.datasetLabel}</Badge>
        <Badge variant="neutral">{humanize(run.status)}</Badge>
        <span>Latest run started {formatDateTime(run.startedAt)}</span>
        {Object.entries(bySeverity).map(([severity, count]) => (
          <span key={severity} className="inline-flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-muted" aria-hidden />
            {humanize(severity)}: {count}
          </span>
        ))}
      </div>

      {findings.length === 0 ? (
        <EmptyState
          title="No findings in the latest run"
          description="Every validation check passed against the current dataset."
        />
      ) : (
        <ExceptionExplorer findings={findings} labels={labels} recordedAt={run.finishedAt} />
      )}
    </>
  );
}

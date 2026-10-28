"use client";

import { useMemo, useState } from "react";
import { Filter, ShieldAlert } from "lucide-react";
import type { GroundTruthLabel, ValidationFinding } from "@/types/validation";
import { formatDateTime, humanize } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badges/status-badge";
import { cn } from "@/lib/utils";

interface ExplorerProps {
  findings: ValidationFinding[];
  labels: GroundTruthLabel[];
  recordedAt?: string | null;
}

const labelKey = (issue: string, ref: string) => `${issue}|${ref}`;

export function ExceptionExplorer({ findings, labels, recordedAt }: ExplorerProps) {
  const [severity, setSeverity] = useState("all");
  const [entity, setEntity] = useState("all");
  const [issue, setIssue] = useState("all");
  const [truth, setTruth] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(findings[0]?.id ?? null);

  const labelMap = useMemo(() => {
    const map = new Map<string, GroundTruthLabel>();
    for (const label of labels) map.set(labelKey(label.expectedIssue, label.entityRef), label);
    return map;
  }, [labels]);

  const entityTypes = useMemo(() => Array.from(new Set(findings.map((f) => f.entityType))).sort(), [findings]);
  const issueCodes = useMemo(() => Array.from(new Set(findings.map((f) => f.issueCode))).sort(), [findings]);
  const severities = useMemo(() => Array.from(new Set(findings.map((f) => f.severity))), [findings]);

  const filtered = useMemo(
    () =>
      findings.filter((finding) => {
        const label = labelMap.get(labelKey(finding.issueCode, finding.entityRef));
        if (severity !== "all" && finding.severity !== severity) return false;
        if (entity !== "all" && finding.entityType !== entity) return false;
        if (issue !== "all" && finding.issueCode !== issue) return false;
        if (truth === "labelled" && !label) return false;
        if (truth === "unlabelled" && label) return false;
        return true;
      }),
    [findings, labelMap, severity, entity, issue, truth],
  );

  const selected = filtered.find((finding) => finding.id === selectedId) ?? filtered[0] ?? null;
  const selectedLabel = selected ? labelMap.get(labelKey(selected.issueCode, selected.entityRef)) : undefined;
  const activeFilters = [severity, entity, issue, truth].filter((value) => value !== "all").length;

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="flex flex-col gap-3 pt-5 lg:flex-row lg:items-end">
          <div className="flex items-center gap-2 text-xs font-medium text-muted">
            <Filter aria-hidden className="size-3.5" />
            Filters
            {activeFilters > 0 ? <Badge variant="primary">{activeFilters}</Badge> : null}
          </div>

          <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1">
              <Label htmlFor="severity-filter">Severity</Label>
              <Select id="severity-filter" value={severity} onChange={(event) => setSeverity(event.target.value)}>
                <option value="all">All severities</option>
                {severities.map((value) => (
                  <option key={value} value={value}>
                    {humanize(value)}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="entity-filter">Entity</Label>
              <Select id="entity-filter" value={entity} onChange={(event) => setEntity(event.target.value)}>
                <option value="all">All entities</option>
                {entityTypes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="issue-filter">Issue type</Label>
              <Select id="issue-filter" value={issue} onChange={(event) => setIssue(event.target.value)}>
                <option value="all">All issues</option>
                {issueCodes.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="truth-filter">Ground truth</Label>
              <Select id="truth-filter" value={truth} onChange={(event) => setTruth(event.target.value)}>
                <option value="all">All findings</option>
                <option value="labelled">Labelled anomalies</option>
                <option value="unlabelled">Unexplained</option>
              </Select>
            </div>
          </div>

          {activeFilters > 0 ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSeverity("all");
                setEntity("all");
                setIssue("all");
                setTruth("all");
              }}
            >
              Clear filters
            </Button>
          ) : null}
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-5">
        <Card className={cn("xl:col-span-3", filtered.length === 0 && "py-10")}>
          {filtered.length === 0 ? (
            <div className="px-6 text-center">
              <ShieldAlert aria-hidden className="mx-auto size-5 text-muted" />
              <p className="mt-2 text-sm font-medium">No findings match these filters</p>
              <p className="mt-1 text-xs text-muted">Adjust or clear the filters to see recorded findings.</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Severity</TableHead>
                  <TableHead>Issue</TableHead>
                  <TableHead className="hidden sm:table-cell">Entity</TableHead>
                  <TableHead>Ground truth</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((finding) => {
                  const label = labelMap.get(labelKey(finding.issueCode, finding.entityRef));
                  const isSelected = selected?.id === finding.id;
                  return (
                    <TableRow
                      key={finding.id}
                      onClick={() => setSelectedId(finding.id)}
                      className={cn("cursor-pointer", isSelected && "bg-primary-soft/60")}
                    >
                      <TableCell>
                        <StatusBadge value={finding.severity} kind="severity" />
                      </TableCell>
                      <TableCell>
                        <p className="font-mono text-[11px]">{finding.issueCode}</p>
                        <p className="max-w-[280px] truncate text-[11px] text-muted">{finding.message}</p>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <p className="text-xs">{finding.entityType}</p>
                        <p className="font-mono text-[10px] text-muted">{finding.entityRef}</p>
                      </TableCell>
                      <TableCell>
                        {label ? <Badge variant="info">Labelled</Badge> : <Badge variant="neutral">Unexplained</Badge>}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </Card>

        <Card className="xl:col-span-2">
          <CardContent className="space-y-4 pt-5">
            {!selected ? (
              <p className="text-xs text-muted">Select a finding to see its evidence.</p>
            ) : (
              <>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={selected.severity} kind="severity" />
                    <Badge variant="neutral">{humanize(selected.category)}</Badge>
                    {selectedLabel ? <Badge variant="info">{selectedLabel.anomalyCode}</Badge> : null}
                  </div>
                  <p className="mt-2 font-mono text-xs text-primary">{selected.issueCode}</p>
                  <p className="mt-1 text-sm leading-relaxed">{selected.message}</p>
                </div>

                <dl className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">Entity</dt>
                    <dd className="mt-0.5">
                      {selected.entityType} · <span className="font-mono">{selected.entityRef}</span>
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">Recorded</dt>
                    <dd className="mt-0.5">{formatDateTime(selected.createdAt ?? recordedAt)}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">Expected</dt>
                    <dd className="mt-0.5 font-mono text-[11px]">{selected.expectedValue ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-wide text-muted">Observed</dt>
                    <dd className="mt-0.5 font-mono text-[11px]">{selected.observedValue ?? "—"}</dd>
                  </div>
                </dl>

                <div className="rounded-lg border border-border bg-surface-muted px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wide text-muted">Suggested remediation</p>
                  <p className="mt-1 text-xs leading-relaxed">{selected.remediation}</p>
                </div>

                {selectedLabel ? (
                  <div className="rounded-lg border border-[#bae6fd] bg-info-soft px-3 py-2 text-xs text-info">
                    <p className="font-medium">Ground-truth label</p>
                    <p className="mt-1 leading-relaxed">{selectedLabel.description}</p>
                    <p className="mt-1 font-mono text-[10px]">
                      {selectedLabel.anomalyCode} · expected {selectedLabel.expectedIssue}
                    </p>
                  </div>
                ) : (
                  <p className="text-[11px] text-muted">
                    No ground-truth label references this finding. It is either an unintended data defect or a new
                    condition not covered by the labelled set.
                  </p>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

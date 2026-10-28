"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { Calculator, Loader2, Search, UserRound } from "lucide-react";
import type { Applicant, Asset, Product } from "@/types/api";
import type { ApiErrorBody, EvaluateResponse } from "@/types/quoting";
import { formatCurrency, humanize } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EvaluationResult } from "./evaluation-result";

const MONEY = /^\d{1,12}(\.\d{1,2})?$/;

/** Mirrors the eligibility rule so the form can warn before submission. */
const ALLOWED_ASSET_TYPES: Record<string, string[]> = {
  MOTOR: ["VEHICLE"],
  PROPERTY: ["BUILDING", "MACHINERY", "SOLAR_PLANT"],
  CYBER: ["IT_INFRASTRUCTURE"],
  LIABILITY: ["BUILDING", "MACHINERY", "SOLAR_PLANT", "IT_INFRASTRUCTURE", "VEHICLE"],
};

const coverageRowSchema = z.object({
  code: z.string(),
  name: z.string(),
  limit: z.string(),
  min: z.string(),
  max: z.string(),
  required: z.boolean(),
  selected: z.boolean(),
});

const formSchema = z
  .object({
    applicantId: z.string().min(1, "Select an applicant"),
    productId: z.string().min(1, "Select a product"),
    assetId: z.string().optional(),
    coverages: z.array(coverageRowSchema).min(1, "Select a product to load coverages"),
  })
  .superRefine((value, ctx) => {
    const selected = value.coverages.filter((coverage) => coverage.selected);
    if (selected.length === 0) {
      ctx.addIssue({ code: "custom", path: ["coverages"], message: "Select at least one coverage" });
    }
    value.coverages.forEach((coverage, index) => {
      if (!coverage.selected) return;
      if (!MONEY.test(coverage.limit)) {
        ctx.addIssue({
          code: "custom",
          path: ["coverages", index, "limit"],
          message: "Enter an amount with up to 2 decimals",
        });
        return;
      }
      const amount = Number(coverage.limit);
      if (amount < Number(coverage.min) || amount > Number(coverage.max)) {
        ctx.addIssue({
          code: "custom",
          path: ["coverages", index, "limit"],
          message: `Limit must be between ${formatCurrency(coverage.min)} and ${formatCurrency(coverage.max)}`,
        });
      }
    });
  });

type FormValues = z.infer<typeof formSchema>;

interface QuoteEvaluationFormProps {
  products: Product[];
  canEvaluate: boolean;
}

export function QuoteEvaluationForm({ products, canEvaluate }: QuoteEvaluationFormProps) {
  const productsById = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Applicant[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedApplicant, setSelectedApplicant] = useState<Applicant | null>(null);
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<EvaluateResponse | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    register,
    control,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    defaultValues: { applicantId: "", productId: "", assetId: "", coverages: [] },
  });

  const { fields, replace } = useFieldArray({ control, name: "coverages" });
  const productId = watch("productId");
  const assetId = watch("assetId");
  const coverages = watch("coverages");

  const selectedProduct = productId ? productsById.get(productId) : undefined;
  const selectedAsset = assets.find((asset) => asset.id === assetId);
  const assetIncompatible =
    selectedProduct && selectedAsset
      ? !(ALLOWED_ASSET_TYPES[selectedProduct.category] ?? []).includes(selectedAsset.assetType)
      : false;

  useEffect(() => {
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, []);

  function onSearchChange(value: string) {
    setQuery(value);
    setSelectedApplicant(null);
    setValue("applicantId", "");
    setAssets([]);
    setValue("assetId", "");
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (value.trim().length < 2) {
      setResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const response = await fetch(`/api/applicants?pageSize=8&q=${encodeURIComponent(value.trim())}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = (await response.json()) as { items: Applicant[] };
        setResults(payload.items ?? []);
      } catch {
        setResults([]);
        setFormError("Applicant search failed. Try again.");
      } finally {
        setSearching(false);
      }
    }, 300);
  }

  async function chooseApplicant(applicant: Applicant) {
    setSelectedApplicant(applicant);
    setQuery(`${applicant.firstName} ${applicant.lastName} · ${applicant.reference}`);
    setResults([]);
    setValue("applicantId", applicant.id, { shouldValidate: true });
    setValue("assetId", "");
    setLoadingAssets(true);
    try {
      const response = await fetch(`/api/applicants/${applicant.id}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const detail = (await response.json()) as Applicant & { assets: Asset[] };
      setAssets(detail.assets ?? []);
    } catch {
      setAssets([]);
      setFormError("Could not load this applicant's assets.");
    } finally {
      setLoadingAssets(false);
    }
  }

  function onProductChange(id: string) {
    const product = productsById.get(id);
    setValue("productId", id, { shouldValidate: true });
    if (!product) {
      replace([]);
      return;
    }
    replace(
      product.coverageOptions.map((option) => ({
        code: option.code,
        name: option.name,
        limit: option.defaultLimit,
        min: option.minLimit,
        max: option.maxLimit,
        required: option.required,
        selected: option.required,
      })),
    );
  }

  const selectedCount = coverages.filter((coverage) => coverage.selected).length;

  async function onSubmit(values: FormValues) {
    setFormError(null);
    setSubmitError(null);
    setFieldErrors({});
    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        next[issue.path.join(".")] = issue.message;
      }
      setFieldErrors(next);
      if (next.coverages) setFormError(next.coverages);
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/quotes/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicantId: values.applicantId,
          productId: values.productId,
          assetId: values.assetId || null,
          coverages: values.coverages
            .filter((coverage) => coverage.selected)
            .map((coverage) => ({ code: coverage.code, limit: coverage.limit })),
        }),
      });

      if (response.status === 422) {
        const body = (await response.json()) as ApiErrorBody;
        const details = Array.isArray(body.error.details) ? body.error.details : [];
        const next: Record<string, string> = {};
        for (const detail of details) next[detail.path] = detail.message;
        setFieldErrors(next);
        setSubmitError(`The evaluation request was rejected: ${body.error.message}`);
        return;
      }
      if (response.status === 403) {
        setSubmitError("Your role is not permitted to evaluate quotes. Switch to Operations analyst or Admin.");
        return;
      }
      if (!response.ok) {
        setSubmitError(`Evaluation failed (HTTP ${response.status}). No quote was created.`);
        return;
      }
      const payload = (await response.json()) as EvaluateResponse;
      setResult(payload);
    } catch {
      setSubmitError("The evaluation request could not be completed. Check your connection and retry.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <CardTitle>Quote request</CardTitle>
          <CardDescription>
            Pricing, eligibility and referral rules run on the server. The result below is the persisted quote.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!canEvaluate ? (
            <Alert tone="danger" title="Role not permitted" className="mb-4">
              Your current role cannot evaluate quotes. Switch to Operations analyst, Risk reviewer or Admin in the
              header.
            </Alert>
          ) : null}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6" noValidate>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="applicant-search">Applicant</Label>
                <div className="relative">
                  <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <Input
                    id="applicant-search"
                    value={query}
                    onChange={(event) => onSearchChange(event.target.value)}
                    placeholder="Search name or reference…"
                    autoComplete="off"
                    className="pl-8"
                    aria-invalid={Boolean(fieldErrors.applicantId)}
                    aria-describedby="applicant-help"
                  />
                  {searching ? <Loader2 aria-hidden className="absolute right-2.5 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted" /> : null}
                </div>
                <p id="applicant-help" className="text-[11px] text-muted">
                  {selectedApplicant
                    ? `Selected ${selectedApplicant.reference}`
                    : "Type at least two characters, then pick a result."}
                </p>
                {results.length > 0 ? (
                  <ul className="max-h-56 overflow-auto rounded-lg border border-border bg-surface shadow-sm" role="listbox">
                    {results.map((applicant) => (
                      <li key={applicant.id} role="option" aria-selected={false}>
                        <button
                          type="button"
                          onClick={() => void chooseApplicant(applicant)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-muted"
                        >
                          <UserRound aria-hidden className="size-3.5 text-muted" />
                          <span className="font-medium">
                            {applicant.firstName} {applicant.lastName}
                          </span>
                          <span className="font-mono text-[10px] text-muted">{applicant.reference}</span>
                          <Badge variant="neutral" className="ml-auto">
                            {applicant.region}
                          </Badge>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {fieldErrors.applicantId ? <p className="text-[11px] text-danger">{fieldErrors.applicantId}</p> : null}
                {errors.applicantId ? <p className="text-[11px] text-danger">{errors.applicantId.message}</p> : null}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="productId">Product</Label>
                <Select
                  id="productId"
                  value={productId}
                  onChange={(event) => onProductChange(event.target.value)}
                  aria-invalid={Boolean(fieldErrors.productId)}
                >
                  <option value="">Select a product…</option>
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.name} ({product.code})
                    </option>
                  ))}
                </Select>
                {fieldErrors.productId ? <p className="text-[11px] text-danger">{fieldErrors.productId}</p> : null}
              </div>

              <div className="space-y-1.5 md:col-span-2">
                <Label htmlFor="assetId">Insured asset (optional for liability products)</Label>
                <Select id="assetId" {...register("assetId")} disabled={!selectedApplicant || loadingAssets}>
                  <option value="">{loadingAssets ? "Loading assets…" : "No asset"}</option>
                  {assets.map((asset) => (
                    <option key={asset.id} value={asset.id}>
                      {asset.reference} — {asset.description} ({humanize(asset.assetType)})
                    </option>
                  ))}
                </Select>
                <p className="text-[11px] text-muted">
                  Assets are checked against the product category and value band by the eligibility rules.
                </p>
                {assetIncompatible && selectedProduct && selectedAsset ? (
                  <Alert tone="info" title="Asset type not insurable under this product">
                    {humanize(selectedAsset.assetType)} assets cannot be insured under {humanize(selectedProduct.category)}{" "}
                    products. The evaluation will return an ineligible decision and record the reason.
                  </Alert>
                ) : null}
              </div>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold">Coverage & limits</h3>
                <span className="text-[11px] text-muted">{selectedCount} selected</span>
              </div>
              {fields.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-xs text-muted">
                  Select a product to load its coverage options.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Use</TableHead>
                      <TableHead>Coverage</TableHead>
                      <TableHead className="w-44">Limit</TableHead>
                      <TableHead className="hidden sm:table-cell">Permitted range</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {fields.map((field, index) => {
                      const row = coverages[index];
                      const errorKey = `coverages.${index}.limit`;
                      return (
                        <TableRow key={field.id}>
                          <TableCell>
                            <input
                              type="checkbox"
                              aria-label={`Include ${field.name}`}
                              {...register(`coverages.${index}.selected`)}
                              className="size-4 rounded border-border"
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium">{field.name}</p>
                            <p className="font-mono text-[10px] text-muted">
                              {field.code}
                              {field.required ? " · required" : ""}
                            </p>
                          </TableCell>
                          <TableCell>
                            <Input
                              aria-label={`Limit for ${field.name}`}
                              inputMode="decimal"
                              {...register(`coverages.${index}.limit`)}
                              disabled={!row?.selected}
                              aria-invalid={Boolean(fieldErrors[errorKey])}
                            />
                            {fieldErrors[errorKey] ? (
                              <p className="mt-1 text-[10px] text-danger">{fieldErrors[errorKey]}</p>
                            ) : null}
                          </TableCell>
                          <TableCell className="hidden sm:table-cell text-xs text-muted tabular">
                            {formatCurrency(field.min)} – {formatCurrency(field.max)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {fieldErrors.coverages ? <p className="mt-2 text-[11px] text-danger">{fieldErrors.coverages}</p> : null}
            </div>

            {formError ? <Alert tone="danger" title="Check the form">{formError}</Alert> : null}
            {submitError ? <Alert tone="danger" title="Evaluation not completed">{submitError}</Alert> : null}

            <div className="flex flex-wrap items-center gap-3">
              <Button type="submit" disabled={submitting || !canEvaluate}>
                {submitting ? <Loader2 aria-hidden className="animate-spin" /> : <Calculator aria-hidden />}
                {submitting ? "Evaluating…" : "Evaluate quote"}
              </Button>
              <p className="text-[11px] text-muted">
                Creates an immutable quote record. No policy is issued from this screen.
              </p>
            </div>
          </form>
        </CardContent>
      </Card>

      {result ? <EvaluationResult result={result} /> : null}
    </div>
  );
}

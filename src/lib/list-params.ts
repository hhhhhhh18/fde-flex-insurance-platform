export interface ListParams {
  page: number;
  pageSize: number;
  q?: string;
  status?: string;
}

type RawParams = Record<string, string | string[] | undefined>;

function single(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0];
  return value ?? undefined;
}

/** Clamps untrusted query parameters to the limits enforced by the API. */
export async function parseListParams(
  searchParams: Promise<RawParams>,
  defaults: { pageSize?: number; status?: string } = {},
): Promise<ListParams> {
  const raw = await searchParams;
  const page = Math.min(Math.max(Number(single(raw.page) ?? 1) || 1, 1), 10_000);
  const pageSize = Math.min(Math.max(Number(single(raw.pageSize) ?? defaults.pageSize ?? 20) || 20, 1), 100);
  const q = single(raw.q)?.trim().slice(0, 120) || undefined;
  const status = single(raw.status)?.trim().slice(0, 40) || undefined;
  return { page, pageSize, q, status };
}

export function toQueryString(params: ListParams): string {
  const search = new URLSearchParams();
  search.set("page", String(params.page));
  search.set("pageSize", String(params.pageSize));
  if (params.q) search.set("q", params.q);
  if (params.status) search.set("status", params.status);
  return search.toString();
}

/** Query object for pagination/filter components (keeps URLs consistent). */
export function toUrlQuery(params: ListParams): Record<string, string | undefined> {
  return {
    q: params.q,
    status: params.status,
    pageSize: params.pageSize === 20 ? undefined : String(params.pageSize),
  };
}

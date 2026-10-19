export interface PageParams {
  page: number;
  perPage: number;
  offset: number;
}

export interface PageMeta {
  page: number;
  perPage: number;
  total: number;
  totalPages: number;
}

export function pageParams(query: { page?: unknown; perPage?: unknown }): PageParams {
  const rawPage = Number(query.page ?? 1);
  const rawPerPage = Number(query.perPage ?? 20);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.trunc(rawPage)) : 1;
  const perPage = Number.isFinite(rawPerPage)
    ? Math.min(100, Math.max(1, Math.trunc(rawPerPage)))
    : 20;
  return { page, perPage, offset: (page - 1) * perPage };
}

export function pageMeta(params: PageParams, total: number): PageMeta {
  return {
    page: params.page,
    perPage: params.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / params.perPage)),
  };
}

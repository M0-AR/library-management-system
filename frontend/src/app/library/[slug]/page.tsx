"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { BookOpen, CheckCircle2, Library, SearchX, X } from "lucide-react";
import {
  Badge,
  Callout,
  EmptyState,
  PageLoader,
  Pagination,
  cx,
} from "@/components/ui";
import { OpacFooter, OpacHeader, usePublicTenant } from "@/components/opac";
import { ApiError } from "@/lib/api";
import { useApi, useDebounced } from "@/lib/hooks";
import type { PublicBook } from "@/lib/types";

interface CatalogResponse {
  items: PublicBook[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

function Cover({ book, showCovers }: { book: PublicBook; showCovers: boolean }) {
  if (showCovers && book.coverUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={book.coverUrl}
        alt={book.title}
        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        loading="lazy"
      />
    );
  }
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "color-mix(in oklab, var(--brand) 8%, #f8fafc)" }}
    >
      <BookOpen className="h-8 w-8" style={{ color: "color-mix(in oklab, var(--brand) 45%, white)" }} />
    </div>
  );
}

export default function CatalogPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-ink-50/60">
          <PageLoader label="Opening the catalog" />
        </div>
      }
    >
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  const params = useParams<{ slug: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const router = useRouter();
  const searchParams = useSearchParams();
  const { tenant, error, loading } = usePublicTenant(slug);

  const author = searchParams.get("author")?.trim() || undefined;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [availableOnly, setAvailableOnly] = useState(false);
  const [sort, setSort] = useState<"title" | "recent">("title");
  const [page, setPage] = useState(1);
  const debouncedQuery = useDebounced(query, 350);

  const categories = useApi<string[]>(slug ? `/public/tenants/${slug}/categories` : null);
  const catalog = useApi<CatalogResponse>(slug ? `/public/tenants/${slug}/books` : null, {
    query: {
      q: debouncedQuery || undefined,
      category: category ?? undefined,
      author,
      available: availableOnly ? "true" : undefined,
      sort,
      page,
    },
  });

  const items = catalog.data?.items ?? [];
  const meta = catalog.data?.meta;
  const showCovers = tenant?.opac.showCovers ?? true;

  const categoryChips = useMemo(() => (categories.data ?? []).slice(0, 14), [categories.data]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50/60">
        <PageLoader label="Opening the catalog" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-ink-50/60 px-4 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-400">
          <Library className="h-6 w-6" />
        </span>
        <div>
          <h1 className="text-lg font-bold text-ink-900">
            {error instanceof ApiError && error.code === "tenant_not_found" ? "Library not found" : "Catalog unavailable"}
          </h1>
          <p className="mt-1 max-w-sm text-sm text-ink-400">
            {error instanceof ApiError && error.code === "tenant_not_found"
              ? "This library doesn’t exist, or its catalog is offline."
              : "We couldn’t load this library’s catalog. Please try again."}
          </p>
        </div>
        <Link href="/" className="text-sm font-medium text-[var(--brand)] hover:underline">
          Go to Library Cloud →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50/60">
      <OpacHeader
        tenant={tenant}
        slug={slug}
        query={query}
        onQuery={(value) => {
          setQuery(value);
          setPage(1);
        }}
      />

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-8 sm:px-6">
        {tenant.branding.welcomeMessage ? (
          <p className="mb-6 max-w-3xl text-[15px] leading-relaxed text-ink-500">{tenant.branding.welcomeMessage}</p>
        ) : null}

        <div className="mb-5 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCategory(null);
              setPage(1);
            }}
            className={cx(
              "inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors",
              category === null ? "text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100",
            )}
            style={category === null ? { background: "var(--brand)" } : undefined}
          >
            All
          </button>
          {categoryChips.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setCategory(item === category ? null : item);
                setPage(1);
              }}
              className={cx(
                "inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-medium transition-colors",
                item === category ? "text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100",
              )}
              style={item === category ? { background: "var(--brand)" } : undefined}
            >
              {item}
            </button>
          ))}

          <button
            type="button"
            onClick={() => {
              setAvailableOnly((value) => !value);
              setPage(1);
            }}
            aria-pressed={availableOnly}
            className={cx(
              "inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium transition-colors",
              availableOnly ? "text-white" : "bg-white text-ink-600 ring-1 ring-ink-200 hover:bg-ink-100",
            )}
            style={availableOnly ? { background: "var(--brand)" } : undefined}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Available now
          </button>

          {author ? (
            <button
              type="button"
              onClick={() => router.replace(`/library/${slug}`)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white px-3.5 text-[13px] font-medium text-ink-600 ring-1 ring-ink-200 transition-colors hover:bg-ink-100"
            >
              By {author}
              <X className="h-3.5 w-3.5 text-ink-400" />
            </button>
          ) : null}

          <div className="ml-auto flex items-center gap-2 text-[12.5px] text-ink-400">
            <span>Sort</span>
            <div className="flex rounded-lg bg-white p-0.5 ring-1 ring-ink-200">
              {(
                [
                  { id: "title", label: "A–Z" },
                  { id: "recent", label: "Newest" },
                ] as const
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    setSort(option.id);
                    setPage(1);
                  }}
                  className={cx(
                    "h-7 rounded-md px-2.5 text-[12.5px] font-medium transition-colors",
                    sort === option.id ? "text-white" : "text-ink-500 hover:text-ink-800",
                  )}
                  style={sort === option.id ? { background: "var(--brand)" } : undefined}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {meta ? (
          <p className="mb-4 text-[12.5px] text-ink-400" aria-live="polite">
            {meta.total} {meta.total === 1 ? "book" : "books"}
            {debouncedQuery ? <> matching “{debouncedQuery}”</> : null}
            {category ? <> in {category}</> : null}
            {author ? <> by {author}</> : null}
            {availableOnly ? <> · available now</> : null}
          </p>
        ) : null}

        {catalog.error ? (
          <Callout tone="danger">We couldn’t load the books. Please refresh the page.</Callout>
        ) : catalog.loading && !catalog.data ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 8 }).map((_, index) => (
              <div key={index} className="animate-pulse rounded-2xl bg-white p-3 ring-1 ring-ink-100">
                <div className="aspect-[3/4] rounded-xl bg-ink-100" />
                <div className="mt-3 h-3.5 w-4/5 rounded bg-ink-100" />
                <div className="mt-2 h-3 w-2/5 rounded bg-ink-100" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={<SearchX className="h-5 w-5" />}
            title="No books found"
            description={
              debouncedQuery
                ? `Nothing matches “${debouncedQuery}”${category ? ` in ${category}` : ""}. Try a different search.`
                : "This catalog is empty for now — check back soon."
            }
          />
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {items.map((book) => (
              <Link
                key={book.id}
                href={`/library/${slug}/books/${book.id}`}
                className="group animate-fade-in rounded-2xl bg-white p-3 ring-1 ring-ink-100 transition-all hover:-translate-y-0.5 hover:shadow-lg hover:ring-ink-200"
              >
                <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-ink-100">
                  <Cover book={book} showCovers={showCovers} />
                  {book.totalCopies > 0 ? (
                    <span className="absolute left-2 top-2">
                      {book.availableCopies > 0 ? (
                        <Badge tone="success">{book.availableCopies} available</Badge>
                      ) : (
                        <Badge tone="warn">Waitlist</Badge>
                      )}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 line-clamp-2 text-[13.5px] font-semibold leading-snug text-ink-800 group-hover:text-[var(--brand)]">
                  {book.title}
                </h3>
                <p className="mt-1 line-clamp-1 text-[12px] text-ink-400">
                  {(book.authors ?? []).join(", ") || book.publisher || "Unknown author"}
                </p>
                {book.publishedYear ? (
                  <p className="mt-0.5 text-[11.5px] text-ink-300">{book.publishedYear}</p>
                ) : null}
              </Link>
            ))}
          </div>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="mt-8">
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
          </div>
        ) : null}
      </main>

      <OpacFooter tenant={tenant} slug={slug} />
    </div>
  );
}

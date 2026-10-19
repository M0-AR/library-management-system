"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookMarked,
  BookOpen,
  Building2,
  CalendarDays,
  CheckCircle2,
  Hash,
  Library,
  Languages,
  Layers,
} from "lucide-react";
import {
  Badge,
  Button,
  Callout,
  EmptyState,
  PageLoader,
  useToast,
} from "@/components/ui";
import { OpacFooter, OpacHeader, usePublicTenant } from "@/components/opac";
import { ApiError, api, publicApi } from "@/lib/api";
import { useApi, useSession } from "@/lib/hooks";
import type { PublicBook, PublicBookDetail } from "@/lib/types";

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 text-[13px]">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-ink-100 text-ink-400">{icon}</span>
      <span className="text-ink-400">{label}</span>
      <span className="ml-auto text-right font-medium text-ink-700">{value}</span>
    </div>
  );
}

interface RelatedResponse {
  items: PublicBook[];
}

function RelatedStrip({
  title,
  books,
  slug,
  showCovers,
  moreHref,
}: {
  title: string;
  books: PublicBook[];
  slug: string;
  showCovers: boolean;
  moreHref: string;
}) {
  return (
    <section className="mt-8">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
        <Link href={moreHref} className="text-[12.5px] font-medium text-[var(--brand)] hover:underline">
          See all →
        </Link>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {books.map((item) => (
          <Link
            key={item.id}
            href={`/library/${slug}/books/${item.id}`}
            className="group rounded-2xl bg-white p-2.5 ring-1 ring-ink-100 transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="aspect-[3/4] overflow-hidden rounded-xl bg-ink-100">
              {showCovers && item.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.coverUrl} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
              ) : (
                <div
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: "color-mix(in oklab, var(--brand) 8%, #f8fafc)" }}
                >
                  <BookOpen className="h-5 w-5" style={{ color: "color-mix(in oklab, var(--brand) 45%, white)" }} />
                </div>
              )}
            </div>
            <h3 className="mt-2 line-clamp-2 text-[12.5px] font-semibold leading-snug text-ink-800 group-hover:text-[var(--brand)]">
              {item.title}
            </h3>
            <p className="mt-0.5 line-clamp-1 text-[11.5px] text-ink-400">
              {(item.authors ?? []).join(", ") || "Unknown author"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}

export default function BookDetailPage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = typeof params.slug === "string" ? params.slug : "";
  const bookId = typeof params.id === "string" ? params.id : "";
  const router = useRouter();
  const { push } = useToast();
  const { tenant, error, loading } = usePublicTenant(slug);
  const { session } = useSession("patron");
  const book = useApi<PublicBookDetail>(slug && bookId ? `/public/tenants/${slug}/books/${bookId}` : null);
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);

  const detail = book.data;
  const totalAvailable = useMemo(
    () => (detail?.availability ?? []).reduce((sum, branch) => sum + branch.available, 0),
    [detail],
  );
  const patronMatches = Boolean(session && (!session.tenant || session.tenant.slug === slug));

  const primaryAuthor = detail?.authors?.[0] ?? undefined;
  const primaryCategory = detail?.categories?.[0] ?? undefined;
  const sameAuthor = useApi<RelatedResponse>(
    detail && primaryAuthor ? `/public/tenants/${slug}/books` : null,
    { query: { author: primaryAuthor, perPage: 4 } },
  );
  const sameCategory = useApi<RelatedResponse>(
    detail && primaryCategory ? `/public/tenants/${slug}/books` : null,
    { query: { category: primaryCategory, perPage: 4 } },
  );
  const relatedAuthor = (sameAuthor.data?.items ?? []).filter((item) => item.id !== bookId).slice(0, 3);
  const relatedCategory = (sameCategory.data?.items ?? []).filter((item) => item.id !== bookId).slice(0, 3);

  async function placeHold() {
    if (!patronMatches) {
      router.push(`/library/${slug}/account?next=/library/${slug}/books/${bookId}`);
      return;
    }
    setPlacing(true);
    try {
      await api.post("/me/holds", { bookId }, { scope: "patron" });
      setPlaced(true);
      push({
        title: "Hold placed",
        description: totalAvailable > 0 ? "Your copy is ready for pickup soon — we’ll email you." : "We’ll email you when it’s your turn.",
        tone: "success",
      });
      book.reload();
    } catch (err) {
      push({
        title: "Unable to place hold",
        description: err instanceof ApiError ? err.message : "Please try again.",
        tone: "error",
      });
    } finally {
      setPlacing(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50/60">
        <PageLoader label="Loading book" />
      </div>
    );
  }

  if (error || !tenant) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-ink-50/60 px-4 text-center">
        <Library className="h-6 w-6 text-ink-400" />
        <h1 className="text-lg font-bold text-ink-900">Library not found</h1>
        <Link href="/" className="text-sm font-medium text-[var(--brand)] hover:underline">
          Go to Library Cloud →
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink-50/60">
      <OpacHeader tenant={tenant} slug={slug} session={patronMatches ? { name: session?.user.name ?? "" } : null} />

      <main className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
        <Link
          href={`/library/${slug}`}
          className="mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-400 hover:text-ink-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to catalog
        </Link>

        {book.error ? (
          <Callout tone="danger">
            {book.error.code === "book_not_found" ? "This book is no longer in the catalog." : "We couldn’t load this book."}
          </Callout>
        ) : book.loading && !detail ? (
          <div className="grid gap-8 md:grid-cols-[240px_1fr]">
            <div className="aspect-[3/4] animate-pulse rounded-2xl bg-ink-100" />
            <div className="space-y-3">
              <div className="h-6 w-2/3 animate-pulse rounded bg-ink-100" />
              <div className="h-4 w-1/3 animate-pulse rounded bg-ink-100" />
              <div className="h-24 animate-pulse rounded-2xl bg-ink-100" />
            </div>
          </div>
        ) : detail ? (
          <div className="grid gap-8 md:grid-cols-[240px_1fr] lg:gap-12">
            <div>
              <div className="sticky top-24">
                <div className="aspect-[3/4] overflow-hidden rounded-2xl bg-ink-100 shadow-lg ring-1 ring-ink-900/5">
                  {tenant.opac.showCovers && detail.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={detail.coverUrl} alt={detail.title} className="h-full w-full object-cover" />
                  ) : (
                    <div
                      className="flex h-full w-full items-center justify-center"
                      style={{ background: "color-mix(in oklab, var(--brand) 8%, #f8fafc)" }}
                    >
                      <BookOpen className="h-12 w-12" style={{ color: "color-mix(in oklab, var(--brand) 40%, white)" }} />
                    </div>
                  )}
                </div>
                <div className="mt-5">
                  {totalAvailable > 0 ? (
                    <Button className="w-full" size="lg" onClick={placeHold} loading={placing} disabled={placed} icon={<BookMarked className="h-4 w-4" />}>
                      {placed ? "Hold placed ✓" : "Place a hold"}
                    </Button>
                  ) : (
                    <Button
                      className="w-full"
                      size="lg"
                      variant="outline"
                      onClick={placeHold}
                      loading={placing}
                      disabled={placed}
                      icon={<BookMarked className="h-4 w-4" />}
                    >
                      {placed ? "On the waitlist ✓" : "Join the waitlist"}
                    </Button>
                  )}
                  <p className="mt-2 text-center text-[11.5px] text-ink-400">
                    {totalAvailable > 0 ? `${totalAvailable} ${totalAvailable === 1 ? "copy" : "copies"} on the shelf` : "All copies are out"}
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-start gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold leading-tight tracking-tight text-ink-900 sm:text-[28px]">{detail.title}</h1>
                  {detail.subtitle ? <p className="mt-1 text-[15px] text-ink-500">{detail.subtitle}</p> : null}
                  <p className="mt-2 text-[14px] font-medium text-ink-600">
                    {(detail.authors ?? []).join(", ") || "Unknown author"}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {(detail.categories ?? []).map((category) => (
                  <Badge key={category} tone="neutral">
                    {category}
                  </Badge>
                ))}
                {totalAvailable > 0 ? <Badge tone="success">Available</Badge> : <Badge tone="warn">On loan</Badge>}
              </div>

              {detail.description ? (
                <p className="mt-5 max-w-2xl whitespace-pre-line text-[14px] leading-relaxed text-ink-600">{detail.description}</p>
              ) : null}

              <div className="mt-6 grid gap-2.5 rounded-2xl bg-white p-5 ring-1 ring-ink-100 sm:grid-cols-2">
                {detail.publisher ? (
                  <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Publisher" value={detail.publisher} />
                ) : null}
                {detail.publishedYear ? (
                  <DetailRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Published" value={detail.publishedYear} />
                ) : null}
                {detail.pages ? (
                  <DetailRow icon={<Layers className="h-3.5 w-3.5" />} label="Pages" value={detail.pages} />
                ) : null}
                {detail.language ? (
                  <DetailRow icon={<Languages className="h-3.5 w-3.5" />} label="Language" value={detail.language} />
                ) : null}
                {detail.isbn13 || detail.isbn10 ? (
                  <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="ISBN" value={detail.isbn13 ?? detail.isbn10} />
                ) : null}
              </div>

              <h2 className="mt-8 text-[15px] font-semibold text-ink-900">Availability by branch</h2>
              {(detail.availability ?? []).length === 0 ? (
                <EmptyState
                  icon={<CheckCircle2 className="h-5 w-5" />}
                  title="No copies held"
                  description="This title isn’t on any shelf yet."
                />
              ) : (
                <div className="mt-3 divide-y divide-ink-100 overflow-hidden rounded-2xl bg-white ring-1 ring-ink-100">
                  {(detail.availability ?? []).map((branch) => (
                    <div key={branch.branchId} className="flex items-center justify-between px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Building2 className="h-4 w-4 text-ink-300" />
                        <span className="text-[13.5px] font-medium text-ink-700">{branch.branchName}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[12.5px] text-ink-400">
                          {branch.total} {branch.total === 1 ? "copy" : "copies"}
                        </span>
                        {branch.available > 0 ? (
                          <Badge tone="success">{branch.available} available</Badge>
                        ) : (
                          <Badge tone="neutral">All out</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {primaryAuthor && relatedAuthor.length > 0 ? (
                <RelatedStrip
                  title={`More by ${primaryAuthor}`}
                  books={relatedAuthor}
                  slug={slug}
                  showCovers={tenant.opac.showCovers}
                  moreHref={`/library/${slug}?author=${encodeURIComponent(primaryAuthor)}`}
                />
              ) : null}

              {primaryCategory && relatedCategory.length > 0 ? (
                <RelatedStrip
                  title={`More in ${primaryCategory}`}
                  books={relatedCategory}
                  slug={slug}
                  showCovers={tenant.opac.showCovers}
                  moreHref={`/library/${slug}`}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </main>

      <OpacFooter tenant={tenant} slug={slug} />
    </div>
  );
}

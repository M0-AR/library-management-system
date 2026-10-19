"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BookOpen, Search } from "lucide-react";
import { ApiError, publicApi } from "@/lib/api";
import { cx } from "@/components/ui";
import type { PublicTenant } from "@/lib/types";

export function applyBranding(branding: PublicTenant["branding"]) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.style.setProperty("--brand", branding.primaryColor);
  root.style.setProperty("--accent", branding.accentColor);
}

export function usePublicTenant(slug: string) {
  const [tenant, setTenant] = useState<PublicTenant | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    publicApi<PublicTenant>(`/public/tenants/${slug}`)
      .then((result) => {
        if (cancelled) return;
        setTenant(result);
        setError(null);
        applyBranding(result.branding);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof ApiError ? err : new ApiError(0, "network_error", String(err)));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return { tenant, error, loading };
}

export function OpacHeader({
  tenant,
  slug,
  query,
  onQuery,
  showSearch = true,
  session,
}: {
  tenant: PublicTenant;
  slug: string;
  query?: string;
  onQuery?: (value: string) => void;
  showSearch?: boolean;
  session?: { name: string } | null;
}) {
  const displayName = tenant.branding.displayName || tenant.name;
  const [local, setLocal] = useState(query ?? "");

  useEffect(() => setLocal(query ?? ""), [query]);

  const initials = useMemo(
    () =>
      displayName
        .split(/\s+/)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join(""),
    [displayName],
  );

  return (
    <header className="sticky top-0 z-30 border-b border-ink-100 bg-white/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link href={`/library/${slug}`} className="flex shrink-0 items-center gap-2.5">
          {tenant.branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tenant.branding.logoUrl} alt={displayName} className="h-9 w-9 rounded-xl object-cover" />
          ) : (
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-[13px] font-bold text-white"
              style={{ background: "var(--brand)" }}
            >
              {initials || <BookOpen className="h-4 w-4" />}
            </span>
          )}
          <span className="hidden text-[15px] font-semibold tracking-tight text-ink-900 sm:block">{displayName}</span>
        </Link>

        {showSearch ? (
          <form
            className="mx-auto flex h-10 w-full max-w-md items-center gap-2 rounded-xl border border-ink-200 bg-white px-3 focus-within:border-[var(--brand)]/60 focus-within:ring-2 focus-within:ring-[var(--brand)]/15"
            onSubmit={(event) => {
              event.preventDefault();
              onQuery?.(local.trim());
            }}
          >
            <Search className="h-4 w-4 shrink-0 text-ink-300" />
            <input
              value={local}
              onChange={(event) => setLocal(event.target.value)}
              placeholder="Search the catalog…"
              className="h-full w-full bg-transparent text-sm text-ink-800 outline-none placeholder:text-ink-300"
            />
          </form>
        ) : null}

        <div className="ml-auto flex shrink-0 items-center gap-2">
          {session ? (
            <Link
              href={`/library/${slug}/account`}
              className="inline-flex h-9 items-center rounded-xl bg-ink-100 px-3.5 text-[13px] font-medium text-ink-700 hover:bg-ink-200"
            >
              {session.name.split(" ")[0]}
            </Link>
          ) : (
            <Link
              href={`/library/${slug}/account`}
              className="inline-flex h-9 items-center rounded-xl px-3.5 text-[13px] font-semibold text-white"
              style={{ background: "var(--brand)" }}
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

export function OpacFooter({ tenant, slug }: { tenant: PublicTenant; slug: string }) {
  return (
    <footer className="mt-16 border-t border-ink-100">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-8 text-[12.5px] text-ink-400 sm:px-6">
        <p>
          {tenant.branding.displayName || tenant.name} · Powered by <span className={cx("font-medium text-ink-500")}>Library Cloud</span>
        </p>
        <div className="flex items-center gap-4">
          <Link href={`/library/${slug}`} className="hover:text-ink-600">
            Catalog
          </Link>
          <Link href={`/library/${slug}/account`} className="hover:text-ink-600">
            My account
          </Link>
          <Link href="/" className="hover:text-ink-600">
            System status
          </Link>
        </div>
      </div>
    </footer>
  );
}

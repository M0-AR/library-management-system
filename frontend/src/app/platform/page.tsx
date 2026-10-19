"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, ChevronRight, Search, TrendingUp, Users } from "lucide-react";
import { AreaChart } from "@/components/charts";
import { StatCard } from "@/components/dashboard/page-header";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Input,
  Pagination,
  cx,
} from "@/components/ui";
import { TableSkeleton, Td, Th, TableWrap, Tr } from "@/components/table";
import { formatDate, titleCase } from "@/lib/format";
import { useApi, useDebounced } from "@/lib/hooks";
import type { GrowthPoint, PlatformTenant } from "@/lib/types";

interface TenantListResponse {
  items: PlatformTenant[];
  meta: { page: number; perPage: number; total: number; totalPages: number };
}

const STATUS_TONES: Record<string, "success" | "info" | "warn" | "danger" | "neutral"> = {
  active: "success",
  trial: "info",
  suspended: "danger",
  cancelled: "neutral",
};

const PLAN_TONES: Record<string, "neutral" | "info" | "brand" | "success"> = {
  free: "neutral",
  starter: "info",
  growth: "brand",
  enterprise: "success",
};

function GrowthChart() {
  const growth = useApi<GrowthPoint[]>("/tenants/growth", { scope: "platform", query: { days: 90 } });

  const { points, values } = useMemo(() => {
    const byDay = new Map((growth.data ?? []).map((row) => [row.day, row.count]));
    const out: { label: string; value: number }[] = [];
    const today = new Date();
    for (let index = 89; index >= 0; index -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - index);
      const key = date.toISOString().slice(0, 10);
      out.push({ label: key, value: byDay.get(key) ?? 0 });
    }
    return { points: out.map((row) => ({ label: row.label })), values: out.map((row) => row.value) };
  }, [growth.data]);

  const thisWeek = values.slice(-7).reduce((sum, value) => sum + value, 0);
  const prevWeek = values.slice(-14, -7).reduce((sum, value) => sum + value, 0);

  return (
    <Card>
      <CardHeader
        title="New libraries"
        subtitle="Signups over the last 90 days"
        action={
          <div className="text-right">
            <p className="text-lg font-bold text-ink-900">{thisWeek}</p>
            <p className="text-[11.5px] text-ink-400">
              this week{" "}
              <span className={cx("font-medium", thisWeek >= prevWeek ? "text-emerald-500" : "text-rose-500")}>
                {thisWeek >= prevWeek ? "↑" : "↓"} vs {prevWeek}
              </span>
            </p>
          </div>
        }
      />
      {growth.loading && !growth.data ? (
        <div className="h-[220px] animate-pulse rounded-xl bg-ink-100" />
      ) : (
        <AreaChart points={points} series={[{ name: "Signups", color: "#6366f1", values }]} height={220} />
      )}
    </Card>
  );
}

export default function PlatformDashboard() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("");
  const [page, setPage] = useState(1);
  const debounced = useDebounced(query, 300);

  const tenants = useApi<TenantListResponse>("/tenants", {
    scope: "platform",
    query: { q: debounced || undefined, status: status || undefined, page },
  });
  const all = useApi<TenantListResponse>("/tenants", { scope: "platform", query: { page: 1, perPage: 100 } });

  const meta = tenants.data?.meta;
  const totals = useMemo(() => {
    const items = all.data?.items ?? [];
    return {
      total: all.data?.meta.total ?? 0,
      active: items.filter((item) => item.status === "active").length,
      suspended: items.filter((item) => item.status === "suspended").length,
      users: items.reduce((sum, item) => sum + (item.userCount ?? 0), 0),
    };
  }, [all.data]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink-900">Platform overview</h1>
        <p className="mt-0.5 text-[13px] text-ink-400">Every library running on this instance.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Libraries" value={totals.total} icon={<Building2 className="h-4 w-4" />} tone="brand" />
        <StatCard label="Active" value={totals.active} icon={<TrendingUp className="h-4 w-4" />} tone="success" />
        <StatCard label="Suspended" value={totals.suspended} icon={<Building2 className="h-4 w-4" />} tone="danger" />
        <StatCard label="Total staff users" value={totals.users} icon={<Users className="h-4 w-4" />} />
      </div>

      <GrowthChart />

      <Card padded={false}>
        <div className="flex flex-wrap items-center gap-3 border-b border-ink-100 p-4">
          <div className="relative min-w-56 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-300" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(1);
              }}
              placeholder="Search by name or slug…"
              className="pl-9"
            />
          </div>
          <div className="flex rounded-xl bg-ink-100/80 p-1">
            {["", "active", "trial", "suspended", "cancelled"].map((option) => (
              <button
                key={option || "all"}
                type="button"
                onClick={() => {
                  setStatus(option);
                  setPage(1);
                }}
                className={cx(
                  "h-7 rounded-lg px-3 text-[12.5px] font-medium transition-colors",
                  status === option ? "bg-white text-ink-900 shadow-sm" : "text-ink-500 hover:text-ink-800",
                )}
              >
                {option ? titleCase(option) : "All"}
              </button>
            ))}
          </div>
        </div>

        {tenants.loading && !tenants.data ? (
          <div className="p-4">
            <TableSkeleton rows={6} />
          </div>
        ) : (tenants.data?.items ?? []).length === 0 ? (
          <EmptyState
            icon={<Building2 className="h-5 w-5" />}
            title="No libraries match"
            description="Adjust your search or filters."
          />
        ) : (
          <TableWrap>
            <thead>
              <tr>
                <Th>Library</Th>
                <Th>Plan</Th>
                <Th>Status</Th>
                <Th className="text-right">Staff</Th>
                <Th>Created</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {(tenants.data?.items ?? []).map((tenant) => (
                <Tr key={tenant.id}>
                  <Td>
                    <Link href={`/platform/tenants/${tenant.id}`} className="group flex items-center gap-3">
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-ink-100 text-[12px] font-bold uppercase text-ink-500">
                        {tenant.name.slice(0, 2)}
                      </span>
                      <span>
                        <span className="block text-[13.5px] font-semibold text-ink-800 group-hover:text-[var(--brand)]">
                          {tenant.name}
                        </span>
                        <span className="block font-mono text-[11.5px] text-ink-400">/{tenant.slug}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <Badge tone={PLAN_TONES[tenant.plan] ?? "neutral"}>{titleCase(tenant.plan)}</Badge>
                  </Td>
                  <Td>
                    <Badge tone={STATUS_TONES[tenant.status] ?? "neutral"}>{titleCase(tenant.status)}</Badge>
                  </Td>
                  <Td className="text-right font-mono text-[13px] text-ink-600">{tenant.userCount}</Td>
                  <Td className="text-[12.5px] text-ink-400">{formatDate(tenant.createdAt)}</Td>
                  <Td className="text-right">
                    <Link
                      href={`/platform/tenants/${tenant.id}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-ink-300 transition-colors hover:bg-ink-100 hover:text-ink-600"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        )}

        {meta && meta.totalPages > 1 ? (
          <div className="border-t border-ink-100 p-4">
            <Pagination page={meta.page} totalPages={meta.totalPages} total={meta.total} onPage={setPage} />
          </div>
        ) : null}
      </Card>
    </div>
  );
}

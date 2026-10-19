"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  BookOpen,
  CircleDollarSign,
  Clock,
  Layers,
  TrendingUp,
  Users,
} from "lucide-react";
import { AreaChart, BarList } from "@/components/charts";
import { PageHeader, StatCard } from "@/components/dashboard/page-header";
import { TableSkeleton, Td, Th, TableWrap, Tr } from "@/components/table";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { formatMoney, relativeTime } from "@/lib/format";
import { useApi } from "@/lib/hooks";
import { useTenant } from "@/lib/tenant-context";
import type { CirculationPoint, DashboardSummary, RecentCheckout, TopTitle } from "@/lib/types";

export default function DashboardOverviewPage() {
  const { settings } = useTenant();
  const summary = useApi<DashboardSummary>("/dashboard/summary", { scope: "staff" });
  const circulation = useApi<CirculationPoint[]>("/dashboard/circulation", {
    scope: "staff",
    query: { days: 30 },
  });
  const topTitles = useApi<TopTitle[]>("/dashboard/top-titles", { scope: "staff", query: { limit: 5 } });
  const recent = useApi<RecentCheckout[]>("/dashboard/recent-checkouts", {
    scope: "staff",
    query: { limit: 8 },
  });

  const data = summary.data;
  const currency = settings.currency;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Live operational metrics for your library."
        actions={
          <Link
            href="/dashboard/loans"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-ink-200 bg-white px-3.5 text-[13px] font-medium text-ink-600 transition-colors hover:bg-ink-50"
          >
            Go to circulation
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        }
      />

      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
        {summary.loading && !data
          ? Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="rounded-2xl border border-ink-200/80 bg-white p-5">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="mt-3 h-7 w-16" />
                <Skeleton className="mt-3 h-3 w-32" />
              </div>
            ))
          : (
            <>
              <StatCard
                label="Active loans"
                value={data?.loans.active ?? 0}
                icon={<BookOpen className="h-4 w-4" />}
                tone="brand"
                hint={
                  data && data.loans.overdue > 0 ? (
                    <span className="inline-flex items-center gap-1 font-medium text-rose-500">
                      <AlertTriangle className="h-3 w-3" /> {data.loans.overdue} overdue
                    </span>
                  ) : (
                    `${data?.loans.checkedOutToday ?? 0} checked out today`
                  )
                }
              />
              <StatCard
                label="Ready holds"
                value={data?.holds.ready ?? 0}
                icon={<Layers className="h-4 w-4" />}
                tone="warn"
                hint={`${data?.holds.pending ?? 0} waiting in queue`}
              />
              <StatCard
                label="Outstanding fines"
                value={formatMoney(data?.fines.outstandingCents ?? 0, currency)}
                icon={<CircleDollarSign className="h-4 w-4" />}
                tone={data && data.fines.outstandingCents > 0 ? "danger" : "success"}
                hint={`${data?.fines.outstandingCount ?? 0} open fines`}
              />
              <StatCard
                label="Members"
                value={data?.members.total ?? 0}
                icon={<Users className="h-4 w-4" />}
                hint={`${data?.members.newThisMonth ?? 0} joined this month`}
              />
            </>
          )}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader
            title="Circulation"
            subtitle="Checkouts and returns over the last 30 days"
            action={
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-600">
                <TrendingUp className="h-3 w-3" />
                {data?.loans.checkedOutThisMonth ?? 0} this month
              </span>
            }
          />
          {circulation.loading && !circulation.data ? (
            <Skeleton className="h-[220px] w-full" />
          ) : circulation.data ? (
            <AreaChart
              points={circulation.data.map((point) => ({
                label: new Date(point.day).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
              }))}
              series={[
                {
                  name: "Checkouts",
                  color: settings.branding.primaryColor,
                  values: circulation.data.map((point) => point.checkouts),
                },
                { name: "Returns", color: "#94a3b8", values: circulation.data.map((point) => point.returns) },
              ]}
            />
          ) : (
            <EmptyState title="No circulation data yet" icon={<Clock className="h-5 w-5" />} />
          )}
        </Card>

        <Card>
          <CardHeader title="Top titles" subtitle="Most borrowed in the last 90 days" />
          {topTitles.loading && !topTitles.data ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full" />
              ))}
            </div>
          ) : topTitles.data && topTitles.data.length > 0 ? (
            <BarList
              items={topTitles.data.map((title) => ({
                label: title.title,
                value: title.loanCount,
                hint: `${title.loanCount} ${title.loanCount === 1 ? "loan" : "loans"}`,
              }))}
            />
          ) : (
            <EmptyState title="No loans yet" description="Top titles appear once books circulate." />
          )}
        </Card>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold text-ink-900">Recent checkouts</h2>
          <Link href="/dashboard/loans" className="text-[13px] font-medium text-[var(--brand)] hover:underline">
            View all
          </Link>
        </div>
        {recent.loading && !recent.data ? (
          <TableSkeleton rows={5} cols={4} />
        ) : recent.data && recent.data.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Member</Th>
                <Th>Title</Th>
                <Th>Barcode</Th>
                <Th>Checked out</Th>
                <Th>Due</Th>
              </tr>
            </thead>
            <tbody>
              {recent.data.map((loan) => (
                <Tr key={loan.id}>
                  <Td className="font-medium text-ink-800">{loan.memberName}</Td>
                  <Td>{loan.bookTitle}</Td>
                  <Td className="font-mono text-[12.5px] text-ink-500">{loan.copyBarcode}</Td>
                  <Td className="text-ink-500">{relativeTime(loan.checkedOutAt)}</Td>
                  <Td className="text-ink-500">
                    {new Date(loan.dueAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <Card>
            <EmptyState
              icon={<BookOpen className="h-5 w-5" />}
              title="No checkouts yet"
              description="Head to circulation to check out the first book."
            />
          </Card>
        )}
      </div>
    </div>
  );
}
